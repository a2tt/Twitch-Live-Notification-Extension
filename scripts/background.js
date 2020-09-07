/**
 * Get user info by user id(integer).
 * convert 'id'(int) to 'login id'(str)
 *
 * @param userId
 * @returns {Promise<unknown>}
 */
function getUserInfo(userId) {
    return storageGetPromise([KEY_TWITCH_TOKEN]).then(storage => {
        return fetch(`https://api.twitch.tv/helix/users?` + new URLSearchParams({
            login: userId,
        }), {
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
 * Periodically check streams
 */
function updateLiveStream() {
    storageGetPromise([KEY_FOLLOWER_ID, KEY_TWITCH_TOKEN]).then(storage => {
        if (storage[KEY_FOLLOWER_ID]) {
            getFollower(storage[KEY_FOLLOWER_ID], storage[KEY_TWITCH_TOKEN]
            ).then(res1 => {
                let userIds = []
                res1.data.forEach(info => userIds.push(info.to_id))
                getActiveStream(userIds, storage[KEY_TWITCH_TOKEN]
                ).then(res2 => {
                    let foo = []
                    res2.data.forEach(data => {
                        console.log(data)
                        foo.push(data);
                    });

                    chrome.browserAction.setBadgeBackgroundColor({color: [119, 44, 232, 255]});
                    chrome.browserAction.setBadgeText({"text": String(foo.length)});
                })
            })
        }
    })
}

window.onload = function () {
    let alarmName = 'updateLiveStream'

    chrome.alarms.create(alarmName, {
        when: 1000, // Initial execution after 1 second
        // periodInMinutes: 10, // every 10 minutes
        periodInMinutes: 1, // FIXME delete
    })

    chrome.alarms.onAlarm.addListener(function (alarm) {
        if (alarm.name === alarmName) {
            updateLiveStream()
        }
    })
}
