

## How to login with NEAR

```js

// Configure connection to NEAR blockchain
const APP_KEY_PREFIX = 'near-lands:'
const near = await connect({
    nodeUrl: 'https://rpc.mainnet.near.org',
    walletUrl: 'https://wallet.near.org',
    networkId: 'default',
    // Specify where to store the signing keys
    keyStore: new keyStores.BrowserLocalStorageKeyStore(window.localStorage, APP_KEY_PREFIX)
})


// Get current account
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

With such smart contract client code can submit transactions to manipulate counter, e.g.:

```js
document.querySelector('#plus').addEventListener('click', ()=>{
  contract.incrementCounter({value}).then(updateUI);
});
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
So recommended way to accept payment is to use a smart contract. In this case smart contract can have logic which verifies sender, amount and other parameters and automatically updates state of user's account accordingly (e.g. sends user a NFT for sword they just purchased).

```js

// TODO: Is it possible to do without indexer?

```

### Accept payment in smart contract

Every function call to a smart contract can have some payment in NEAR tokens attached.

There is a [guest book example](https://examples.near.org/guest-book) that allows to attach donation to a message.

Amount of NEAR tokens can be specified for every contract call like this:
```js
    contract.addMessage(
      { text: message.value },
      BOATLOAD_OF_GAS,
      Big(donation.value || '0').times(10 ** 24).toFixed()
    ).then(() => {
        // ...
    });
```

In smart contract number of tokens attached is represented by [`storage.attachedDeposit` property](https://near.github.io/near-sdk-as/classes/_sdk_core_assembly_contract_.context-1.html#attacheddeposit). Note that this balance is returned back to user if transactions fails.

Smart contract can verify this balance and perform actions accordingly, e.g.:
```typescript

// TODO: Check this code works
export function purchaseItem(itemId: string): void {
    const itemPrice = storage.get<u128>("itemPrice:" + itemId);
    if (itemPrice) {
        if (context.attachedDeposit >= itemPrice!) {
            // Update owner for purchased item
            storage.set("itemOwner:" + itemId, context.contractName);
            // TODO: .delete?
            storage.set("itemPrice:" + itemId, null);
        }
    }
}
```

## How to mint NFT on NEAR

## When blockchain makes sense

### Monetizing UGC (user generated content)

Some games provide a way for users to create custom content:
 - maps
 - textures
 - characters
 - minigames
 - various mods affecting either rendering or gameplay
 
Quite often these don't come with any native way to monetize, so a lot of creative people who contribute to community don't get paid for it.
Some games have provided such ability (e.g. Roblox). However there are some drawbacks:
 - revenue share system biased towards platform
 - no guarantee that system can work beyond one parent company
Basically the system is still owned by one private company vs players themselves.

With blockchain you can have everything owned by community and allow creators to get paid directly.

Web2:
    - Roblox
    - Minecraft
    - etc
    
Web3:
    http://cryptovoxels.com/
    http://sandbox.game/
    https://decentraland.org

NEAR:
    - NEAR Lands
    - Marble Place
    - Shroom Kingdom

### Permanent ownership of land / items / characters (i.e. NFT-like stuff)

### Turn based (or semi-realtime) multiplayer with high stakes

Note that this doesn't have to be turn based only in a classic sense (like e.g. chess). A minimum viable "turn" for blockchain game is a time it takes to produce one block and confirm a transaction, which in case of NEAR is around 1 second. So there are games like Berry Club where you can essentialy decide to make or not to make a turn at any given moment and it feels somewhat realtime. However everyone's turns are still going to be executed sequentially on blockchain.

This can potentially work for a very diverse spectrum of games. A chess match between trusted friends which has some money on stake to make it more interesting. Or a massively multiplayer stategy game where players all around the world compete for scarce resources.

Web2:
    - EVE Online
    - Online poker?
    - etc

Web3: 
    - Dark Forest
    - ???

NEAR:
    - Berry Club

### Keep massively multiplayer world running forever (as long as players care)

It's often a pleasure to play old 80s and 90s games as you can run them easily on various emulators. These games gonna stay with us forver.
Unfortunately it's completely different with massively multiplayer online games. It's all over once publisher decides to shut down the servers. So a lot of culture from 2000s and 2010s games gonna be lost forever (at least in it's dynamic form), which is a shale.

Decentralized tech allows you to build massively multiplayer worlds which can go on forever. Or at least until there are users who care and are willing to pay for compute.

### Trading card games

Web3:
    - https://www.skyweaver.net/
    - Neon District?
    - ???

### Governance games

Web2:
    - https://www.erepublik.com/en
    - Wikipedia ;)
    - ???

You can imagine adopting some games into "play by DAO" mode, e.g. collective of multiple humans deciding chess moves playing against Kasparov

### Provably unique experiences (e.g. dungeon crawler where you get one shot to go through given dungeon and your adventure is recorded as NFT)

## How to run game economy on NEAR


## How to build realtime p2p communication

