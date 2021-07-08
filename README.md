# Phaser 3 Decentralized Multiplayer Game Project Template

A Phaser 3 project template with ES6 support via [Babel 7](https://babeljs.io/) and [Parcel](https://v2.parceljs.org) that includes hot-reloading for development and production-ready builds.

This project demonstrates how you can use [NEAR blockchain](https://near.org) for user accounts, storage and turn-based game logic. It also demonstrates usage of [simple-peer](https://github.com/feross/simple-peer) to enable real time peer to peer communication between users (used to share location of every user).

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

After you run the `npm run build` command, your code will be built in the `dist/` folder along with any other assets you project depended. 

If you put the contents of the `dist` folder in a publicly-accessible location (say something like `http://mycoolserver.com`), you should be able to open `http://mycoolserver.com/index.html` and play your game.
