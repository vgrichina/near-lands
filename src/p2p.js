import * as signalhub from 'signalhub'
import * as webrtcSwarm from 'webrtc-swarm'

export async function connectP2P({ accountId }) {
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

    // TODO: Sign and verify

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

        peer.on('data', data => {  
            // console.debug('data', peer, data);
            const message = JSON.parse(Buffer.from(data));
            // console.debug('message', message);

            for (let locationListener of locationListeners) {
                locationListener(message);
            }
        })
    });

    function send(message) {
        // console.debug('send', message);
        for (let peer of peers) {
            peer.send(JSON.stringify(message));
        }
    }

    return {
        swarm,
        subscribeToLocation(locationListener) {
            locationListeners.push(locationListener);
        },
        publishLocation(locationData) {
            // console.debug('publishLocation');
            send({ accountId, ...locationData });
        }
    }
}
