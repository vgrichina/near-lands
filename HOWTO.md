# How to use NEAR in a game

## How to login with NEAR

Configure connection to NEAR blockchain:

```js
const APP_KEY_PREFIX = 'near-lands:'
const near = await connect({
    nodeUrl: 'https://rpc.mainnet.near.org',
    walletUrl: 'https://wallet.near.org',
    networkId: 'default',
    // Specify where to store the signing keys
    keyStore: new keyStores.BrowserLocalStorageKeyStore(window.localStorage, APP_KEY_PREFIX)
})
```

Get current user account:

```js
const walletConnection = new WalletConnection(near, APP_KEY_PREFIX)
let account;
if (walletConnection.isSignedIn()) {
    // Logged in account, can write as user signed up through wallet
    account = walletConnection.account();
} else {
    // Contract account, normally only gonna work in read only mode
    account = new Account(near.connection, CONTRACT_NAME);
}
```

## How to store game state on NEAR

### Smart contracts

Blockchain state is managed by smart contracts: https://docs.near.org/docs/develop/contracts/overview
User can submit function call transactions which are calling smart contract method which is then able to modify account state. These are somewhat similar to stored procedures in SQL databases.

Smart contract storage model in AssemblyScript is somewhat similar to `localStorage` in JS.
You call `storage.set` to write value for a given key and `storage.get` (and it's type variations like `storage.getPrimitive`) to retrive it. For example to implement a simple counter:

```typescript
import { storage, logging } from "near-sdk-as";

export function incrementCounter(value: i32): void {
  const newCounter = storage.getPrimitive<i32>("counter", 0) + value;
  storage.set<i32>("counter", newCounter);
  logging.log("Counter is now: " + newCounter.toString());
}

export function getCounter(): i32 {
  return storage.getPrimitive<i32>("counter", 0);
}

export function resetCounter(): void {
  storage.set<i32>("counter", 0);
  logging.log("Counter is reset!");
}
```

Connect to smart contract client-side:

```js
const contract = new Contract(account, CONTRACT_NAME, {
    viewMethods: ["getCounter"],
    changeMethods: ["incrementCounter", "resetCounter"],
    sender: account.accountId
});
```

With such smart contract client code can submit transactions to manipulate counter, e.g.:

```js
document.querySelector('#plus').addEventListener('click', () => {
  contract.incrementCounter({value}).then(updateUI);
});
```

It's possible to retrive current counter value as well:

```js
const counterValue = await contract.getCounter();
```

See full counter example here:
https://examples.near.org/counter

### Limitations

Each operation executed on blockchain costs some "gas":
https://docs.near.org/docs/concepts/gas
Gas is an approximate measure of how much compute given operation uses when executed on chain and exists to manage supply and demand for execution on blockchain. Gas is paid in NEAR tokens by whoever submits a transaction.

Another limitation is that you have to lock certain number of NEAR tokens to pay for storage.
See here https://docs.near.org/docs/concepts/storage-staking

This is exists to account for limited real world storage and create incentive to free unused storage.

### Structuring storage around gas limits

There is only limited amount of gas available to every operation. This means the amount of storage that can be modified at once is also limited.
You can overcome it by splitting game state into multiple chunks.

For example NEAR Lands splits map into smaller squares using [`Chunk` model](https://github.com/vgrichina/near-lands/blob/7724eb7015d03f0522187a1d4a9bbe826a27e615/contract/assembly/model.ts#L10) and takes tracks which ones were recently changed using [`ChunkMap` model](https://github.com/vgrichina/near-lands/blob/7724eb7015d03f0522187a1d4a9bbe826a27e615/contract/assembly/model.ts#L52)

Sometimes user can perform a lot of actions in quick sequence (e.g. place multiple tiles in a raw). For this reason it is important to batch multiple operations in single transactions. Check this implementation of [`setTiles` method](https://github.com/vgrichina/near-lands/blob/7724eb7015d03f0522187a1d4a9bbe826a27e615/contract/assembly/model.ts#L109) designed to update multiple tiles at once.

Another interesting game to study for performance optimizations is [Berry Club](https://berryclub.io). See GitHub: https://github.com/evgenykuzyakov/berryclub

## Accept payment in NEAR

### Accept direct payment to account

You can direct users to pay directly to your `.near` account. It works like a charm if you just want to accept donations, etc.

However it gets harder if you want to detect payment and allow to do smth else like give users corresponding number of in-game currency.
You can use some blockchain indexer, e.g. https://github.com/near/near-indexer-for-explorer. Easiest way to use it would be to query one of [publicly available Postgres instances](https://github.com/near/near-indexer-for-explorer#shared-public-access).

So the recommended way to accept payment is to use a smart contract. In this case your smart contract can have logic which verifies sender, amount and other parameters and automatically updates state of user's account accordingly (e.g. sends user a NFT for sword they just purchased).

### Accept payment in smart contract

Every function call to a smart contract can have some payment in NEAR tokens attached.

There is a [guest book example](https://examples.near.org/guest-book) that allows to attach donation to a message.

Amount of NEAR tokens can be specified for every contract call like this:
```js
    contract.addMessage(
      { text: message.value },
      // Maximum amount of gas allocated to operation, 30 * 10**12 is a good default
      BOATLOAD_OF_GAS,
      // Amount is specified as an integer number of yoctoNEAR (i.e. 1 / 10**24 NEAR)
      Big(donation.value || '0').times(Big(10).pow(24)).toFixed()
    ).then(() => {
        // ...
    });
```

In smart contract number of tokens attached is represented by [`storage.attachedDeposit` property](https://near.github.io/near-sdk-as/classes/_sdk_core_assembly_contract_.context-1.html#attacheddeposit). Note that this balance is returned back to user if transactions fails.

Smart contract can verify this balance and perform actions accordingly, e.g.:
```typescript

export function purchaseItem(itemId: string): void {
  const itemPrice = storage.get<u128>("itemPrice:" + itemId);
  assert(itemPrice, `item ${itemId} is not listed for sale`);
  assert(context.attachedDeposit >= itemPrice!, `item ${itemId} costs ${itemPrice!} which is more than attached ${context.attachedDeposit}`);
  // Update owner for purchased item and remove it from sale
  storage.set("itemOwner:" + itemId, context.contractName);
  storage.delete("itemPrice:" + itemId);
}
```

## Recommended reading

* App examples on https://examples.near.org
* "Basics" section of NEAR docs, starting from https://docs.near.org/docs/concepts/account
* Building smart contracts in AssemblyScript: https://docs.near.org/docs/develop/contracts/as/intro
* Client-side API quick reference: https://docs.near.org/docs/api/naj-quick-reference
* NEAR Lands source code: https://github.com/vgrichina/near-lands
* Berry Club source code: https://github.com/evgenykuzyakov/berryclub


# IN NEXT EPISODES...

## How to check user has an NFT on NEAR

### client-side

### from a smart contract

## How to transfer NFT on NEAR

## How to mint NFT on NEAR
### Pluminite
### Mintbase
### Paras

## How to generate random numbers fairly

## What games can get most of blockchain?

## Game economy building blocks on NEAR

## How to store game content in decentralized way

## How to build realtime P2P communication
