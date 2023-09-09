import { storageClearCredential, storageGetPromise } from "./storage";
import * as constants from "./constants";

/**
 * Call twitch api
 *
 * @param url
 * @param qs
 * @param twitchToken
 * @param method
 * @returns {Promise<Response | void>}
 */
export function request(url, qs = '', twitchToken = '', method = 'GET') {
    url = qs ? `${url}?${qs}` : url
    return fetch(url, {
        method,
        headers: {
            "Client-ID": constants.TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${twitchToken}`,
        },
    }).then(res => {
        if (res.status === 401) {
            storageClearCredential();
            chrome.action.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });
            chrome.action.setBadgeText({ "text": '!' });
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
export function getUserInfos(userIds = null, by = 'login') {
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

    return storageGetPromise([constants.KEY_TWITCH_TOKEN]).then(storage => {
        let url = 'https://api.twitch.tv/helix/users';

        let requests = []
        qss.forEach(qs => requests.push(request(url, qs, storage[constants.KEY_TWITCH_TOKEN])))
        return Promise.all(requests).then(values => {
            let res = { 'data': [] }
            values.forEach(r => res.data = res.data.concat(r.data));
            return res.data
        });
    });
}

/**
 * Get my info
 * @returns {Promise<Array>}
 */
export function getMyInfo() {
    return getUserInfos(null)
}

/**
 * Get following channels of ``followerId``.
 * 
 * @param {String} followerId
 * @param {String} twitchToken
 * @param {String} cursor
 * @param {Array} data
 */
export function getFollowingChannels(followerId, twitchToken, cursor = null, data = []) {
    /*
    {
        data: {
            broadcaster_id: <string>,
            broadcaster_login: <string>,
            broadcaster_name: <string>,
            followed_at: <string>
        }
    }
    */
    const url = 'https://api.twitch.tv/helix/channels/followed'
    const qs = new URLSearchParams({
        user_id: followerId,
        first: 100,
    })
    cursor && qs.set('after', cursor) // pagination cursor

    return request(url, qs, twitchToken).then(res => {
        data = data.concat(res.data)
        if (String(res.data.length) === qs.get('first') && res.pagination.hasOwnProperty('cursor')) {
            return getFollowingChannels(followerId, twitchToken, res.pagination.cursor, data)
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
export function getActiveStream(userIds, twitchToken, cursor = null, data = []) {
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
        let res = { 'data': [] };
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
export function getGameName(gameIds, twitchToken) {
    let url = 'https://api.twitch.tv/helix/games'
    let qs = new URLSearchParams();
    gameIds.forEach(gameId => qs.append('id', gameId));
    return request(url, qs, twitchToken).then(res => res.data);
}
