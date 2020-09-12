/**
 * clear credentials
 *
 * @returns {Promise<void>}
 */
function storageClearCredential() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({
            [KEY_TWITCH_TOKEN]: null,
        }, () => {
            resolve();
        })
    })
}

/**
 * @param {Array} key
 * @returns {Promise<Object>}
 */
function storageGetPromise(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(key, (res) => {
            resolve(res);
        });
    });
}

/**
 * @param {Object} obj
 * @returns {Promise<Object>}
 */
function storageSetPromise(obj) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(obj, () => {
            resolve();
        })
    })
}
