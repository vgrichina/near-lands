import * as signalhub from 'signalhub'
import * as webrtcSwarm from 'webrtc-swarm'

import nacl from 'tweetnacl';
import { transactions } from 'near-api-js';
import { serialize, deserialize } from 'borsh';
import { PublicKey } from 'near-api-js/lib/utils';
import { sha256 } from 'js-sha256'

const PUBLIC_KEY_BYTES = 1 + 32;
const SIGNATURE_BYTES = PUBLIC_KEY_BYTES + 64;

const cachedPublicKeys = {};
const lastSeenNonce = {};

export async function connectP2P({ account }) {
    let { accountId, connection: { signer, provider, networkId } } = account;

    const hub = signalhub('near-lands', [
        'https://near-signalhub.onrender.com',
        // TODO: Have some fallbacks
        // TODO: Is it feasible to use chain for signaling?
    ]);

    const swarm = webrtcSwarm(hub, {
        // TODO: Tune options
    });

    // TODO: Unhardcode this
    if (accountId == 'lands.near') {
        accountId = swarm.me;
    }

    // TODO: Generate special key for unauthenticated accounts?

    // TODO: Support channel subscriptions, route messages through peers?

    let locationListeners = [];
    let peers = [];

    // TODO: Signaling between peers via signalhub

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
            const message = JSON.parse(encodedMessage);
            // console.debug('message', message);

            const keyId = `${message.accountId}::${publicKey.toString()}`;
            let accessKey = cachedPublicKeys[keyId]
            if (!accessKey) {
                accessKey = await provider.query({
                    request_type: 'view_access_key',
                    account_id: message.accountId,
                    public_key: publicKey.toString(),
                    finality: 'optimistic'
                });
                cachedPublicKeys[keyId] = accessKey;
            }

            if (!accessKey) {
                console.warn('Cannot find public key info', keyId, 'for message', message);
                return;
            }

            // TODO: Expose higher level API in near-api-js, e.g. in PublicKey
            if (!nacl.sign.detached.verify(Buffer.from(sha256.arrayBuffer(encodedMessage)), signature, publicKey.data)) {
                console.warn('Invalid signature for message', message);
                return;
            }

            if (lastSeenNonce[accountId] && lastSeenNonce[accountId] >= message.nonce) {
                console.debug('Skipping message', message, 'because old nonce');
                return;
            }
            lastSeenNonce[accountId] = message.nonce;
            for (let locationListener of locationListeners) {
                locationListener(message);
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
            send(locationData);
        }
    }
}
