import Phaser from 'phaser';

import tilesImg from './assets/tilemaps/tiles/tmw_desert_spacing.png';
import mapJson from './assets/tilemaps/maps/desert.json';

import 'regenerator-runtime/runtime';
import { connect, WalletConnection, keyStores, Contract, Account } from 'near-api-js';

let near;
let walletConnection;
let account;
let contract;

const CONTRACT_NAME = 'lands.near';

const SET_TILE_GAS = 120 * 1000 * 1000 * 1000 * 1000;
const SET_TILE_BATCH_SIZE = 10;

async function connectNear() {
    const APP_KEY_PREFIX = 'near-lands:'
    near = await connect({
        nodeUrl: 'https://rpc.mainnet.near.org',
        walletUrl: 'https://wallet.near.org',
        networkId: 'default',
        keyStore: new keyStores.BrowserLocalStorageKeyStore(window.localStorage, APP_KEY_PREFIX)
    })
    walletConnection = new WalletConnection(near, APP_KEY_PREFIX)

    if (walletConnection.isSignedIn()) {
        account = walletConnection.account();
    } else {
        account = new Account(near.connection, CONTRACT_NAME);
    }

    contract = new Contract(account, CONTRACT_NAME, {
        viewMethods: ["getMap", "getChunk"],
        changeMethods: ["setTiles"],
        sender: account.accountId
    });

    loadBoardAndDraw().catch(console.error);

    Object.assign(window, { near, walletConnection, account, contract });
}

function $forEach(selector, fn) {
    document.querySelectorAll(selector).forEach(fn);
}

const connectPromise = connectNear()
    .then(() => {
        if (walletConnection.isSignedIn()) {
            $forEach('.before-login', elem => elem.style.display = 'none');
            $forEach('.user-name', elem => elem.innerHTML = walletConnection.getAccountId());
        } else {
            $forEach('.require-login', elem => elem.style.display = 'none');
        }
    })
    .catch(console.error);

async function login() {
    await connectPromise;

    walletConnection.requestSignIn(CONTRACT_NAME);
}

async function logout() {
    await connectPromise;

    walletConnection.signOut();
}

const CHUNK_SIZE = 16;
const CHUNK_COUNT = 5;

let lastMap = null;
let fullMap = [];
async function loadBoardAndDraw() {
    console.log("getMap");
    const map = await contract.getMap();
    for (let i = 0; i < map.length; i++) {
        if (!lastMap) {
            fullMap.push(Array(map[i].length));
        }
        for (let j = 0; j < map[i].length; j++) {
            if (!lastMap || lastMap[i][j] != map[i][j]) {
                console.log("getChunk", i, j);
                let chunk = await contract.getChunk({ x: i * CHUNK_SIZE, y: j * CHUNK_SIZE });
                fullMap[i][j] = chunk;

                updateChunk(i, j);
            }
        }
    }
    lastMap = map;

    setTimeout(loadBoardAndDraw, 5000);
}

let setTileQueue = [];
function putTileOnChain(x, y, tileId) {
    if (setTileQueue.length > 0) {
        const last = setTileQueue[setTileQueue.length - 1];
        if (last.x == x && last.y == y && last.tileId == tileId) {
            return;
        }
    }

    console.log('putTileOnChain', x, y, tileId);

    setTileQueue.push({ x, y, tileId });
}

async function setNextPixel() {
    try {
        if (setTileQueue.length == 0) {
            return;
        }

        let setTileBatch = setTileQueue.splice(0, Math.min(setTileQueue.length, SET_TILE_BATCH_SIZE));

        // Make sure to set tiles within one chunk
        let nextChunkIndex = setTileBatch.findIndex(tile =>
            Math.floor(tile.x / CHUNK_SIZE) != Math.floor(setTileBatch[0].x / CHUNK_SIZE) ||
            Math.floor(tile.y / CHUNK_SIZE) != Math.floor(setTileBatch[0].y / CHUNK_SIZE))
        if (nextChunkIndex > 0) {
            setTileQueue = setTileBatch.slice(nextChunkIndex).concat(setTileQueue);
            setTileBatch = setTileBatch.slice(0, nextChunkIndex);
        }
        // TODO: Keep track of pending tiles to allow drawing them over background loaded from chain

        console.log('setTile', setTileBatch);
        await contract.setTiles({ tiles: setTileBatch }, SET_TILE_GAS);
    } catch (e) {
        console.error('Error setting pixel', e);
    } finally {
        setTimeout(() => setNextPixel().catch(console.error), 50);
    };
}
setNextPixel().catch(console.error);


var controls;
var marker;
var shiftKey;
var selectedTile;

class MyGame extends Phaser.Scene
{
    constructor ()
    {
        super();
    }

    preload() {
        this.load.image('tiles', tilesImg);
    }

    create() {
        this.mainMap = this.make.tilemap({
            key: 'mainMap',
            width: CHUNK_SIZE * CHUNK_COUNT,
            height: CHUNK_SIZE * CHUNK_COUNT
        });

        var tiles = this.mainMap.addTilesetImage('Desert', 'tiles', 32, 32, 1, 1);

        this.mainLayer = this.mainMap.createBlankLayer('Main', tiles, 0, 0, CHUNK_SIZE * CHUNK_SIZE, CHUNK_SIZE * CHUNK_COUNT);

        // Create inventory layer
        let inventoryData = [];
        let gid = tiles.firstgid;
        for (let i = 0; i < tiles.rows; i++) {
            const row = [];
            for (let j = 0; j < tiles.columns; j++, gid++) {
                row[j] = gid;
            }
            inventoryData.push(row)
        }

        this.inventoryMap = this.make.tilemap({
            tileWidth: tiles.tileWidth,
            tileHeight: tiles.tileHeight,
            width: tiles.columns,
            height: tiles.rows,
            data: inventoryData
        })
        const inventoryX = tiles.tileWidth;
        const inventoryY = this.cameras.main.height - this.inventoryMap.heightInPixels - tiles.tileHeight;
        this.inventoryLayer = this.inventoryMap.createLayer(0, tiles, inventoryX, inventoryY);
        this.inventoryLayer.setScrollFactor(0);

        this.inventoryBorder = this.add.graphics();
        this.inventoryBorder.lineStyle(2, 0x000000, 1);
        this.inventoryBorder.strokeRect(inventoryX, inventoryY, this.inventoryMap.widthInPixels, this.inventoryMap.heightInPixels);
        this.inventoryBorder.setScrollFactor(0);

        selectedTile = this.inventoryMap.getTileAt(5, 3);

        marker = this.add.graphics();
        marker.lineStyle(2, 0x000000, 1);
        marker.strokeRect(0, 0, this.mainMap.tileWidth, this.mainMap.tileHeight);

        this.cameras.main.setBounds(0, 0, this.mainMap.widthInPixels, this.mainMap.heightInPixels);

        var cursors = this.input.keyboard.createCursorKeys();
        var controlConfig = {
            camera: this.cameras.main,
            left: cursors.left,
            right: cursors.right,
            up: cursors.up,
            down: cursors.down,
            speed: 0.5
        };
        controls = new Phaser.Cameras.Controls.FixedKeyControl(controlConfig);

        shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

        var help = this.add.text(16, 16, 'Left-click to paint.\nShift + Left-click to select tile.\nArrows to scroll.', {
            fontSize: '18px',
            padding: { x: 10, y: 5 },
            backgroundColor: '#000000',
            fill: '#ffffff'
        });
        help.setScrollFactor(0);
        help.setAlpha(0.75);
    }

    update(time, delta) {
        controls.update(delta);

        var worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);

        let inventoryX = this.inventoryMap.worldToTileX(worldPoint.x);
        let inventoryY = this.inventoryMap.worldToTileY(worldPoint.y);

        let insideInventory = !!(inventoryX >= 0 && inventoryY >= 0 && inventoryX < this.inventoryMap.width && inventoryY < this.inventoryMap.height);

        let sourceMap = insideInventory ? this.inventoryMap : this.mainMap;

        let pointerTileX = sourceMap.worldToTileX(worldPoint.x);
        let pointerTileY = sourceMap.worldToTileY(worldPoint.y);

        marker.x = sourceMap.tileToWorldX(pointerTileX);
        marker.y = sourceMap.tileToWorldY(pointerTileY);

        if (this.input.manager.activePointer.isDown) {
            if (shiftKey.isDown || sourceMap == this.inventoryMap) {
                selectedTile = sourceMap.getTileAt(pointerTileX, pointerTileY);
            } else if (sourceMap == this.mainMap) {
                this.mainLayer.putTileAt(selectedTile, pointerTileX, pointerTileY);

                putTileOnChain(pointerTileX, pointerTileY, `${selectedTile.index}`);
            }
        }
    }

}

const config = {
    type: Phaser.WEBGL,
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    parent: 'phaser-example',
    pixelArt: true,
    scene: MyGame
};

const game = new Phaser.Game(config);

function updateChunk(i, j) {
    const scene = game.scene.scenes[0];

    const chunk = fullMap[i][j];
    for (let ii = 0; ii < CHUNK_SIZE; ii++) {
        for (let jj = 0; jj < CHUNK_SIZE; jj++) {
            scene.mainLayer.putTileAt(chunk.tiles[ii][jj], i * CHUNK_SIZE + ii, j * CHUNK_SIZE + jj);
        }
    }

    updatePutTileQueue();
}

function updatePutTileQueue() {
    const scene = game.scene.scenes[0];

    for (let { x, y, tileId } of setTileQueue) {
        scene.mainLayer.putTileAt(tileId, x, y);
    }
}

Object.assign(window, { login, logout, game });