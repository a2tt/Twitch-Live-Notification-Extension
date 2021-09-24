import {storageGetPromise, storageSetPromise} from "./storage";
import * as constants from './constants';
import {getActiveStream, getFollower, getGameName, getMyInfo, getUserInfos} from "./twitch";

/**
 * Periodically check streams
 */
function updateLiveStream() {
    storageGetPromise([constants.KEY_FOLLOWER_ID, constants.KEY_TWITCH_TOKEN]).then(storage => {
        if (storage[constants.KEY_TWITCH_TOKEN] && storage[constants.KEY_FOLLOWER_ID]) {
            // get following list
            getFollower(storage[constants.KEY_FOLLOWER_ID], storage[constants.KEY_TWITCH_TOKEN]
            ).then(followingUsers => {
                // if following no one, return
                if (!followingUsers.length)
                    return _setLiveStream([]);
                let userIds = [];
                followingUsers.forEach(info => userIds.push(info.to_id));

                // convert followee id to login_id
                getUserInfos(userIds, 'id').then(userInfos => {
                    let userNameMap = {};
                    userInfos.forEach(data => userNameMap[data.id] = data.login);

                    // get active stream in following list
                    getActiveStream(userIds, storage[constants.KEY_TWITCH_TOKEN]
                    ).then(streamInfos => {
                        // if no one is streaming, return
                        if (!streamInfos.length) return _setLiveStream([]);

                        let gameIds = [];
                        streamInfos.filter(info => info.type === 'live').forEach(data => gameIds.push(data.game_id));

                        // convert `game_id` to `game_name`
                        getGameName(gameIds, storage[constants.KEY_TWITCH_TOKEN]
                        ).then(gameInfo => {
                            let gameNameMap = {};
                            gameInfo.forEach(data => gameNameMap[data.id] = data.name);
                            // insert game_name to stream data
                            let liveStreams = [];
                            streamInfos.forEach(data => {
                                data.game_name = gameNameMap.hasOwnProperty(data.game_id) ? gameNameMap[data.game_id] : ''
                                liveStreams.push({
                                    user_name: data.user_name,
                                    user_login: userNameMap[data.user_id],
                                    user_id: data.user_id,
                                    game_name: data.game_name,
                                    title: data.title,
                                    type: data.type,
                                    viewer_count: data.viewer_count,
                                });
                            });
                            liveStreams.sort((a, b) => a.viewer_count < b.viewer_count ? 1 : -1)
                            _setLiveStream(liveStreams);
                        })
                    })
                })
            })
        } else {
            chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 255]});
            chrome.browserAction.setBadgeText({"text": '!'});
        }
    })
}

/**
 *
 * @param liveStreams
 * @private
 */
function _setLiveStream(liveStreams) {
    // save on storage
    storageGetPromise([constants.KEY_LIVE_STREAM, constants.KEY_UPDATE_TS]).then(storage => {
        // check new streams
        let prevUserLogin = (storage[constants.KEY_LIVE_STREAM] || []).map(item => item.user_name);
        let currUserLogin = liveStreams.map(item => item.user_name);
        let newStreams = []
        currUserLogin.forEach(userLogin => {
            if (!prevUserLogin.includes(userLogin)) {
                newStreams.push(userLogin)
            }
        })
        // chrome noti if new streams
        if (newStreams.length) notifyNewStream(newStreams, storage[constants.KEY_UPDATE_TS]);

        // save
        storageSetPromise({
            [constants.KEY_LIVE_STREAM]: liveStreams,
            [constants.KEY_UPDATE_TS]: new Date().toISOString(),
        }).then(_ => {
            chrome.browserAction.setBadgeBackgroundColor({color: [141, 75, 255, 255]});
            chrome.browserAction.setBadgeText({"text": String(liveStreams.length)});
            chrome.runtime.sendMessage({'name': constants.EVENT_REFRESHED});
        })
    })
}

/**
 * @param {Array} newStreams
 * @param {String} prevUpdatedAt
 */
function notifyNewStream(newStreams, prevUpdatedAt) {
    const LIMIT = 4;
    let prev = new Date(prevUpdatedAt);
    let diff_ms = (new Date()) - prev;

    let tempMessage = newStreams.slice(0, LIMIT).join(', ');
    let foo = newStreams.length >= LIMIT ? tempMessage + ' ...' : tempMessage;
    // 연속해서 체크한 경우만. 브라우저를 새로 키는 등의 상황 제외
    if (parseInt(diff_ms / 1000 / 60) <= constants.REFRESH_INTERVAL_MIN * 2) {
        let message = `${foo} is streaming.`
        notify(message);
    }
}

/**
 * @param {String} message
 */
function notify(message) {
    storageGetPromise([constants.KEY_NOTIFICATION]).then(storage => {
        if (storage[constants.KEY_NOTIFICATION]) {
            chrome.notifications.create({
                type: "basic",
                title: "New live stream",
                message: message,
                iconUrl: "/img/icon_128.png",
            });
        }
    })
}

/**
 * On twitch login and redirected, set access_token from url hash
 * @param {String} redirectUri: redirected uri after twitch login (ex. <scheme>://<domain>/<path>#access_token=...)
 * @param {chrome.runtime.sendMessage} sendResponse:
 * @returns {void}
 */
async function twitchLoginHandler(redirectUri, sendResponse) {
    // 로그인 처리 후, 데이터 저장
    let urlHash = redirectUri && redirectUri.split('#')[1]
    if (urlHash) {
        let params = new URLSearchParams(urlHash);
        let access_token = params.get('access_token')
        if (access_token) {
            // save access token
            await storageSetPromise({[constants.KEY_TWITCH_TOKEN]: access_token})

            // get follower config
            let storage = await storageGetPromise([constants.KEY_FOLLOWER_ID, constants.KEY_FOLLOWER_LOGIN_ID])

            // if follower id is not configured, set my account's info
            if (!storage[constants.KEY_FOLLOWER_ID] || !storage[constants.KEY_FOLLOWER_LOGIN_ID]) {
                // set initial data using user's information
                let userInfos = await getMyInfo()

                await storageSetPromise({
                    [constants.KEY_FOLLOWER_ID]: userInfos[0].id,
                    [constants.KEY_FOLLOWER_LOGIN_ID]: userInfos[0].login,
                })
            }
            chrome.runtime.sendMessage({'name': constants.EVENT_UPDATE_LIVE_STREAM});
            sendResponse({message: 'success'})
        }
    } else {
        sendResponse({message: 'fail'})
    }
}


/**
 * onAlarm + onMessage handler
 * @param message
 * @param sender
 * @param sendResponse
 */
function eventHandler(message, sender, sendResponse) {
    if (message.name === constants.EVENT_UPDATE_LIVE_STREAM) {
        updateLiveStream();
    } else if (message.name === constants.EVENT_LOGIN) {
        let redirectUri = encodeURI(`https://${constants.EXTENSION_ID}.chromiumapp.org`);
        let twitchOauthUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${constants.TWITCH_CLIENT_ID}&redirect_uri=${redirectUri}&scope=openid+user:read:email`
        chrome.identity.launchWebAuthFlow({
            url: twitchOauthUrl,
            interactive: true
        }, async function (redirectUri) {
            await twitchLoginHandler(redirectUri, sendResponse)
        });
    }
    return true;
}

/**
 * Set storage on install or on update
 */
function onInstall() {
    chrome.runtime.onInstalled.addListener(details => {
        if (details.reason === "install") {
            storageGetPromise([constants.KEY_LIVE_STREAM, constants.KEY_NOTIFICATION]).then(storage => {
                let defaultStorage = {}
                if (!storage[constants.KEY_LIVE_STREAM]) defaultStorage[constants.KEY_LIVE_STREAM] = [];
                if (!storage[constants.KEY_NOTIFICATION]) defaultStorage[constants.KEY_NOTIFICATION] = false;

                storageSetPromise(defaultStorage);
            })
        }
    })
}

window.onload = function () {
    onInstall();

    chrome.alarms.create(constants.EVENT_UPDATE_LIVE_STREAM, {
        when: 1000, // Initial execution after 1 second
        periodInMinutes: constants.REFRESH_INTERVAL_MIN, // every n minutes
    })

    chrome.alarms.onAlarm.addListener(eventHandler);
    chrome.runtime.onMessage.addListener(eventHandler);
}
