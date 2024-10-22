import { InMemorySigner, KeyPair, keyStores } from 'near-api-js';
import Cookies from 'js-cookie'

const config = require('./config')(process.env.NODE_ENV);
console.log('config', config);
export const CONTRACT_NAME = config.contractName;

export const networkId = config.networkId;

export function isSignedIn() {
    console.log('isSignedIn', Cookies.get('web4_account_id'));
    return !!Cookies.get('web4_account_id');
}

export function getAccountId() {
    console.log('getAccountId', Cookies.get('web4_account_id'));
    return Cookies.get('web4_account_id') || CONTRACT_NAME;
}

export function getSigner() {
    const keyStore = new keyStores.InMemoryKeyStore();
    // TODO: Handle no key for logged in users
    let privateKey = isSignedIn() ? Cookies.get('web4_private_key') : localStorage.getItem('anon_private_key');
    if (!privateKey) {
        privateKey = KeyPair.fromRandom('ed25519').toString();
        localStorage.setItem('anon_private_key', privateKey);
    }
    keyStore.setKey(networkId, getAccountId(), KeyPair.fromString(privateKey));
    return new InMemorySigner(keyStore);
}