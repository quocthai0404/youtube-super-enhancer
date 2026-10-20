const DEFAULT_SETTINGS = {
  blockAutoMix: true,
  loopVideo: false,
  theaterMode: false,
  pipHotkey: true,
  volumeBooster: true,
  quickTimestamps: true,
  playbackSpeedHotkeys: false,
  volumeLevel: 100
};

let settings = { ...DEFAULT_SETTINGS };
let currentVideo = null;
let videoObserver = null;
let theaterTimer = null;
let notificationTimer = null;
let isRedirectingAutoMix = false;
const audioGraphs = new WeakMap();

chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS).concat('enabled'), (stored) => {
  settings = { ...settings, ...stored };
  if (stored.blockAutoMix === undefined && stored.enabled !== undefined) {
    settings.blockAutoMix = stored.enabled;
  }
  initialize();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const [key, change] of Object.entries(changes)) {
    if (key in settings) settings[key] = change.newValue;
  }
  if (changes.enabled && !changes.blockAutoMix) settings.blockAutoMix = changes.enabled.newValue;
  applyAll();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action !== 'updateSettings') return;
  settings[message.feature] = message.feature === 'volumeLevel' ? message.level : message.enabled;
  applyAll();
});

function initialize() {
  installEventHandlers();
  installVideoObserver();
  applyAll();
  cleanAutoMixUrl();
}

function installEventHandlers() {
  if (window.__ytSuperEnhancerInstalled) return;
  window.__ytSuperEnhancerInstalled = true;
  document.addEventListener('keydown', handleKeydown, true);
  window.addEventListener('yt-navigate-start', handleNavigation);
  window.addEventListener('yt-navigate-finish', handleNavigation);
  window.addEventListener('popstate', () => queueMicrotask(cleanAutoMixUrl));
}

function handleNavigation() {
  // YouTube updates history during its SPA navigation. Replacing it in the next
  // task preserves one history entry, so the browser Back button still works.
  setTimeout(() => {
    cleanAutoMixUrl();
    applyAll();
  }, 0);
}

function applyAll() {
  if (settings.blockAutoMix) cleanAutoMixUrl();
  applyTheaterMode();
  applyVolumeBooster();
}

function getCleanAutoMixUrl(href = location.href) {
  const url = new URL(href);
  if (!/(^|\.)youtube\.com$/i.test(url.hostname) || url.pathname !== '/watch') return null;
  const listId = url.searchParams.get('list');
  const videoId = url.searchParams.get('v');
  const isAutoMix = listId && (listId.startsWith('RD') || listId.startsWith('OLAK5uy_'));
  if (!isAutoMix || !videoId) return null;
  url.searchParams.delete('list');
  url.searchParams.delete('index');
  url.searchParams.delete('start_radio');
  return `${url.pathname}${url.search}${url.hash}`;
}

function cleanAutoMixUrl() {
  if (!settings.blockAutoMix || isRedirectingAutoMix) return;
  const cleanUrl = getCleanAutoMixUrl();
  if (!cleanUrl) return;

  // Unlike tabs.update(), replace() replaces the Mix entry itself. It also
  // reloads YouTube without the playlist state, preserving the old feature's
  // behavior while letting Back return to the page before the video.
  isRedirectingAutoMix = true;
  location.replace(cleanUrl);
}

function handleKeydown(event) {
  if (isTypingTarget(event.target)) return;
  const video = document.querySelector('video');

  if (settings.loopVideo && event.shiftKey && event.key.toLowerCase() === 'l') {
    if (!video) return;
    event.preventDefault();
    video.loop = !video.loop;
    showNotification(video.loop ? '🔁 Loop: ON' : '🔁 Loop: OFF');
    return;
  }
  if (settings.pipHotkey && event.altKey && event.key.toLowerCase() === 'p') {
    if (!video || !document.pictureInPictureEnabled) return;
    event.preventDefault();
    (document.pictureInPictureElement ? document.exitPictureInPicture() : video.requestPictureInPicture())
      .catch(() => showNotification('Không thể bật Picture-in-Picture'));
    return;
  }
  if (settings.volumeBooster && (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '_')) {
    if (!video) return;
    event.preventDefault();
    changeVolume(video, event.key === '+' || event.key === '=' ? 10 : -10);
    return;
  }
  if (settings.quickTimestamps && /^[1-9]$/.test(event.key) && !event.shiftKey && !event.ctrlKey && !event.altKey) {
    if (!video || !Number.isFinite(video.duration)) return;
    event.preventDefault();
    const targetTime = (video.duration * Number(event.key)) / 10;
    video.currentTime = targetTime;
    showNotification(`⏱️ ${event.key}0% - ${formatTime(targetTime)}`);
    return;
  }
  if (settings.playbackSpeedHotkeys && event.altKey && (event.key === '[' || event.key === ']')) {
    if (!video) return;
    event.preventDefault();
    const direction = event.key === ']' ? 0.25 : -0.25;
    video.playbackRate = Math.min(2, Math.max(0.25, Number((video.playbackRate + direction).toFixed(2))));
    showNotification(`⏩ Tốc độ: ${video.playbackRate}×`);
  }
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

function applyTheaterMode() {
  clearTimeout(theaterTimer);
  if (!settings.theaterMode || location.pathname !== '/watch') return;
  theaterTimer = setTimeout(() => {
    const player = document.querySelector('ytd-watch-flexy');
    const theaterButton = document.querySelector('.ytp-size-button');
    if (player && theaterButton && !player.hasAttribute('theater')) theaterButton.click();
  }, 500);
}

function installVideoObserver() {
  if (videoObserver) return;
  videoObserver = new MutationObserver(() => applyVolumeBooster());
  videoObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function applyVolumeBooster() {
  const video = document.querySelector('video');
  if (video) currentVideo = video;
  if (!currentVideo) return;
  let graph = audioGraphs.get(currentVideo);
  if (!graph && settings.volumeBooster) {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const source = context.createMediaElementSource(currentVideo);
      const gain = context.createGain();
      source.connect(gain).connect(context.destination);
      graph = { context, gain };
      audioGraphs.set(currentVideo, graph);
    } catch (error) {
      console.warn('YouTube Super Enhancer: volume booster unavailable', error);
      return;
    }
  }
  if (!graph) return;
  graph.gain.gain.value = settings.volumeBooster ? settings.volumeLevel / 100 : 1;
  if (settings.volumeBooster && graph.context.state === 'suspended') graph.context.resume().catch(() => {});
}

function changeVolume(video, delta) {
  currentVideo = video;
  applyVolumeBooster();
  const graph = audioGraphs.get(video);
  if (!graph) return;
  settings.volumeLevel = Math.max(0, Math.min(300, graph.gain.gain.value * 100 + delta));
  graph.gain.gain.value = settings.volumeLevel / 100;
  chrome.storage.sync.set({ volumeLevel: settings.volumeLevel });
  showNotification(`🔊 Volume: ${settings.volumeLevel}%`);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function showNotification(message) {
  let notification = document.getElementById('yt-enhancer-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'yt-enhancer-notification';
    document.body.appendChild(notification);
  }
  notification.textContent = message;
  notification.style.opacity = '1';
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => { notification.style.opacity = '0'; }, 2000);
}
