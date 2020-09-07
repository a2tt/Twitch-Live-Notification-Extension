function onClickRefreshBtn (e) {
    chrome.runtime.sendMessage({'type': 'updateLiveStream'})
}

window.onload = function () {
    document.getElementById('refresh-btn').addEventListener('click', onClickRefreshBtn)
    let foo = document.getElementById('foo');
    storageGet(['ts'], storage => {
        foo.innerText = storage.ts
    })
}