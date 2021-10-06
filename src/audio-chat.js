import * as AgoraRTC from 'agora-rtc-sdk-ng'

const AGORA_TOKEN_SERVER_URL = process.env.AGORA_TOKEN_SERVER_URL || 'https://agora-token-server.onrender.com';
const AGORA_CHANNEL = process.env.AGORA_CHANNEL || 'near-lands';
const AGORA_APP_ID = process.env.AGORA_APP_ID || '09dc5426373f464086395bf30764b8ea';

/*
 *  Create an {@link https://docs.agora.io/en/Video/API%20Reference/web_ng/interfaces/iagorartcclient.html|AgoraRTCClient} instance.
 *
 * @param {string} mode - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/clientconfig.html#mode| streaming algorithm} used by Agora SDK.
 * @param  {string} codec - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/clientconfig.html#codec| client codec} used by the browser.
 */
var client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

var localTracks = {
    audioTrack: null
};

var remoteUsers = {};

var options = {
    appid: AGORA_APP_ID,
    channel: AGORA_CHANNEL,
};

async function fetchToken() {
    const res = await fetch(`${AGORA_TOKEN_SERVER_URL}/rtcToken?channelName=${encodeURIComponent(options.channel)}`);
    const { key } = await res.json();
    return key;
}

/*
 * Join a channel, then create local video and audio tracks and publish them to the channel.
 */
export async function join(accountId) {
    // Add an event listener to play remote tracks when remote user publishes.
    client.on("user-published", handleUserPublished);
    client.on("user-unpublished", handleUserUnpublished);

    // TODO: Cache token?
    options.token = await fetchToken();

    options.uid = await client.join(options.appid, options.channel, options.token || null, accountId);
}

export function isMicEnabled() {
    return localTracks.audioTrack?.enabled && !localTracks.audioTrack?.muted;
}

export async function unmuteMic() {
    if (!localTracks.audioTrack) {
        localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();

        // Publish the local video and audio tracks to the channel.
        await client.publish(Object.values(localTracks));
    } else {
        await localTracks.audioTrack.setMuted(false);
    }
}

export async function muteMic() {
    if (localTracks.audioTrack) {
        await localTracks.audioTrack.setMuted(true);
    }
}

let playbackEnabled = true;

export function isPlaybackEnabled() {
    // TODO: How best to handle partially muted (some users) vs fully muted state
    const users = Object.values(remoteUsers);
    return users.length ? users.every(user => user.audioTrack?.isPlaying) : playbackEnabled;
}

export function startPlayback() {
    playbackEnabled = true;
    Object.values(remoteUsers).forEach(user => {
        user.audioTrack.play();
    });
}

export function stopPlayback() {
    playbackEnabled = false;
    Object.values(remoteUsers).forEach(user => {
        user.audioTrack.stop();
    });
}

/*
 * Stop all local and remote tracks then leave the channel.
 */
export async function leave() {
    for (trackName in localTracks) {
        var track = localTracks[trackName];
        if (track) {
            track.stop();
            track.close();
            localTracks[trackName] = undefined;
        }
    }

    remoteUsers = {};

    await client.leave();
    console.log("client leaves channel success");
}

export async function setVolume(accountId, volume) {
    const user = remoteUsers[accountId];
    if (user?.audioTrack) {
        user.audioTrack.setVolume(volume);
    }
}

export function getInputVolume(accountId) {
    if (!accountId) {
        return localTracks?.audioTrack?.getVolumeLevel() || 0;
    }

    const user = remoteUsers[accountId];
    if (user?.audioTrack) {
        return user.audioTrack.getVolumeLevel();
    }
    return 0;
}

/*
 * Add the local use to a remote channel.
 *
 * @param  {IAgoraRTCRemoteUser} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to add.
 */
async function subscribe(user) {
    console.log('subscribe:', user);
    await client.subscribe(user, 'audio');
    console.log("subscribe success");
    user.audioTrack.play();
    // NOTE: Volume will be updated using setVolume() function above
    user.audioTrack.setVolume(0);
}

/*
 * Add a user who has subscribed to the live channel to the local interface.
 *
 * @param  {IAgoraRTCRemoteUser} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to add.
 * @param {trackMediaType - The {@link https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/itrack.html#trackmediatype | media type} to add.
 */
function handleUserPublished(user, mediaType) {
    const id = user.uid;
    remoteUsers[id] = user;
    subscribe(user, mediaType);
}

/*
 * Remove the user specified from the channel in the local interface.
 *
 * @param  {string} user - The {@link  https://docs.agora.io/en/Voice/API%20Reference/web_ng/interfaces/iagorartcremoteuser.html| remote user} to remove.
 */
function handleUserUnpublished(user) {
    const id = user.uid;
    delete remoteUsers[id];
    // user.audioTrack.stop(); ?
}
