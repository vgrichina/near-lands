import * as signalhub from 'signalhub'
import * as webrtcSwarm from 'webrtc-swarm'
import * as ed from 'noble-ed25519';

import { transactions, utils } from 'near-api-js';
import { serialize, deserialize } from 'borsh';
import { PublicKey } from 'near-api-js/lib/utils';
import { sha256 } from 'js-sha256'

import { CONTRACT_NAME } from './near'; 

const PUBLIC_KEY_BYTES = 1 + 32;
const SIGNATURE_BYTES = PUBLIC_KEY_BYTES + 64;

const MAX_PEERS = 7;
const GOSSIP_PEERS = 3;

const MAX_SEND_PAUSE_MS = 3000;

const cachedHasMatchingKey = {};
const lastSeenNonce = {};

let lastSendTime;
let lastLocationData;

export async function connectP2P({ account }) {
    let { accountId, connection: { signer, provider, networkId } } = account;

    const hub = signalhub('near-lands', [
        'https://signalhub.humanguild.io',
        // TODO: Have some fallbacks
    ]);

    const swarm = webrtcSwarm(hub, {
        maxPeers: MAX_PEERS,
        // TODO: Tune options
    });

    function guestAccountIdFromPublicKey(publicKey) {
        const pubKeySuffix = Buffer.from(publicKey.data).slice(16).toString('hex');
        return `guest:${pubKeySuffix}`;
    }

    /**
     * Shuffles array in place. ES6 version
     * @param {Array} a items An array containing the items.
     */
    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function sampleGossipPeers(peers) {
        peers = [...peers];
        shuffle(peers);
        return peers.slice(0, GOSSIP_PEERS);
    }

    if (accountId == CONTRACT_NAME) {
        accountId = localStorage.getItem('p2p:guest-account');
        const { keyStore } = signer;
        if (!accountId || !(await keyStore.getKey(networkId, accountId))) {
            // Generate special key for unauthenticated accounts
            const keyPair = utils.KeyPair.fromRandom('ed25519');
            accountId = guestAccountIdFromPublicKey(keyPair.publicKey);
            await keyStore.setKey(networkId, accountId, keyPair);
            localStorage.setItem('p2p:guest-account', accountId)
        }
    }


    // TODO: Support channel subscriptions, route messages through peers?

    let locationListeners = [];
    let peers = [];

    swarm.on('peer', (peer, id) => {
        console.debug('peer connected', peer, id);
        peers.push(peer);

        peer.on('close', () => {
            console.debug('close', peer);
            const index = peers.indexOf(peer);
            if (index >= 0) {
                peers.splice(index, 1);
            } else {
                console.warn(`couldn't find peer`, peer);
            }
        });

        peer.on('data', async data => {
            // console.debug('data', peer, data);
            const signedMessage = Buffer.from(data);
            const signatureWithKey = signedMessage.slice(0, SIGNATURE_BYTES);
            const publicKey = deserialize(transactions.SCHEMA, PublicKey, signatureWithKey.slice(0, PUBLIC_KEY_BYTES));
            const signature = signatureWithKey.slice(PUBLIC_KEY_BYTES);
            const encodedMessage = signedMessage.slice(SIGNATURE_BYTES);
            let message;
            try {
                message = JSON.parse(encodedMessage);
                // console.debug('message', message);
            } catch (e) {
                console.warn('Error parsing message', encodedMessage.toString('utf8'));
                return;
            }

            const keyId = `${message.accountId}::${publicKey.toString()}`;
            let hasMatchingKey = cachedHasMatchingKey[keyId];
            if (!hasMatchingKey) {
                if (message.accountId.startsWith('guest:')) {
                    hasMatchingKey = (guestAccountIdFromPublicKey(publicKey) == message.accountId);
                } else {
                    hasMatchingKey = !!(await provider.query({
                        request_type: 'view_access_key',
                        account_id: message.accountId,
                        public_key: publicKey.toString(),
                        finality: 'optimistic'
                    }));
                }
                cachedHasMatchingKey[keyId] = hasMatchingKey;
            }

            if (message.accountId == accountId) {
                console.warn('Skipping message for self');
                return;
            }

            if (!hasMatchingKey) {
                console.warn('Cannot find public key info', keyId, 'for message', message);
                return;
            }

            // TODO: Expose higher level API in near-api-js, e.g. in PublicKey
            if (!ed.verify(Buffer.from(signature), Buffer.from(sha256.arrayBuffer(encodedMessage)), publicKey.data)) {
                console.warn('Invalid signature for message', message);
                return;
            }

            if (lastSeenNonce[message.accountId] && lastSeenNonce[message.accountId] >= message.nonce) {
                // console.debug('Skipping message', message, 'because old nonce');
                return;
            }
            lastSeenNonce[message.accountId] = message.nonce;
            for (let locationListener of locationListeners) {
                locationListener(message);
            }

            for (let peer of sampleGossipPeers(peers)) {
                peer.send(signedMessage);
            }
        })
    });

    async function send(message) {
        // console.debug('send', message);
        const encodedMessage = Buffer.from(JSON.stringify({
            accountId,
            nonce: Date.now(),
            ...message
        }));
        const { publicKey, signature } = await signer.signMessage(encodedMessage, accountId, networkId);
        const signedMessage = Buffer.concat([
            serialize(transactions.SCHEMA, publicKey),
            signature,
            encodedMessage
        ]);
        for (let peer of peers) {
            peer.send(signedMessage);
        }
    }

    return {
        swarm,
        subscribeToLocation(locationListener) {
            locationListeners.push(locationListener);
        },
        publishLocation(locationData) {
            // console.debug('publishLocation');
            const updatedLocationData = JSON.stringify(locationData) != JSON.stringify(lastLocationData);
            if (updatedLocationData || !lastSendTime || lastSendTime < Date.now() - MAX_SEND_PAUSE_MS) {
                lastSendTime = Date.now();
                lastLocationData = locationData;
                send(locationData);
            }
        }
    }
}
