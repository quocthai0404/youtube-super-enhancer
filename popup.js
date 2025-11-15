const features = {
  blockAutoMix: { id: 'blockAutoMix', default: true, oldKey: 'enabled' },
  loopVideo: { id: 'loopVideo', default: false },
  theaterMode: { id: 'theaterMode', default: false },
  pipHotkey: { id: 'pipHotkey', default: true },
  volumeBooster: { id: 'volumeBooster', default: true },
  quickTimestamps: { id: 'quickTimestamps', default: true }
};

chrome.storage.sync.get(['volumeLevel'], (result) => {
  const volumeLevel = result.volumeLevel || 100;
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeValue = document.getElementById('volumeValue');
  if (volumeSlider && volumeValue) {
    volumeSlider.value = volumeLevel;
    volumeValue.textContent = volumeLevel + '%';
  }
});

Object.keys(features).forEach(featureKey => {
  const feature = features[featureKey];
  const toggle = document.getElementById(feature.id);
  
  if (!toggle) return;
  
  const keysToCheck = feature.oldKey ? [feature.id, feature.oldKey] : [feature.id];
  
  chrome.storage.sync.get(keysToCheck, (result) => {
    let enabled = feature.default;
    
    if (result[feature.id] !== undefined) {
      enabled = result[feature.id];
    } else if (feature.oldKey && result[feature.oldKey] !== undefined) {
      enabled = result[feature.oldKey];
      chrome.storage.sync.set({ [feature.id]: enabled });
    }
    
    toggle.checked = enabled;
    
    if (feature.id === 'volumeBooster') {
      const sliderContainer = document.getElementById('volumeSliderContainer');
      if (sliderContainer) {
        sliderContainer.style.display = enabled ? 'block' : 'none';
      }
    }
  });
  
  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    chrome.storage.sync.set({ [feature.id]: enabled });
    
    if (feature.id === 'volumeBooster') {
      const sliderContainer = document.getElementById('volumeSliderContainer');
      if (sliderContainer) {
        sliderContainer.style.display = enabled ? 'block' : 'none';
      }
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'updateSettings',
          feature: feature.id,
          enabled: enabled
        }).catch(() => {});
      }
    });
    
    toggle.parentElement.style.transform = 'scale(0.95)';
    setTimeout(() => {
      toggle.parentElement.style.transform = 'scale(1)';
    }, 100);
  });
});

const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
let volumeDebounceTimer = null;

if (volumeSlider && volumeValue) {
  volumeSlider.addEventListener('input', (e) => {
    const level = parseInt(e.target.value);
    volumeValue.textContent = level + '%';
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'updateSettings',
          feature: 'volumeLevel',
          level: level
        }).catch(() => {});
      }
    });
    
    clearTimeout(volumeDebounceTimer);
    volumeDebounceTimer = setTimeout(() => {
      chrome.storage.sync.set({ volumeLevel: level });
    }, 500);
  });
}

const masterToggle = document.getElementById('toggleAll');

chrome.storage.sync.get(['masterEnabled'], (result) => {
  const enabled = result.masterEnabled !== false;
  masterToggle.checked = enabled;
  updateMasterState(enabled);
});

masterToggle.addEventListener('change', () => {
  const enabled = masterToggle.checked;
  chrome.storage.sync.set({ masterEnabled: enabled });
  updateMasterState(enabled);
  
  Object.keys(features).forEach(key => {
    chrome.storage.sync.set({ [key]: enabled });
    const checkbox = document.getElementById(features[key].id);
    if (checkbox) {
      checkbox.checked = enabled;
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'updateSettings',
          feature: key,
          enabled: enabled
        }).catch(() => {});
      }
    });
  });
});

function updateMasterState(enabled) {
  const content = document.querySelector('.content');
  
  if (enabled) {
    content.classList.remove('collapsed');
  } else {
    content.classList.add('collapsed');
  }
}

let currentLang = 'vi';
chrome.storage.sync.get(['language'], (result) => {
  currentLang = result.language || 'vi';
  updateLanguage(currentLang);
});

document.getElementById('langSwitcher').addEventListener('click', () => {
  currentLang = currentLang === 'vi' ? 'en' : 'vi';
  chrome.storage.sync.set({ language: currentLang });
  updateLanguage(currentLang);
});

function updateLanguage(lang) {
  const flag = document.getElementById('currentFlag');
  const langText = document.getElementById('langText');
  
  if (lang === 'en') {
    flag.innerHTML = '<path fill="#012169" d="M32 5H4a4 4 0 0 0-4 4v18a4 4 0 0 0 4 4h28a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4z"/><path fill="#FFF" d="M36 9a4 4 0 0 0-.8-2.4L21 18l14.2 11.4c.5-.7.8-1.5.8-2.4V9zM4 5c-.7 0-1.4.2-2 .6L16.2 18 2 30.4c.6.4 1.3.6 2 .6h1.7L18 20.3 32.3 31H32c.7 0 1.4-.2 2-.6L19.8 18 34 5.6c-.6-.4-1.3-.6-2-.6H4z"/><path fill="#C8102E" d="M14.7 18 0 7.1V9c0 .3 0 .6.1.9L12.4 18 .1 26.1c-.1.3-.1.6-.1.9v1.9L14.7 18zm21.2 0L50 28.9V27c0-.3 0-.6-.1-.9L37.6 18l12.3-8.1c.1-.3.1-.6.1-.9V7.1L35.9 18z" transform="scale(0.72)"/><path fill="#FFF" d="M36 18.5h-15v-13h-2v13H4v3h15v12h2v-12h15z"/><path fill="#C8102E" d="M36 19.5h-16v-13h-4v13H0v1h16v12h4v-12h16z" transform="scale(1 0.8) translate(0 4.5)"/>';
    langText.textContent = 'EN';
  } else {
    flag.innerHTML = '<path fill="#DA251D" d="M32 5H4a4 4 0 0 0-4 4v18a4 4 0 0 0 4 4h28a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4z"/><path fill="#FFCD05" d="m18 11.5 1.8 5.6h5.9l-4.8 3.4 1.8 5.6-4.7-3.4-4.7 3.4 1.8-5.6-4.8-3.4h5.9z"/>';
    langText.textContent = 'VI';
  }
  document.querySelectorAll('[data-en][data-vi]').forEach(el => {
    if (lang === 'en') {
      el.textContent = el.getAttribute('data-en');
    } else {
      el.textContent = el.getAttribute('data-vi');
    }
  });
}
