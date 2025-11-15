let isEnabled = true;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ 
    blockAutoMix: true,
    loopVideo: false,
    theaterMode: false,
    pipHotkey: true,
    volumeBooster: true,
    quickTimestamps: true
  });
});

chrome.storage.sync.get(['blockAutoMix', 'enabled'], (result) => {
  isEnabled = result.blockAutoMix !== undefined ? result.blockAutoMix : (result.enabled !== false);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.blockAutoMix) {
      isEnabled = changes.blockAutoMix.newValue;
    } else if (changes.enabled) {
      isEnabled = changes.enabled.newValue;
    }
  }
});

function cleanYouTubeURL(url) {
  try {
    const urlObj = new URL(url);
    
    if (!urlObj.hostname.includes('youtube.com') || !urlObj.pathname.includes('/watch')) {
      return null;
    }
    
    const listParam = urlObj.searchParams.get('list');
    if (!listParam) {
      return null;
    }
    
    const isAutoMix = listParam.startsWith('RD') || 
                      listParam.startsWith('OLAK5uy_') ||
                      listParam.startsWith('RDMM') ||
                      listParam.startsWith('RDAO') ||
                      listParam.startsWith('RDAMVM') ||
                      listParam.startsWith('RDAMPL') ||
                      listParam.startsWith('RDCLAK') ||
                      listParam.startsWith('RDEM') ||
                      listParam.startsWith('RDTMAK');
    
    if (!isAutoMix) {
      return null;
    }
    
    const videoId = urlObj.searchParams.get('v');
    if (!videoId) {
      return null;
    }
    
    const cleanUrl = new URL(urlObj.origin + urlObj.pathname);
    cleanUrl.searchParams.set('v', videoId);
    
    urlObj.searchParams.forEach((value, key) => {
      if (key !== 'list' && key !== 'index' && key !== 'start_radio' && key !== 'v') {
        cleanUrl.searchParams.set(key, value);
      }
    });
    
    return cleanUrl.toString();
  } catch (e) {
    console.error('Error cleaning URL:', e);
    return null;
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    if (details.frameId !== 0 || !isEnabled) {
      return;
    }
    
    const cleanedUrl = cleanYouTubeURL(details.url);
    
    if (cleanedUrl && cleanedUrl !== details.url) {
      chrome.tabs.update(details.tabId, { url: cleanedUrl });
    }
  },
  { url: [{ hostContains: 'youtube.com' }] }
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isEnabled || !changeInfo.url) {
    return;
  }
  
  const cleanedUrl = cleanYouTubeURL(changeInfo.url);
  
  if (cleanedUrl && cleanedUrl !== changeInfo.url) {
    chrome.tabs.update(tabId, { url: cleanedUrl });
  }
});
