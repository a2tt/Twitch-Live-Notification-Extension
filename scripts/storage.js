function storageClear(callback = null) {
    chrome.storage.clear(callback)
}

function storageGetPromise(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, (res) => {
            resolve(res);
        });
    });
}

function storageSetPromise(obj) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(obj, () => {
            resolve();
        })
    })
}

/**
 * @param {String} key
 * @param {String} value
 * @param {Function} callback
 */
function storageSet(key, value, callback) {
    chrome.storage.local.set({[key]: value}, callback);
}

/**
 * @param {Array} key
 * @param {Function} callback
 */
function storageGet(key, callback) {
    chrome.storage.local.get(key, result => callback(result));
}
