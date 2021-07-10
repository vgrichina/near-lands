import { connect, WalletConnection, keyStores, Contract, Account } from 'near-api-js';

export const CONTRACT_NAME = 'lands.near';

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
        viewMethods: ["getChunk", "getParcelNonces", "getPeerId", "getAccountId"],
        changeMethods: ["setTiles", "setPeerId"],
        sender: account.accountId
    });

    const result = { near, walletConnection, account, contract };
    Object.assign(window, result);
    return result;
}

