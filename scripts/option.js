
/**
 * On twitch oauth login and redirected, set access_token from url hash
 */
function twitchLoginHandler() {
    let bgPage = chrome.extension.getBackgroundPage(); // background script's `window`
    // 로그인 처리 후, 데이터 저장
    let urlHash = window.location.hash
    if (urlHash) {
        let params = new URLSearchParams(urlHash.substring(1)); // chrome-extension://.../option.html#access_token=...
        let access_token = params.get('access_token')
        if (access_token) {
            // save access token
            storageSetPromise({
                [KEY_TWITCH_TOKEN]: access_token
            }).then(_ => {
                // get follower config
                storageGetPromise([KEY_FOLLOWER_ID, KEY_FOLLOWER_LOGIN_ID]
                ).then(res => {
                    // if follower id is not configured, set my account's info
                    if (!res[KEY_FOLLOWER_ID] || !res[KEY_FOLLOWER_LOGIN_ID]) {
                        // 로그인 한 유저의 정보로 데이터 초기 세팅
                        bgPage.getMyInfo().then(UserInfos => {
                            storageSetPromise({
                                [KEY_FOLLOWER_ID]: UserInfos[0].id,
                                [KEY_FOLLOWER_LOGIN_ID]: UserInfos[0].login,
                            }).then(res => {
                                chrome.runtime.sendMessage({'name': 'updateLiveStream'});
                                window.location.href = chrome.extension.getURL('option.html');
                            })
                        })
                    } else {
                        chrome.runtime.sendMessage({'name': 'updateLiveStream'});
                        window.location.href = chrome.extension.getURL('option.html');
                    }
                })
            })
        }
    }
}

/**
 * initialize option UI
 */
function initUi() {
    let followerIdInput = window.document.getElementById('follower-login-id');
    let loginBtn = window.document.getElementById('login-btn');
    let logoutBtn = window.document.getElementById('logout-btn');

    storageGetPromise([KEY_FOLLOWER_LOGIN_ID, KEY_FOLLOWER_ID, KEY_TWITCH_TOKEN]
    ).then(storage => {
        console.log(storage[KEY_FOLLOWER_LOGIN_ID])
        console.log(storage[KEY_FOLLOWER_ID])
        console.log(storage[KEY_TWITCH_TOKEN])
        if (storage[KEY_FOLLOWER_LOGIN_ID]) {
            followerIdInput.value = storage[KEY_FOLLOWER_LOGIN_ID];
        }
        if (storage[KEY_TWITCH_TOKEN]) {
            logoutBtn.style.display = 'block';
        } else {
            loginBtn.style.display = 'block';
        }
    })
}

function eventBinding() {
    let bgPage = chrome.extension.getBackgroundPage(); // background script's `window`
    let loginBtn = window.document.getElementById('login-btn');
    let logoutBtn = window.document.getElementById('logout-btn');

    // login button binding
    loginBtn.addEventListener('click', e => {
        let redirectUri = chrome.extension.getURL('option.html');
        this.loginUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${TWITCH_CLIENT_ID}&redirect_uri=${redirectUri}&scope=openid+user:read:email`
        window.location.href = this.loginUrl;
    })

    // logout button binding
    logoutBtn.addEventListener('click', e => {
        storageClearCredential().then(res => window.location.reload())
    })

    // form submit binding
    let optionForm = document.getElementsByClassName('option-form')[0];
    optionForm.addEventListener('submit', function (e) {
        e.preventDefault();
        let followerLoginId = e.currentTarget['follower-login-id'].value;
        if (!followerLoginId) {
            // if not data, reset configs
            storageSetPromise({
                [KEY_FOLLOWER_ID]: null,
                [KEY_FOLLOWER_LOGIN_ID]: null,
            })
            return;
        }

        // Get user id using login id and save it
        bgPage.getUserInfos([followerLoginId]).then(userInfos => {
            if (userInfos.length === 0) {
                // 등록한 아이디가 존재하지 않는 경우
                showMessage('User does not exist', 'error');
            } else {
                storageSetPromise({
                    [KEY_FOLLOWER_ID]: userInfos[0].id, // follower id
                    [KEY_FOLLOWER_LOGIN_ID]: followerLoginId
                }).then(_ => {
                    bgPage.updateLiveStream(); // update
                    showMessage('saved');
                })
            }
        })
    })
}

/**
 * show text message
 * @param message
 * @param type
 */
function showMessage(message, type = 'info') {
    let messageDiv = window.document.getElementById('message');
    messageDiv.innerText = message;
    messageDiv.className = '';
    messageDiv.classList.add(type)
    if (type !== 'error') {
        setTimeout(_ => {
            messageDiv.innerText = '';
            messageDiv.classList.remove(type)
        }, 2000)
    }
}

window.onload = function () {
    twitchLoginHandler();

    initUi();

    eventBinding();
}
