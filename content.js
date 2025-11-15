let settings = {
  blockAutoMix: true,
  loopVideo: false,
  theaterMode: false,
  pipHotkey: true,
  volumeBooster: true,
  quickTimestamps: true
};

chrome.storage.sync.get(Object.keys(settings), (result) => {
  settings = { ...settings, ...result };
  if (result.enabled !== undefined) {
    settings.blockAutoMix = result.enabled;
  }
  initializeFeatures();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    if (message.feature === 'volumeLevel') {
      const video = document.querySelector('video');
      if (video && video.gainNode) {
        video.gainNode.gain.value = message.level / 100;
      }
    } else {
      settings[message.feature] = message.enabled;
      applyFeature(message.feature, message.enabled);
    }
  }
});

function initializeFeatures() {
  applyFeature('loopVideo', settings.loopVideo);
  applyFeature('theaterMode', settings.theaterMode);
  applyFeature('pipHotkey', settings.pipHotkey);
  applyFeature('volumeBooster', settings.volumeBooster);
  applyFeature('quickTimestamps', settings.quickTimestamps);
  
  observeDOM();
}

function applyFeature(feature, enabled) {
  switch(feature) {
    case 'loopVideo':
      loopVideo(enabled);
      break;
    case 'theaterMode':
      theaterMode(enabled);
      break;
    case 'pipHotkey':
      pipHotkey(enabled);
      break;
    case 'volumeBooster':
      volumeBooster(enabled);
      break;
    case 'quickTimestamps':
      quickTimestamps(enabled);
      break;
  }
}

function loopVideo(enabled) {
  document.addEventListener('keydown', (e) => {
    if (!enabled) return;
    if (e.shiftKey && e.key === 'L') {
      const video = document.querySelector('video');
      if (video) {
        video.loop = !video.loop;
        showNotification(video.loop ? '🔁 Loop: ON' : '🔁 Loop: OFF');
      }
    }
  });
}

function theaterMode(enabled) {
  if (!enabled) return;
  
  const enableTheater = () => {
    if (window.location.pathname !== '/watch') return;
    
    const checkAndEnable = () => {
      const theaterButton = document.querySelector('button.ytp-size-button');
      const player = document.querySelector('ytd-watch-flexy');
      
      if (theaterButton && player) {
        const isTheaterMode = player.hasAttribute('theater');
        if (!isTheaterMode) {
          theaterButton.click();
        }
      } else {
        setTimeout(checkAndEnable, 200);
      }
    };
    
    setTimeout(checkAndEnable, 300);
  };
  
  enableTheater();
  window.addEventListener('yt-navigate-finish', enableTheater);
}

function pipHotkey(enabled) {
  document.addEventListener('keydown', (e) => {
    if (!enabled) return;
    if (e.altKey && e.key === 'p') {
      e.preventDefault();
      const video = document.querySelector('video');
      if (video && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else {
          video.requestPictureInPicture();
        }
      }
    }
  });
}

let volumeBoosterActive = false;
let volumeKeyHandler = null;
let currentVideoElement = null;
let videoObserver = null;

function volumeBooster(enabled) {
  if (!enabled) {
    volumeBoosterActive = false;
    if (volumeKeyHandler) {
      document.removeEventListener('keydown', volumeKeyHandler);
      volumeKeyHandler = null;
    }
    if (videoObserver) {
      videoObserver.disconnect();
      videoObserver = null;
    }
    currentVideoElement = null;
    return;
  }
  
  volumeBoosterActive = true;
  
  const initAudioContext = (video) => {
    if (!video) return false;
    if (video === currentVideoElement && video.gainNode) {
      return true;
    }
    currentVideoElement = video;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(video);
      const gainNode = audioContext.createGain();
      
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      video.audioContext = audioContext;
      video.gainNode = gainNode;
      chrome.storage.sync.get(['volumeLevel'], (result) => {
        const level = result.volumeLevel || 100;
        if (video.gainNode) {
          video.gainNode.gain.value = level / 100;
        }
      });
      
      return true;
    } catch (error) {
      if (error.name === 'InvalidStateError') {
      } else {
        console.error('Volume Booster: Audio context error', error);
      }
      return false;
    }
  };
  
  const setupVideoObserver = () => {
    const video = document.querySelector('video');
    if (video) {
      initAudioContext(video);
    }
    if (videoObserver) {
      videoObserver.disconnect();
    }
    
    videoObserver = new MutationObserver(() => {
      const newVideo = document.querySelector('video');
      if (newVideo && newVideo !== currentVideoElement) {
        initAudioContext(newVideo);
      }
    });
    
    videoObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  };
  
  setupVideoObserver();
  window.addEventListener('yt-navigate-finish', setupVideoObserver);
  
  if (volumeKeyHandler) {
    document.removeEventListener('keydown', volumeKeyHandler);
  }
  let volumeDebounceTimer = null;
  volumeKeyHandler = (e) => {
    if (!volumeBoosterActive) return;
    
    const video = document.querySelector('video');
    if (!video) return;
    if (!video.gainNode) {
      initAudioContext(video);
      if (!video.gainNode) return;
    }
    
    if (e.key === '+' || e.key === '=') {
      const currentGain = video.gainNode.gain.value;
      const newGain = Math.min(currentGain + 0.1, 3.0);
      video.gainNode.gain.value = newGain;
      const level = Math.round(newGain * 100);
      showNotification(`🔊 Volume: ${level}%`);
      clearTimeout(volumeDebounceTimer);
      volumeDebounceTimer = setTimeout(() => {
        chrome.storage.sync.set({ volumeLevel: level });
      }, 500);
    } else if (e.key === '-' || e.key === '_') {
      const currentGain = video.gainNode.gain.value;
      const newGain = Math.max(currentGain - 0.1, 0);
      video.gainNode.gain.value = newGain;
      const level = Math.round(newGain * 100);
      showNotification(`🔊 Volume: ${level}%`);
      clearTimeout(volumeDebounceTimer);
      volumeDebounceTimer = setTimeout(() => {
        chrome.storage.sync.set({ volumeLevel: level });
      }, 500);
    }
  };
  
  document.addEventListener('keydown', volumeKeyHandler);
}

function quickTimestamps(enabled) {
  document.addEventListener('keydown', (e) => {
    if (!enabled) return;
    
    const key = parseInt(e.key);
    if (key >= 1 && key <= 9 && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      const video = document.querySelector('video');
      if (video && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        const targetTime = (video.duration * key) / 10;
        video.currentTime = targetTime;
        showNotification(`⏱️ ${key}0% - ${formatTime(targetTime)}`);
      }
    }
  });
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
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999;
      transition: opacity 0.3s;
      pointer-events: none;
      font-family: 'Roboto', sans-serif;
    `;
    document.body.appendChild(notification);
  }
  
  notification.textContent = message;
  notification.style.opacity = '1';
  
  setTimeout(() => {
    notification.style.opacity = '0';
  }, 2000);
}

function observeDOM() {
  const observer = new MutationObserver(() => {
    if (settings.theaterMode) theaterMode(true);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

window.addEventListener('load', initializeFeatures);
window.addEventListener('yt-navigate-finish', initializeFeatures);
