/**
 * Get user info by user id(integer).
 * convert 'id'(int) to 'login id'(str)
 *
 * @param userId
 * @param by
 * @returns {Promise<unknown>}
 */
function getUserInfo(userId = null, by = 'login') {
    return storageGetPromise([KEY_TWITCH_TOKEN]).then(storage => {
        let qs = new URLSearchParams()
        if (Array.isArray(userId)) {
            userId.forEach(id => {
                qs.append(by, id)
            })
        } else if (userId) {
            qs.append(by, userId);
        }
        let url = `https://api.twitch.tv/helix/users?` + qs
        return fetch(url, {
            method: 'GET',
            headers: {
                "Client-ID": TWITCH_CLIENT_ID,
                "Authorization": `Bearer ${storage[KEY_TWITCH_TOKEN]}`,
            },
        }).then(res => res.json());
    });
}

/**
 * Get following user ids
 *
 * @param followerId
 * @param twitchToken
 * @returns {Promise<void>}
 */
function getFollower(followerId, twitchToken) {
    return fetch(`https://api.twitch.tv/helix/users/follows?` + new URLSearchParams({
        from_id: followerId,
        first: 100,
    }), {
        method: 'GET',
        headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${twitchToken}`,
        },
    }).then(res => res.json())
}

/**
 * Get streams that are active now
 *
 * @param userIds
 * @param twitchToken
 */
function getActiveStream(userIds, twitchToken) {
    let params = new URLSearchParams({
        first: 100,
    })
    userIds.forEach(userId => params.append('user_id', userId));

    return fetch('https://api.twitch.tv/helix/streams?' + params, {
        method: 'GET',
        headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${twitchToken}`,
        },
    }).then(res => res.json());
}

/**
 * game id to game name
 * @param gameIds
 * @param twitchToken
 */
function getGameName(gameIds, twitchToken) {
    let params = new URLSearchParams()
    gameIds.forEach(gameId => params.append('id', gameId))
    return fetch('https://api.twitch.tv/helix/games?' + params, {
        method: 'GET',
        headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${twitchToken}`,
        },
    }).then(res => res.json());
}

/**
 * Periodically check streams
 */
function updateLiveStream() {
    storageGetPromise([KEY_FOLLOWER_ID, KEY_TWITCH_TOKEN]).then(storage => {
        if (storage[KEY_FOLLOWER_ID]) {
            // get following list
            getFollower(storage[KEY_FOLLOWER_ID], storage[KEY_TWITCH_TOKEN]
            ).then(res1 => {
                let userIds = []
                res1.data.forEach(info => userIds.push(info.to_id))
                // need followee name not id
                getUserInfo(userIds, 'id').then(resUserInfo => {
                    let userNameMap = {}
                    resUserInfo.data.forEach(data => userNameMap[data.id] = data.login)
                    // get active stream in following list
                    getActiveStream(userIds, storage[KEY_TWITCH_TOKEN]
                    ).then(res2 => {
                        let gameIds = []
                        res2.data.forEach(data => {
                            gameIds.push(data.game_id)
                        })
                        // convert `game_id` to `game_name`
                        getGameName(gameIds, storage[KEY_TWITCH_TOKEN]
                        ).then(res3 => {
                            console.log(res3)
                            let gameNameMap = {}
                            res3.data.forEach(data => gameNameMap[data.id] = data.name)
                            // insert game_name to stream data
                            let liveStreams = []
                            res2.data.forEach(data => {
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
                                console.log(data)
                            });
                            // save on storage
                            storageSetPromise({
                                [KEY_LIVE_STREAM]: liveStreams,
                                [KEY_UPDATE_TS]: new Date().toISOString(),
                            }).then(res => {
                                chrome.browserAction.setBadgeBackgroundColor({color: [119, 44, 232, 255]});
                                chrome.browserAction.setBadgeText({"text": String(liveStreams.length)});
                            })
                        })
                    })
                })
            })
        }
    })
}

/**
 * onAlarm + onMessage handler
 * @param data
 */
function eventHandler(data) {
    if (data.name === EVENT_UPDATE_LIVE_STREAM) {
        updateLiveStream()
    }
}

window.onload = function () {
    chrome.alarms.create(EVENT_UPDATE_LIVE_STREAM, {
        when: 1000, // Initial execution after 1 second
        // periodInMinutes: 10, // every 10 minutes
        periodInMinutes: 3, // FIXME delete
        // periodInMinutes: 1, // FIXME delete
    })

    chrome.alarms.onAlarm.addListener(eventHandler)
    chrome.runtime.onMessage.addListener(eventHandler)
}
