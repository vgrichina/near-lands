import { connect, keyStores, Contract, Account } from 'near-api-js';

import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupNearWallet } from "@near-wallet-selector/near-wallet";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupMathWallet } from "@near-wallet-selector/math-wallet";
import { setupNightly } from "@near-wallet-selector/nightly";
// import { setupLedger } from "@near-wallet-selector/ledger";
import { setupWalletConnect } from "@near-wallet-selector/wallet-connect";
// import { setupNightlyConnect } from "@near-wallet-selector/nightly-connect";

const config = require('./config')(process.env.NODE_ENV);
export const CONTRACT_NAME = config.contractName;

export async function connectNear() {
    const selector = await setupWalletSelector({
        network: config.networkId,
        modules: [
            setupNearWallet(),
            setupMyNearWallet(),
            setupSender(),
            setupMathWallet(),
            setupNightly(),
            // setupLedger(),
            setupWalletConnect({
                projectId: "c4f79cc...",
                metadata: {
                    name: "NEAR Wallet Selector",
                    description: "Example dApp used by NEAR Wallet Selector",
                    url: "https://github.com/near/wallet-selector",
                    icons: ["https://avatars.githubusercontent.com/u/37784886"],
                },
            }),
            // setupNightlyConnect({
            //     url: "wss://ncproxy.nightly.app/app",
            //     appMetadata: {
            //         additionalInfo: "",
            //         application: "NEAR Wallet Selector",
            //         description: "Example dApp used by NEAR Wallet Selector",
            //         icon: "https://near.org/wp-content/uploads/2020/09/cropped-favicon-192x192.png",
            //     },
            // }),
        ],
    });

    const modal = setupModal(selector, {
        contractId: CONTRACT_NAME
    });

    const result = { selector, modal };
    Object.assign(window, result);
    return result;
}

let selector = null;
const connectPromise = connectNear();
connectPromise.then((result) => {({ selector } = result)});

export async function login() {
    const { modal } = await connectPromise;
    modal.show();
}

export async function logout() {
    const { selector } = await connectPromise;
    const wallet = await selector.wallet();
    await wallet.signOut();
    window.location.reload();
}

export async function getWalletSelector() {
    const { selector } = await connectPromise;
    return selector;
}

export async function getWallet() {
    const { selector } = await connectPromise;
    return await selector.wallet();
}

export function isSignedIn() {
    // TODO: Is getStore fast enough?
    if (selector) {
        const { accounts } = selector.store.getState();
        return !!accounts.find(account => account.active);
    }

    return false;
}

export function getAccountId() {
    if (selector) {
        const { accounts } = selector.store.getState();
        const activeAccount = accounts.find(account => account.active);
        if (activeAccount) {
            return activeAccount.accountId;
        }
    }

    return CONTRACT_NAME;
}

