/**
 * check whether required configs exist
 * @returns {Promise<Boolean>}
 */
function checkConfigs() {
    return storageGetPromise([KEY_TWITCH_TOKEN, KEY_FOLLOWER_LOGIN_ID, KEY_FOLLOWER_ID]).then(storage => {
        return Boolean(storage[KEY_TWITCH_TOKEN] && storage[KEY_FOLLOWER_LOGIN_ID] && storage[KEY_FOLLOWER_ID]);
    })
}

var updateCheckInterval = null

/**
 * on click refresh button
 * @param e
 */
function onClickRefreshBtn(e) {
    checkConfigs().then(status => {
        if (!status) return;
        storageGetPromise([KEY_UPDATE_TS]).then(res => {
            // send update request
            chrome.runtime.sendMessage({'name': EVENT_UPDATE_LIVE_STREAM});

            let beforeTs = res[KEY_UPDATE_TS];
            clearInterval(updateCheckInterval);
            e.target.classList.add('spinning');
            // check refreshing
            updateCheckInterval = setInterval(_ => {
                storageGetPromise([KEY_UPDATE_TS]).then(res => {
                    // if refreshed
                    if (beforeTs !== res[KEY_UPDATE_TS]) {
                        clearInterval(updateCheckInterval);
                        createUI();
                        e.target.classList.remove('spinning');
                    }
                })
            }, 500)
        })
    })
}

/**
 * if configs are not set, show 'login required' message
 */
function loginRequired() {
    checkConfigs().then(status => {
        if (!status) {
            let container = document.getElementById('container');
            let loginRequiredElem = document.createElement('div')
            loginRequiredElem.className = 'login-required';
            loginRequiredElem.innerHTML = `Twitch login required. <a href="${chrome.extension.getURL('option.html')}" target="_blank">option</a>`;
            container.appendChild(loginRequiredElem);
        }
    })
}

/**
 * create popup UI
 */
function createUI() {
    /* sample
<div class="game-group">
    <p class="game-name single-line"
       data-href="https://twitch.tv/directory/game/Dead%20by%20Daylight">Leagues of Legends</p>
    <div class="stream-wrapper single-line" data-href="">김도 (kimdoe)<span class="view-count">1,222</div>
</div>
    */
    let container = document.getElementById('container');
    container.innerHTML = '';
    storageGetPromise([KEY_LIVE_STREAM, KEY_TWITCH_TOKEN, KEY_FOLLOWER_LOGIN_ID, KEY_FOLLOWER_ID]).then(res => {
        // only if configs are set all
        if (res[KEY_TWITCH_TOKEN] && res[KEY_FOLLOWER_LOGIN_ID] && res[KEY_FOLLOWER_ID]) {
            // group by game name
            let gameGroup = {};
            for (let s of res[KEY_LIVE_STREAM]) {
                if (!gameGroup.hasOwnProperty(s.game_name))
                    gameGroup[s.game_name] = [];
                gameGroup[s.game_name].push(s);
            }

            for (let gameName in gameGroup) {
                // create UI element
                let gameGroupElem = document.createElement('div');
                gameGroupElem.className = 'game-group';
                let gameNameElem = document.createElement('p');
                gameNameElem.className = 'game-name single-line';
                gameNameElem.innerText = gameName;
                gameNameElem.setAttribute('data-href', 'https://twitch.tv/directory/game/' + encodeURIComponent(gameName));
                gameNameElem.onclick = function () {
                    chrome.tabs.create({url: this.getAttribute('data-href')});
                    return false;
                }
                gameGroupElem.appendChild(gameNameElem);
                for (let stream of gameGroup[gameName]) {
                    let streamElem = document.createElement('div');
                    streamElem.className = 'stream-wrapper single-line';
                    streamElem.setAttribute('data-href', `https://twitch.tv/${stream.user_login}`);
                    streamElem.onclick = function () {
                        chrome.tabs.create({url: this.getAttribute('data-href')});
                        return false;
                    }
                    streamElem.innerHTML = `${stream.user_name} (${stream.user_login})<span class="view-count">${stream.viewer_count}</span>`
                    gameGroupElem.appendChild(streamElem);
                }
                container.appendChild(gameGroupElem);
            }
            // refresh updated at
            updateTs();
        }
    })

}

/**
 * calculate time difference
 * @param {String} prevTs
 * @returns {number}
 */
function timeDiff(prevTs) {
    let prev = new Date(prevTs);
    let diff_ms = (new Date()) - prev;
    return parseInt(diff_ms / 1000 / 60);
}

/**
 * update latest refreshed time
 */
function updateTs() {
    let updatedAt = document.getElementById('updated-at');
    storageGetPromise([KEY_UPDATE_TS]
    ).then(storage => {
        updatedAt.innerText = `🕗${timeDiff(storage[KEY_UPDATE_TS])}min ago`;
    })
}

function eventHandler(data) {
    if (data.name === EVENT_REFRESHED) {
        updateTs();
    }
}

window.onload = function () {
    loginRequired();
    createUI();

    let refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.addEventListener('click', onClickRefreshBtn);

    setInterval(_ => {
        updateTs();
    }, 20000)

    chrome.runtime.onMessage.addListener(eventHandler);
}
