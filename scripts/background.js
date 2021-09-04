/**
 * Call twitch api
 *
 * @param url
 * @param qs
 * @param twitchToken
 * @param method
 * @returns {Promise<Response | void>}
 */
function request(url, qs = '', twitchToken = '', method = 'GET') {
    url = qs ? `${url}?${qs}` : url
    return fetch(url, {
        method,
        headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${twitchToken}`,
        },
    }).then(res => {
        if (res.status === 401) {
            storageClearCredential();
            chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 255]});
            chrome.browserAction.setBadgeText({"text": '!'});
        }
        return res.json();
    }).catch(e => {
        console.error(e)
    });
}

/**
 * Get multiple user's info by user id(integer).
 * convert 'id'(int) to 'login id'(str)
 *
 * @param userIds
 * @param by
 * @returns {Promise<Array>}
 */
function getUserInfos(userIds = null, by = 'login') {
    let qss = [];
    if (userIds) {
        for (let i = 0; i < Math.ceil(userIds.length / 100); i++) {
            let qs = new URLSearchParams()
            userIds.slice(100 * i, 100 * (i + 1)).forEach(id => qs.append(by, id.trim()))
            qss.push(qs)
        }
    } else {
        qss.push(null)
    }

    return storageGetPromise([KEY_TWITCH_TOKEN]).then(storage => {
        let url = 'https://api.twitch.tv/helix/users';

        let requests = []
        qss.forEach(qs => requests.push(request(url, qs, storage[KEY_TWITCH_TOKEN])))
        return Promise.all(requests).then(values => {
            let res = {'data': []}
            values.forEach(r => res.data = res.data.concat(r.data));
            return res.data
        });
    });
}

/**
 * Get my info
 * @returns {Promise<Array>}
 */
function getMyInfo() {
    return getUserInfos(null)
}

/**
 * Get following user ids
 *
 * @param followerId
 * @param twitchToken
 * @param cursor
 * @param data: concatenated response
 * @returns {Promise<Array>}
 */
function getFollower(followerId, twitchToken, cursor = null, data = []) {
    /*
    {
     data: [{from_id: <String>, from_name: <String>, to_id: <String>, to_name: <String>, followed_at: <String>}, <String>],
     pagination: {cursor: <String>},
     total: <Number>
    }
     */
    let url = 'https://api.twitch.tv/helix/users/follows'
    let qs = new URLSearchParams({
        from_id: followerId,
        first: '100',
    })
    cursor && qs.set('after', cursor) // pagination cursor

    return request(url, qs, twitchToken).then(res => {
        data = data.concat(res.data)
        if (String(res.data.length) === qs.get('first') && res.pagination.hasOwnProperty('cursor')) {
            return getFollower(followerId, twitchToken, res.pagination.cursor, data)
        } else {
            return data;
        }
    });
}

/**
 * Get streams that are active now
 *
 * @param userIds
 * @param twitchToken
 * @param cursor
 * @param data: concatenated response
 * @returns {Promise<Array>}
 */
function getActiveStream(userIds, twitchToken, cursor = null, data = []) {
    let url = 'https://api.twitch.tv/helix/streams'
    let qss = [];
    for (let i = 0; i < Math.ceil(userIds.length / 100); i++) {
        let qs = new URLSearchParams()
        userIds.slice(100 * i, 100 * (i + 1)).forEach(id => qs.append('user_id', id.trim()));
        qss.push(qs);
    }

    let requests = []
    qss.forEach(qs => requests.push(request(url, qs, twitchToken)))
    return Promise.all(requests).then(values => {
        let res = {'data': []};
        values.forEach(r => res.data = res.data.concat(r.data));
        return res.data;
    });
}

/**
 * game id to game name
 * @param gameIds
 * @param twitchToken
 * @returns {Promise<Object>}
 */
function getGameName(gameIds, twitchToken) {
    let url = 'https://api.twitch.tv/helix/games'
    let qs = new URLSearchParams();
    gameIds.forEach(gameId => qs.append('id', gameId));
    return request(url, qs, twitchToken).then(res => res.data);
}

/**
 * Periodically check streams
 */
function updateLiveStream() {
    storageGetPromise([KEY_FOLLOWER_ID, KEY_TWITCH_TOKEN]).then(storage => {
        if (storage[KEY_TWITCH_TOKEN] && storage[KEY_FOLLOWER_ID]) {
            // get following list
            getFollower(storage[KEY_FOLLOWER_ID], storage[KEY_TWITCH_TOKEN]
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
                    getActiveStream(userIds, storage[KEY_TWITCH_TOKEN]
                    ).then(streamInfos => {
                        // if no one is streaming, return
                        if (!streamInfos.length) return _setLiveStream([]);

                        let gameIds = [];
                        streamInfos.filter(info => info.type === 'live').forEach(data => gameIds.push(data.game_id));

                        // convert `game_id` to `game_name`
                        getGameName(gameIds, storage[KEY_TWITCH_TOKEN]
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
    storageGetPromise([KEY_LIVE_STREAM, KEY_UPDATE_TS]).then(storage => {
        // check new streams
        let prevUserLogin = (storage[KEY_LIVE_STREAM] || []).map(item => item.user_name);
        let currUserLogin = liveStreams.map(item => item.user_name);
        let newStreams = []
        currUserLogin.forEach(userLogin => {
            if (!prevUserLogin.includes(userLogin)) {
                newStreams.push(userLogin)
            }
        })
        // chrome noti if new streams
        if (newStreams.length) notifyNewStream(newStreams, storage[KEY_UPDATE_TS]);

        // save
        storageSetPromise({
            [KEY_LIVE_STREAM]: liveStreams,
            [KEY_UPDATE_TS]: new Date().toISOString(),
        }).then(_ => {
            chrome.browserAction.setBadgeBackgroundColor({color: [141, 75, 255, 255]});
            chrome.browserAction.setBadgeText({"text": String(liveStreams.length)});
            chrome.runtime.sendMessage({'name': EVENT_REFRESHED});
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
    if (parseInt(diff_ms / 1000 / 60) <= REFRESH_INTERVAL_MIN * 2) {
        let message = `${foo} is streaming.`
        notify(message);
    }
}

/**
 * @param {String} message
 */
function notify(message) {
    storageGetPromise([KEY_NOTIFICATION]).then(storage => {
        if (storage[KEY_NOTIFICATION]) {
            chrome.notifications.create({
                type: "basic",
                title: "New live stream",
                message: message,
                iconUrl: "/images/icon_128.png",
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
    let urlHash = redirectUri.split('#')[1]
    if (urlHash) {
        let params = new URLSearchParams(urlHash);
        let access_token = params.get('access_token')
        if (access_token) {
            // save access token
            await storageSetPromise({[KEY_TWITCH_TOKEN]: access_token})

            // get follower config
            let storage = await storageGetPromise([KEY_FOLLOWER_ID, KEY_FOLLOWER_LOGIN_ID])

            // if follower id is not configured, set my account's info
            if (!storage[KEY_FOLLOWER_ID] || !storage[KEY_FOLLOWER_LOGIN_ID]) {
                // set initial data using user's information
                let userInfos = await getMyInfo()

                await storageSetPromise({
                    [KEY_FOLLOWER_ID]: userInfos[0].id,
                    [KEY_FOLLOWER_LOGIN_ID]: userInfos[0].login,
                })
            }
            chrome.runtime.sendMessage({'name': EVENT_UPDATE_LIVE_STREAM});
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
    if (message.name === EVENT_UPDATE_LIVE_STREAM) {
        updateLiveStream();
    } else if (message.name === EVENT_LOGIN) {
        let redirectUri = encodeURI(`https://${EXTENSION_ID}.chromiumapp.org`);
        let twitchOauthUrl = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${TWITCH_CLIENT_ID}&redirect_uri=${redirectUri}&scope=openid+user:read:email`
        chrome.identity.launchWebAuthFlow({
            url: twitchOauthUrl,
            interactive: true
        }, function (redirectUri) {
            twitchLoginHandler(redirectUri, sendResponse)
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
            storageGetPromise([KEY_LIVE_STREAM, KEY_NOTIFICATION]).then(storage => {
                let defaultStorage = {}
                if (!storage[KEY_LIVE_STREAM]) defaultStorage[KEY_LIVE_STREAM] = [];
                if (!storage[KEY_NOTIFICATION]) defaultStorage[KEY_NOTIFICATION] = false;

                storageSetPromise(defaultStorage);
            })
        }
    })
}

window.onload = function () {
    onInstall();

    chrome.alarms.create(EVENT_UPDATE_LIVE_STREAM, {
        when: 1000, // Initial execution after 1 second
        periodInMinutes: REFRESH_INTERVAL_MIN, // every n minutes
    })

    chrome.alarms.onAlarm.addListener(eventHandler);
    chrome.runtime.onMessage.addListener(eventHandler);
}
