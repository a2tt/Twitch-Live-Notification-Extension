window.onload = function () {
    let followerIdInput = window.document.getElementById('follower-login-id');
    let messageDiv = window.document.getElementById('message');
    let loginBtn = window.document.getElementById('login-btn')

    storageGet([KEY_FOLLOWER_LOGIN_ID, KEY_FOLLOWER_ID, KEY_TWITCH_TOKEN], storage => {
        console.log(storage[KEY_FOLLOWER_LOGIN_ID])
        console.log(storage[KEY_FOLLOWER_ID])
        console.log(storage[KEY_TWITCH_TOKEN])
        if (storage[KEY_FOLLOWER_LOGIN_ID]) {
            followerIdInput.value = storage[KEY_FOLLOWER_LOGIN_ID];
        }
        if (!storage[KEY_TWITCH_TOKEN]) {
            loginBtn.style.display = 'block'
        }
    })

    // TODO access token 무한 갱신

    // 로그인 처리 후, 데이터 저장
    let urlHash = window.location.hash
    if (urlHash) {
        let params = new URLSearchParams(urlHash.substring(1)); // chrome-extension://.../option.html#access_token=...
        let access_token = params.get('access_token')
        if (access_token) {
            storageSetPromise({
                [KEY_TWITCH_TOKEN]: access_token
            }).then(res => {
                window.location.href = chrome.extension.getURL('option.html');
            })
        }
    }

    // login button binding
    document.getElementById('login-btn').addEventListener('click', function (e) {
        let redirectUri = chrome.extension.getURL('option.html');
        this.loginUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${TWITCH_CLIENT_ID}&redirect_uri=${redirectUri}&scope=openid+user:read:email`
        window.location.href = this.loginUrl;
    })

    // form submit binding
    let optionForm = document.getElementsByClassName('option-form')[0];
    optionForm.addEventListener('submit', function (e) {
        e.preventDefault();
        let followerLoginId = e.currentTarget['follower-login-id'].value;
        if (!followerLoginId) {
            storageClear();
            return;
        }

        // Get user id using login id and save it
        let bgPage = chrome.extension.getBackgroundPage();
        bgPage.getUserInfo(followerLoginId).then(res => {
            console.log(res)
            storageSetPromise({
                [KEY_FOLLOWER_ID]: res.data[0].id, // follower id
                [KEY_FOLLOWER_LOGIN_ID]: followerLoginId
            }).then(res => {
                messageDiv.innerText = 'saved'
                bgPage.updateLiveStream(); // update
            })
        })
    })

}