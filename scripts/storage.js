/**
 * clear credentials
 *
 * @returns {Promise<unknown>}
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
 * @returns {Promise<unknown>}
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
 * @returns {Promise<unknown>}
 */
function storageSetPromise(obj) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(obj, () => {
            resolve();
        })
    })
}
