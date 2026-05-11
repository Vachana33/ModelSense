// Thin wrapper around chrome.storage.local so other modules don't call it directly.
// Not loaded as a content script — imported only where needed.

const Storage = {
  get(key, callback) {
    chrome.storage.local.get([key], (result) => callback(result[key]));
  },
  set(key, value, callback) {
    chrome.storage.local.set({ [key]: value }, callback);
  }
};
