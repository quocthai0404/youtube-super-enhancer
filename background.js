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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(null, (stored) => {
    const missingDefaults = Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).filter(([key]) => stored[key] === undefined)
    );

    // v2 used `enabled` for Auto-Mix. Preserve an existing user's preference.
    if (stored.blockAutoMix === undefined && stored.enabled !== undefined) {
      missingDefaults.blockAutoMix = stored.enabled;
    }

    if (Object.keys(missingDefaults).length) {
      chrome.storage.sync.set(missingDefaults);
    }
  });
});
