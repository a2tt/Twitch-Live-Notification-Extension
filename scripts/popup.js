var updateCheckInterval = null

function onClickRefreshBtn(e) {
    storageGetPromise([KEY_UPDATE_TS]).then(res => {
        // send update request
        chrome.runtime.sendMessage({'name': 'updateLiveStream'});

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

}

function createUI() {
    /* sample
<div class="game-group">
    <p class="game-name single-line"
       data-href="https://twitch.tv/directory/game/Dead%20by%20Daylight">Leagues of Legends</p>
    <div class="stream-wrapper single-line" data-href="">김도 (kimdoe)</div>
    <div class="stream-wrapper single-line" data-href="">승우아빠_ (swab85)</div>
</div>
    */
    let container = document.getElementById('container');
    container.innerHTML = '';
    storageGetPromise([KEY_LIVE_STREAM]).then(res => {
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
                streamElem.innerText = `${stream.user_name} (${stream.user_login})`;
                streamElem.onclick = function () {
                    chrome.tabs.create({url: this.getAttribute('data-href')});
                    return false;
                }
                gameGroupElem.appendChild(streamElem);
            }
            container.appendChild(gameGroupElem);
        }
        // refresh updated at
        updateTs();
    })

}

function timeDiff(prevTs) {
    let prev = new Date(prevTs);
    let diff_ms = (new Date()) - prev;
    return parseInt(diff_ms / 1000 / 60);
}

function updateTs() {
    let updatedAt = document.getElementById('updated-at');
    storageGet([KEY_UPDATE_TS], storage => {
        updatedAt.innerText = `🕗${timeDiff(storage[KEY_UPDATE_TS])}min ago`;
    })

}

function eventHandler(data) {
    if (data.name === EVENT_REFRESHED) {
        console.log('refreshedddd');
        updateTs();
    }
}

window.onload = function () {
    createUI();
    document.getElementById('refresh-btn').addEventListener('click', onClickRefreshBtn);

    setInterval(_ => {
        updateTs();
    }, 20000)

    chrome.runtime.onMessage.addListener(eventHandler);
}
