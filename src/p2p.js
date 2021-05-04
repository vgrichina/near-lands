import Libp2p from 'libp2p'
import Websockets from 'libp2p-websockets'
import WebRTCStar from 'libp2p-webrtc-star'
import { NOISE } from 'libp2p-noise'
import Gossipsub from 'libp2p-gossipsub'
import Mplex from 'libp2p-mplex'
import Bootstrap from 'libp2p-bootstrap'

export async function connectP2P({ locationListener }) {
    // Create our libp2p node
    const libp2p = await Libp2p.create({
        addresses: {
            // Add the signaling server address, along with our PeerId to our multiaddrs list
            // libp2p will automatically attempt to dial to the signaling server so that it can
            // receive inbound connections from other peers
            listen: [
                '/dns4/ipfs-wrtc.onrender.com/tcp/443/wss/p2p-webrtc-star/',
                '/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star',
                '/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star'
            ]
        },
        modules: {
            transport: [Websockets, WebRTCStar],
            connEncryption: [NOISE],
            streamMuxer: [Mplex],
            peerDiscovery: [Bootstrap],
            pubsub: Gossipsub
        },
        config: {
            peerDiscovery: {
                // The `tag` property will be searched when creating the instance of your Peer Discovery service.
                // The associated object, will be passed to the service when it is instantiated.
                [Bootstrap.tag]: {
                    enabled: true,
                    list: [
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
                        '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
                    ]
                }
            }
        }
    })

    function log(txt) {
        console.info(txt)
    }

    // Listen for new peers
    libp2p.on('peer:discovery', (peerId) => {
        log(`Found peer ${peerId.toB58String()}`)
    })

    // Listen for new connections to peers
    libp2p.connectionManager.on('peer:connect', (connection) => {
        log(`Connected to ${connection.remotePeer.toB58String()}`)
    })

    // Listen for peers disconnecting
    libp2p.connectionManager.on('peer:disconnect', (connection) => {
        log(`Disconnected from ${connection.remotePeer.toB58String()}`)
    })

    await libp2p.start();
    log(`libp2p id is ${libp2p.peerId.toB58String()}`);


    // TODO: Some more robust solution
    // NOTE: This just waits until peers are hopefully connected
    await new Promise((resolve) => setTimeout(resolve, 5000));

    libp2p.pubsub.subscribe('location');
    libp2p.pubsub.on('location', ({ from, data }) => {
        data = new TextDecoder().decode(data);
        log(`#location ${from}: ${data}`);
        if (locationListener) {
            locationListener({ ...JSON.parse(data), from });
        }
    });

    // Export libp2p to the window so you can play with the API
    window.libp2p = libp2p

    return {
        libp2p,
        publishLocation({ x, y }) {
            libp2p.pubsub.publish('location', new TextEncoder().encode(JSON.stringify({ x, y })));
        }
    }
}
