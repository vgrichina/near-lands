import { connect, WalletConnection, keyStores, Contract, Account, transactions, utils } from 'near-api-js';
const { addKey, deleteKey, functionCallAccessKey } = transactions;
import BN from 'bn.js'

const CONTRACT_NAME = 'lands.near';
const DESIRED_ALLOWANCE = new BN(utils.format.parseNearAmount('0.5'));

export async function connectNear() {
    const APP_KEY_PREFIX = 'near-lands:'
    const near = await connect({
        nodeUrl: 'https://rpc.mainnet.near.org',
        walletUrl: 'https://wallet.near.org',
        networkId: 'default',
        keyStore: new keyStores.BrowserLocalStorageKeyStore(window.localStorage, APP_KEY_PREFIX)
    })
    const walletConnection = new WalletConnection(near, APP_KEY_PREFIX)

    let account;
    if (walletConnection.isSignedIn()) {
        account = walletConnection.account();
    } else {
        account = new Account(near.connection, CONTRACT_NAME);
    }

    const contract = new Contract(account, CONTRACT_NAME, {
        viewMethods: ["getMap", "getChunk", "getPeerId", "getAccountId"],
        changeMethods: ["setTiles", "setPeerId"],
        sender: account.accountId
    });

    const result = { near, walletConnection, account, contract };
    Object.assign(window, result);
    return result;
}

export async function updateAccessKeyIfNeeded(account, e) {
    if (e.type == 'NotEnoughAllowance') {
        const { accountId, connection } = account;
        const publicKey = await connection.signer.getPublicKey(accountId, connection.networkId);
        console.log('publicKey', publicKey);
        await account.signAndSendTransaction(accountId, [
            deleteKey(publicKey),
            addKey(publicKey, functionCallAccessKey(CONTRACT_NAME, [], DESIRED_ALLOWANCE))
        ]);
    }
}