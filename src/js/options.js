import {storageSetPromise, storageGetPromise, storageClearCredential} from "./storage";
import * as constants from "./constants";
import '../css/option.css';
import {getUserInfos} from "./twitch";

/**
 * initialize option UI
 */
function initUi() {
    let followerIdInput = window.document.getElementById('follower-login-id');
    let loginBtn = window.document.getElementById('login-btn');
    let logoutBtn = window.document.getElementById('logout-btn');
    let notificationBox = window.document.getElementById('notification');

    storageGetPromise([
            constants.KEY_DARK_MODE, constants.KEY_FOLLOWER_LOGIN_ID,
            constants.KEY_FOLLOWER_ID, constants.KEY_TWITCH_TOKEN, constants.KEY_NOTIFICATION
        ])
        .then(storage => {
        // dark mode
        if (storage[constants.KEY_DARK_MODE]) {
            document.body.setAttribute('theme', 'dark');
            document.getElementById('dark-mode').checked = true;
        }

        if (storage[constants.KEY_FOLLOWER_LOGIN_ID]) followerIdInput.value = storage[constants.KEY_FOLLOWER_LOGIN_ID];

        if (storage[constants.KEY_TWITCH_TOKEN]) logoutBtn.style.display = 'block';
        else loginBtn.style.display = 'block';

        notificationBox.checked = storage[constants.KEY_NOTIFICATION];
    })
}

/**
 * EventBinding
 */
function eventBinding() {
    let loginBtn = window.document.getElementById('login-btn');
    let logoutBtn = window.document.getElementById('logout-btn');

    // login button binding
    loginBtn.addEventListener('click', e => {
        chrome.runtime.sendMessage({name: constants.EVENT_LOGIN}, ({message}) => {
            if (message === 'success') {
                window.location.reload();
            } else {
                showMessage('Login failed', 'error');
            }
        });
    })

    // logout button binding
    logoutBtn.addEventListener('click', e => {
        storageClearCredential().then(res => window.location.reload())
    })

    // form submit binding
    let optionForm = document.getElementsByClassName('option-form')[0];
    optionForm.addEventListener('submit', function (e) {
        e.preventDefault();
        storageGetPromise([constants.KEY_TWITCH_TOKEN, constants.KEY_FOLLOWER_LOGIN_ID,
            constants.KEY_NOTIFICATION, constants.KEY_DARK_MODE]).then(storage => {
            // if the token has not set, return
            if (!storage[constants.KEY_TWITCH_TOKEN]) {
                return showMessage('Login required.', 'error');
            }

            let followerLoginId = e.target['follower-login-id'].value;
            let notification = e.target['notification'].checked;
            let darkMode = e.target['dark-mode'].checked;

            storageSetPromise({
                [constants.KEY_NOTIFICATION]: notification,
                [constants.KEY_DARK_MODE]: darkMode,
            }).then(_ => {
                if (storage[constants.KEY_NOTIFICATION] !== notification) showMessage('Notification option saved');
                if (storage[constants.KEY_DARK_MODE] !== darkMode) {
                    showMessage('Dark mode option saved');
                    window.location.reload();
                }
            })

            // if not data, reset configs
            if (!followerLoginId) {
                return storageSetPromise({
                    [constants.KEY_FOLLOWER_ID]: null,
                    [constants.KEY_FOLLOWER_LOGIN_ID]: null,
                })
            }

            if (storage[constants.KEY_FOLLOWER_LOGIN_ID] !== followerLoginId) {
                // Get user id using login id and save it
                getUserInfos([followerLoginId]).then(userInfos => {
                    if (userInfos.length === 0) {
                        // 등록한 아이디가 존재하지 않는 경우
                        showMessage('User does not exist', 'error');
                    } else {
                        storageSetPromise({
                            [constants.KEY_FOLLOWER_ID]: userInfos[0].id, // follower id
                            [constants.KEY_FOLLOWER_LOGIN_ID]: followerLoginId
                        }).then(_ => {
                            chrome.runtime.sendMessage({'name': constants.EVENT_UPDATE_LIVE_STREAM});
                            showMessage('Follower ID saved');
                        })
                    }
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
    let messageContainer = window.document.getElementById('message-container');

    let messageDiv = document.createElement('p');
    messageDiv.innerText = message;
    messageDiv.className = 'message';
    messageDiv.classList.add(type)

    messageContainer.appendChild(messageDiv);
    setTimeout(_ => {
        messageDiv.remove();
    }, 5000)
}

window.onload = function () {
    initUi();
    eventBinding();
}
