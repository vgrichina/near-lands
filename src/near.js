import { connect, WalletConnection, keyStores, Contract, Account } from 'near-api-js';

const config = require('./config')(process.env.NODE_ENV);
export const CONTRACT_NAME = config.contractName;

export async function connectNear() {
    const APP_KEY_PREFIX = 'near-lands:'
    const near = await connect({
        ...config,
        // NOTE: Workaround needed for previously logged in users
        networkId: config.networkId == 'mainnet' ? 'default' : config.networkId,
        keyStore: new keyStores.BrowserLocalStorageKeyStore(window.localStorage, APP_KEY_PREFIX)
    })
    const walletConnection = new WalletConnection(near, APP_KEY_PREFIX)

    let account;
    if (walletConnection.isSignedIn()) {
        account = walletConnection.account();
    } else {
        account = new Account(near.connection, config.contractName);
    }

    const contract = new Contract(account, config.contractName, {
        changeMethods: ["setTiles"],
        sender: account.accountId
    });

    const result = { near, walletConnection, account, contract };
    Object.assign(window, result);
    return result;
}

