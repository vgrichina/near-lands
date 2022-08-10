# NEAR Lands

This project demonstrates how you can use [NEAR blockchain](https://near.org) for user accounts, storage and turn-based game logic. It also demonstrates usage of [simple-peer](https://github.com/feross/simple-peer) to enable real time peer to peer communication between users (used to share location of every user).

It also allows users who are close by on the map to communicate via voice chat.

## Requirements

[Node.js](https://nodejs.org) is required to install dependencies and run scripts via `npm`.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install project dependencies |
| `npm start` | Build project and open web server running project |
| `npm run build` | Builds code bundle with production settings (minification, uglification, etc..) |

## Writing Code

After cloning the repo, run `npm install` from your project directory. Then, you can start the local development server by running `npm start`.

After starting the development server with `npm start`, you can edit any files in the `src` folder and Parcel will automatically recompile and reload your server (available at `http://localhost:1234` by default).

### Important files / directories

- `static/` – static assets that gonna be copied as is to `dist/` folder. Includes `lpc-character` folder which contains character spritesheets provided by https://github.com/jrconway3/Universal-LPC-spritesheet project. You can use http://gaurav.munjal.us/Universal-LPC-Spritesheet-Character-Generator/ to explore available sprites.
- `src/assets` – static assets that can be included from `.js` files and processed by Parcel (including tile images)
- `src/index.js` – main JS entry point and game logic
- `src/near.js` – boilerplate related to NEAR blockchain
- `src/p2p.js` – common code to establish peer to peer connectivity
– `src/player.js` – logic related to player characters (including remote)
- `src/phaser-plugin-virtual-gamepad.js` – virtual gamepad plugin for use with touch screen devices
- `index.html` – entry point for webapp build

## Customizing the Template

### Babel

You can write modern ES6+ JavaScript and Babel will transpile it to a version of JavaScript that you want your project to support. The targeted browsers are set in the `.babelrc` file and the default currently targets all browsers with total usage over "0.25%" but excludes IE11 and Opera Mini.

 ```
"browsers": [
  ">0.25%",
  "not ie 11",
  "not op_mini all"
]
 ```

### Parcel

Check out https://v2.parceljs.org/ for documentation on how to customize configuration and common recipes.

## Deploying Code

After you run the `npm run build` command, frontend code will be built in the `dist/` folder along with any other assets you project depended. 

To deploy frontend code using [web4](https://github.com/vgrichina/web4) you can use `npm run deploy:static`. You can set target contract name in `src/config.js` file or through `CONTRACT_NAME` environment variable. This is using [`web4-deploy`](https://github.com/vgrichina/web4-deploy) to upload static files to IPFS, pin it and update the hash addrssed by the smart contract.

Note that smart contract needs to be already deployed on the given account using `npm run deploy`. 

Deploying on account like `lands.near` results in corresponding `.near.page` website like https://lands.near.page.

## Roadmap

-  Game features
  - [ ] NFT gallery support (custom images placed inside world)
  - [ ] Portal support (world coordinates)
  - [ ] Portal support (websites)
  - [ ] Music/sound source support 
  - [ ] Grouped UI for build material selection
  - [ ] Quick access bar for material selection
  - [ ] Larger choice of building materials
  - [ ] Trade tokens with users you are closed by (like in Civilization, etc)
  - [ ] Load land content from custom smart contract 
  - [ ] Interact with smart contracts through in game items

- Land sale
  - [ ] Own land parcel as NFT
  - [ ] Enforce restrictions on other users on your parcel

- Voice chat
  - [ ] Push to talk to limit bandwidth and noise
  - [ ] Experiment with adjusting pan in spatial audio
  - [ ] Use multiple rooms to scale?
  - [ ] Use server-side mixing to scale? (estimate how much gonna cost to operate)

- Future direction
  - Multiple interconnected worlds
  - Native mobile apps

