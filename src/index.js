import Phaser from 'phaser';

import desertTilesImg from './assets/tilemaps/tiles/tmw_desert_spacing.png';
import grassTilesImg from './assets/tilemaps/tiles/grass.png';
import waterTilesImg from './assets/tilemaps/tiles/water.png';
import gamepadSpritesheet from './assets/gamepad/gamepad_spritesheet.png'

import 'regenerator-runtime/runtime';
import { connect, WalletConnection, keyStores, Contract, Account } from 'near-api-js';

import { VirtualGamepad } from './phaser-plugin-virtual-gamepad'

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
    window.location.reload();
}

const CHUNK_SIZE = 16;
const CHUNK_COUNT = 5;

let lastMap = null;
let fullMap = [];
async function loadBoardAndDraw() {
    const map = await contract.getMap();
    for (let i = 0; i < map.length; i++) {
        if (!lastMap) {
            fullMap.push(Array(map[i].length));
        }
        for (let j = 0; j < map[i].length; j++) {
            if (!lastMap || lastMap[i][j] != map[i][j]) {
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
let setTileBatch = [];
function putTileOnChain(x, y, tileId) {
    if (setTileQueue.length > 0) {
        const last = setTileQueue[setTileQueue.length - 1];
        if (last.x == x && last.y == y && last.tileId == tileId) {
            return;
        }
    }

    console.log('putTileOnChain', x, y, tileId);

    setTileQueue.push({ x, y, tileId });
    updatePending();
}

function updatePending() {
    if (setTileQueue.length == 0 && setTileBatch.length == 0) {
        $forEach('.pending-tiles', elem => elem.style = 'display: none;');
        return;
    }

    $forEach('.pending-tiles', elem => {
        elem.style = 'display: inline;';
        elem.innerHTML = `Pending: ${setTileQueue.length + setTileBatch.length}`;
    });
}

function updateError(e) {
    console.log('updateError', e);
    $forEach('.error', elem => {
        elem.innerHTML = `Last error: ${e}`;
        elem.style.display = 'inline';
    });
}

async function setNextPixel() {
    try {
        if (setTileQueue.length == 0) {
            return;
        }

        setTileBatch = setTileQueue.splice(0, Math.min(setTileQueue.length, SET_TILE_BATCH_SIZE));

        // Make sure to set tiles within one chunk
        let nextChunkIndex = setTileBatch.findIndex(tile =>
            Math.floor(tile.x / CHUNK_SIZE) != Math.floor(setTileBatch[0].x / CHUNK_SIZE) ||
            Math.floor(tile.y / CHUNK_SIZE) != Math.floor(setTileBatch[0].y / CHUNK_SIZE))
        if (nextChunkIndex > 0) {
            setTileQueue = setTileBatch.slice(nextChunkIndex).concat(setTileQueue);
            setTileBatch = setTileBatch.slice(0, nextChunkIndex);
        }

        console.log('setTile', setTileBatch);
        await contract.setTiles({ tiles: setTileBatch }, SET_TILE_GAS);
    } catch (e) {
        console.error('Error setting pixel', e);
        updateError(e);
    } finally {
        setTileBatch = [];
        updatePending();
        setTimeout(() => setNextPixel().catch(console.error), 50);
    };
}
setNextPixel().catch(console.error);

const CAMERA_SPEED = 0.5;

class MyGame extends Phaser.Scene
{
    constructor ()
    {
        super();
    }

    preload() {
        this.load.image('desert', desertTilesImg);
        this.load.image('grass', grassTilesImg);
        this.load.image('water', waterTilesImg);

        this.load.spritesheet({ key: 'gamepad', url: gamepadSpritesheet, frameConfig: { frameWidth: 100, frameHeight: 100 } });
    }

    createInventory(tiles) {
        if (this.inventoryBorder) {
            this.inventoryBorder.destroy();
        }
        if (this.inventoryMap) {
            this.inventoryMap.destroy();
        }
        if (this.marker) {
            this.marker.destroy();
        }

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
        });

        const inventoryX = tiles.tileWidth;
        const inventoryY = this.cameras.main.height - this.inventoryMap.heightInPixels - tiles.tileHeight;
        this.inventoryLayer = this.inventoryMap.createLayer(0, tiles, inventoryX, inventoryY);
        this.inventoryLayer.setScrollFactor(0);

        this.inventoryBorder = this.add.graphics();
        this.inventoryBorder.lineStyle(2, 0x000000, 1);
        this.inventoryBorder.strokeRect(inventoryX, inventoryY, this.inventoryMap.widthInPixels, this.inventoryMap.heightInPixels);
        this.inventoryBorder.setScrollFactor(0);

        this.marker = this.add.graphics();
        this.marker.lineStyle(2, 0x000000, 1);
        this.marker.strokeRect(0, 0, this.mainMap.tileWidth, this.mainMap.tileHeight);
    }

    create() {
        this.input.addPointer(2);

        this.mainMap = this.make.tilemap({
            key: 'mainMap',
            width: CHUNK_SIZE * CHUNK_COUNT,
            height: CHUNK_SIZE * CHUNK_COUNT
        });

        let desertTiles = this.mainMap.addTilesetImage('desert', 'desert', 32, 32, 1, 1);
        let grassTiles = this.mainMap.addTilesetImage('grass', 'grass', 32, 32, 0, 0, desertTiles.firstgid + desertTiles.total);
        let waterTiles = this.mainMap.addTilesetImage('water', 'water', 32, 32, 0, 0, grassTiles.firstgid + grassTiles.total);
        this.allTiles = [desertTiles, grassTiles, waterTiles];
        this.lpcTiles = [grassTiles, waterTiles];

        this.mainLayer = this.mainMap.createBlankLayer('Main', this.allTiles, 0, 0, CHUNK_SIZE * CHUNK_SIZE, CHUNK_SIZE * CHUNK_COUNT);
        this.autotileLayer = this.mainMap.createBlankLayer('Main-autotile', this.allTiles, 0, 0, CHUNK_SIZE * CHUNK_SIZE, CHUNK_SIZE * CHUNK_COUNT);
        this.mainMap.setLayer(this.mainLayer);

        this.createInventory(desertTiles);

        this.selectedTile = this.inventoryMap.getTileAt(5, 3);

        this.cameras.main.setBounds(0, 0, this.mainMap.widthInPixels, this.mainMap.heightInPixels);

        var cursors = this.input.keyboard.createCursorKeys();
        var controlConfig = {
            camera: this.cameras.main,
            left: cursors.left,
            right: cursors.right,
            up: cursors.up,
            down: cursors.down,
            speed: CAMERA_SPEED
        };
        this.controls = new Phaser.Cameras.Controls.FixedKeyControl(controlConfig);

        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

        this.inventoryKeys = [
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        ]

        var help = this.add.text(16, 16, 'Left-click to paint.\nShift + Left-click to select tile.\nArrows to scroll. Digits to switch tiles.', {
            fontSize: '18px',
            padding: { x: 10, y: 5 },
            backgroundColor: '#000000',
            fill: '#ffffff'
        });
        help.setScrollFactor(0);
        help.setAlpha(0.75);

        this.game.plugins.installScenePlugin('gamepad', VirtualGamepad, 'gamepad', this);
        const { width, height } = this.cameras.main;
        this.joystick = this.gamepad.addJoystick(80, height - 80, 1.2, 'gamepad');
        this.button = this.gamepad.addButton(width - 80, height - 80, 1.0, 'gamepad');

        loadBoardAndDraw().catch(console.error);
    }

    update(time, delta) {
        this.controls.update(delta);

        this.cameras.main.scrollX += this.gamepad.joystick.properties.x / 100 * CAMERA_SPEED * delta;
        this.cameras.main.scrollY += this.gamepad.joystick.properties.y / 100 * CAMERA_SPEED * delta;

        var worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);

        let inventoryX = this.inventoryMap.worldToTileX(worldPoint.x);
        let inventoryY = this.inventoryMap.worldToTileY(worldPoint.y);

        let insideInventory = !!(inventoryX >= 0 && inventoryY >= 0 && inventoryX < this.inventoryMap.width && inventoryY < this.inventoryMap.height);

        let sourceMap = insideInventory ? this.inventoryMap : this.mainMap;

        let pointerTileX = sourceMap.worldToTileX(worldPoint.x);
        let pointerTileY = sourceMap.worldToTileY(worldPoint.y);

        this.marker.x = sourceMap.tileToWorldX(pointerTileX);
        this.marker.y = sourceMap.tileToWorldY(pointerTileY);

        if (this.input.manager.activePointer.isDown) {
            if (this.shiftKey.isDown || sourceMap == this.inventoryMap) {
                // TODO: Select proper layer
                this.selectedTile = sourceMap.getTileAt(pointerTileX, pointerTileY);
                console.log('tile', this.selectedTile && (this.selectedTile.index - 48));
            } else if (sourceMap == this.mainMap) {
                if (!walletConnection.isSignedIn()) {
                    updateError('You need to login to draw');
                    return;
                }

                this.mainLayer.putTileAt(this.selectedTile, pointerTileX, pointerTileY);
                // TODO: Only do it for tiles that got updated
                this.populateAutotile();

                putTileOnChain(pointerTileX, pointerTileY, `${this.selectedTile.index}`);
            }
        }

        this.inventoryKeys.forEach((key, i) => {
            if (Phaser.Input.Keyboard.JustDown(key)) {
                this.createInventory(this.allTiles[i]);
            }
        });
    }

    populateAutotile() {
        let tilesetConfigs = [];
        for (let tileset of this.lpcTiles) {
            const toGid = localId => (tileset.firstgid + localId).toString();

            let coreTiles = [10, 15, 16, 17].map(toGid);
            let outerTiles = [
                [6, 7, 8],
                [9, 10, 11],
                [12, 13, 14]
            ].map(row => row.map(toGid));
            let innerCornerTiles = [1, 2, 4, 5].map(toGid);

            tilesetConfigs.push({
                coreTiles,
                outerTiles,
                innerCornerTiles
            })
        }
        window.tilesetConfigs = tilesetConfigs;

        let directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0], [0, 0], [1, 0],
            [-1, 1], [0, 1], [1, 1]
        ];
        let cornerDirections = [0, 2, 6, 8];
        let sideDirections = [1, 3, 5, 7];
        let innerCornerDirections = [[1, 3], [1, 5], [3, 7], [5, 7]];

        let { width, height } = this.mainMap;
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                let { index: tileId } = this.mainLayer.getTileAt(x, y, true);

                let autotileId;
                for (let { coreTiles, outerTiles, innerCornerTiles } of tilesetConfigs) {
                    if (coreTiles.includes(tileId)) {
                        autotileId = null;
                        continue;
                    }

                    const checkDirection = ([dx, dy]) => {
                        if (dx == 0 && dy == 0) {
                            return;
                        }

                        if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) {
                            return;
                        }

                        let { index: neighborTileId } = this.mainLayer.getTileAt(x + dx, y + dy, true);
                        if (coreTiles.includes(neighborTileId)) {
                            return true;
                        }

                        return false;
                    };

                    [cornerDirections, sideDirections].forEach(directionIndices =>
                        directionIndices.forEach(di => {
                            let [dx, dy] = directions[di];
                            if (checkDirection([dx, dy])) {
                                autotileId = outerTiles[1 - dy][1 - dx];
                            }
                        }));

                    innerCornerDirections.forEach((directionIndices, i) => {
                        if (directionIndices.every(di => checkDirection(directions[di]))) {
                            autotileId = innerCornerTiles[i];
                        }
                    });
                }

                if (autotileId) {
                    this.autotileLayer.putTileAt(autotileId, x, y);
                } else {
                    this.autotileLayer.removeTileAt(x, y);
                }
            }
        }
    }

}

const config = {
    type: Phaser.WEBGL,
    width: window.innerWidth - 20,
    height: window.innerHeight - 70,
    backgroundColor: '#2d2d2d',
    parent: 'phaser-example',
    pixelArt: true,
    scene: MyGame
};

const game = new Phaser.Game(config);

function updateChunk(i, j) {
    console.log('updateChunk', i, j);
    const scene = game.scene.scenes[0];

    const chunk = fullMap[i][j];
    for (let ii = 0; ii < CHUNK_SIZE; ii++) {
        for (let jj = 0; jj < CHUNK_SIZE; jj++) {
            scene.mainLayer.putTileAt(chunk.tiles[ii][jj], i * CHUNK_SIZE + ii, j * CHUNK_SIZE + jj);
        }
    }

    updatePutTileQueue();

    // TODO: Only do it for tiles that got updated
    scene.populateAutotile();
}

function updatePutTileQueue() {
    const scene = game.scene.scenes[0];

    for (let { x, y, tileId } of [...setTileBatch, ...setTileQueue]) {
        scene.mainLayer.putTileAt(tileId, x, y);
    }
}

Object.assign(window, { login, logout, game });