function onClickRefreshBtn(e) {
    chrome.runtime.sendMessage({'type': 'updateLiveStream'})
}

function createUI() {
    /*
<div class="game-group">
    <p class="game-name"
       data-href="https://twitch.tv/directory/game/Dead%20by%20Daylight">Leagues of Legends</p>
    <div class="stream-wrapper" data-href="">김도 (kimdoe)</div>
    <div class="stream-wrapper" data-href="">승우아빠_ (swab85)</div>
</div>
    */
    let container = document.getElementById('container');
    storageGetPromise([KEY_LIVE_STREAM]).then(res => {
        // group by game name
        let gameGroup = {}
        for (let s of res[KEY_LIVE_STREAM]) {
            if (!gameGroup.hasOwnProperty(s.game_name))
                gameGroup[s.game_name] = []
            gameGroup[s.game_name].push(s)
        }

        for (let gameName in gameGroup) {
            // create UI element
            let gameGroupElem = document.createElement('div')
            gameGroupElem.className = 'game-group'
            let gameNameElem = document.createElement('p')
            gameNameElem.className = 'game-name'
            gameNameElem.innerText = gameName
            gameNameElem.setAttribute('data-href', 'https://twitch.tv/directory/game/' + encodeURIComponent(gameName))
            gameNameElem.onclick = function () {
                chrome.tabs.create({url: this.getAttribute('data-href')});
                return false;
            }
            gameGroupElem.appendChild(gameNameElem)
            for (let stream of gameGroup[gameName]) {
                let streamElem = document.createElement('div')
                streamElem.className = 'stream-wrapper'
                streamElem.setAttribute('data-href', `https://twitch.tv/${stream.user_login}`)
                streamElem.innerText = `${stream.user_name} (${stream.user_login})`
                streamElem.onclick = function () {
                    chrome.tabs.create({url: this.getAttribute('data-href')});
                    return false;
                }
                gameGroupElem.appendChild(streamElem)
            }
            container.appendChild(gameGroupElem)
        }
    })

}

window.onload = function () {
    createUI();

    document.getElementById('refresh-btn').addEventListener('click', onClickRefreshBtn)
    // storageGet(['ts'], storage => {
    //     document.getElementById('ts').innerText = storage.ts
    // })
}