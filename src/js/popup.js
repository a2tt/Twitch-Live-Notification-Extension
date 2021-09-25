import '@fortawesome/fontawesome-free/js/fontawesome';
import '@fortawesome/fontawesome-free/js/solid';

import {storageGetPromise} from "./storage";
import * as constants from "./constants";
import '../css/popup.css';


/**
 * check whether required configs exist
 * @returns {Promise<Boolean>}
 */
function checkConfigs() {
    return storageGetPromise([constants.KEY_TWITCH_TOKEN, constants.KEY_FOLLOWER_LOGIN_ID, constants.KEY_FOLLOWER_ID]).then(storage => {
        return Boolean(storage[constants.KEY_TWITCH_TOKEN] && storage[constants.KEY_FOLLOWER_LOGIN_ID] && storage[constants.KEY_FOLLOWER_ID]);
    })
}

var updateCheckInterval = null

/**
 * on click refresh button
 * @param e
 */
function onClickRefreshBtn(e) {
    e.stopPropagation();
    checkConfigs().then(status => {
        if (!status) return;
        storageGetPromise([constants.KEY_UPDATE_TS]).then(res => {
            // send update request
            chrome.runtime.sendMessage({'name': constants.EVENT_UPDATE_LIVE_STREAM});

            let beforeTs = res[constants.KEY_UPDATE_TS];
            clearInterval(updateCheckInterval);
            e.target.classList.add('spinning');
            console.log(e.target)
            // check refreshing
            updateCheckInterval = setInterval(_ => {
                storageGetPromise([constants.KEY_UPDATE_TS]).then(res => {
                    // if refreshed
                    if (beforeTs !== res[constants.KEY_UPDATE_TS]) {
                        clearInterval(updateCheckInterval);
                        createUI();
                        e.target.classList.remove('spinning');
                    }
                })
            }, 1000)
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
            loginRequiredElem.className = 'text-alert';
            loginRequiredElem.innerHTML = `Twitch login required. <a href="${chrome.runtime.getURL('options.html')}" target="_blank">option</a>`;
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
    storageGetPromise([
        constants.KEY_DARK_MODE,
        constants.KEY_LIVE_STREAM,
        constants.KEY_TWITCH_TOKEN,
        constants.KEY_FOLLOWER_LOGIN_ID,
        constants.KEY_FOLLOWER_ID]
    ).then(storage => {
        // dark mode
        if (storage[constants.KEY_DARK_MODE]) {
            document.body.setAttribute('theme', 'dark');
        }

        // only if all configs are set, create UI
        if (storage[constants.KEY_TWITCH_TOKEN] && storage[constants.KEY_FOLLOWER_LOGIN_ID] && storage[constants.KEY_FOLLOWER_ID]) {
            // group by game name
            let gameGroup = {};
            for (let s of storage[constants.KEY_LIVE_STREAM]) {
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

            // if nothing
            if (Object.keys(gameGroup).length === 0) {
                let loginRequiredElem = document.createElement('div')
                loginRequiredElem.className = 'text-alert';
                loginRequiredElem.innerHTML = `No one is streaming right now :(
<br><br>Browse other channels on <a href="https://twitch.tv" target="_blank">Twitch</a>`;
                container.appendChild(loginRequiredElem);
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
function calcTimeDiff(prevTs) {
    let prev = new Date(prevTs);
    let diff_ms = (new Date()) - prev;
    return parseInt(diff_ms / 1000 / 60);
}

/**
 * update latest refreshed time
 */
function updateTs() {
    storageGetPromise([constants.KEY_UPDATE_TS]
    ).then(storage => {
        let timeDiff = calcTimeDiff(storage[constants.KEY_UPDATE_TS])
        if (timeDiff >= 5) {
            let updatedAt = document.getElementById('updated-at');
            updatedAt.innerText = `🕗Updated ${timeDiff}min ago`;
        }
    })
}

function eventHandler(data) {
    if (data.name === constants.EVENT_REFRESHED) {
        updateTs();
    }
}

window.onload = function () {
    loginRequired();
    createUI();

    let optionsBtn = document.getElementById('options-btn');
    optionsBtn.addEventListener('click', _ => {
        chrome.runtime.openOptionsPage();
    })

    let refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.addEventListener('click', onClickRefreshBtn);

    setInterval(_ => {
        updateTs();
    }, 20000)

    chrome.runtime.onMessage.addListener(eventHandler);
}
