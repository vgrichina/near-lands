import Phaser from 'phaser';

import desertTilesImg from 'url:~src/assets/tilemaps/tiles/tmw_desert_spacing.png';
import grassTilesImg from 'url:~src/assets/tilemaps/tiles/grass.png';
import waterTilesImg from 'url:~src/assets/tilemaps/tiles/water.png';
import gamepadSpritesheet from 'url:~src/assets/gamepad/gamepad_spritesheet.png'
import princessSpritesheet from 'url:~src/assets/princess.png'

import 'regenerator-runtime/runtime';

import VirtualJoystick from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin'
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin'

import { connectP2P } from './p2p'
import { connectNear, CONTRACT_NAME } from './near'
import { debounce } from './utils';

import { Player, UPDATE_DELTA } from './player'
import { UIScene } from './ui';

const SET_TILE_GAS = 120 * 1000 * 1000 * 1000 * 1000;
const SET_TILE_BATCH_SIZE = 10;
const DEBUG = false;

const connectPromise = connectNear();

const accountIdToPlayer = {};
async function login() {
    const { walletConnection } = await connectPromise;

    walletConnection.requestSignIn(CONTRACT_NAME);
}

async function logout() {
    const { walletConnection } = await connectPromise;

    localStorage.removeItem('peerId');
    walletConnection.signOut();
    window.location.reload();
}

const CHUNK_SIZE = 16;
const CHUNK_COUNT = 4;
const PARCEL_COUNT = 8;
const TILE_SIZE_PIXELS = 32;
const CHUNK_SIZE_PIXELS = CHUNK_SIZE * TILE_SIZE_PIXELS;
const PARCEL_SIZE_PIXELS = CHUNK_COUNT * CHUNK_SIZE_PIXELS;
const WIDTH_TILES = CHUNK_COUNT * CHUNK_SIZE * PARCEL_COUNT;
const HEIGHT_TILES = WIDTH_TILES;

let nonceMap = [...Array(PARCEL_COUNT * CHUNK_COUNT)].map(() => [...Array(PARCEL_COUNT * CHUNK_COUNT)]);
let fullMap = [...Array(PARCEL_COUNT * CHUNK_COUNT)].map(() => [...Array(PARCEL_COUNT * CHUNK_COUNT)]);

let parcelsLoading = false;
async function loadParcels() {
    if (parcelsLoading) {
        return;
    }

    try {
        parcelsLoading = true;
        const { contract } = await connectPromise;

        const scene = game.scene.getScene('GameScene');
        const { scrollX, scrollY, displayWidth, displayHeight } = scene.cameras.main;
        const startX = Math.floor(scrollX / PARCEL_SIZE_PIXELS);
        const startY = Math.floor(scrollY / PARCEL_SIZE_PIXELS);
        const endX = Math.ceil((scrollX + displayWidth) / PARCEL_SIZE_PIXELS);
        const endY = Math.ceil((scrollY + displayHeight) / PARCEL_SIZE_PIXELS);

        for (let parcelX = startX; parcelX < endX; parcelX++) {
            for (let parcelY = startY; parcelY < endY; parcelY++) {
                const parcelNonces = await contract.getParcelNonces({ x: parcelX, y: parcelY });

                for (let i = 0; i < parcelNonces.length; i++) {
                    for (let j = 0; j < parcelNonces[i].length; j++) {
                        nonceMap[parcelX * CHUNK_COUNT + i][parcelY * CHUNK_COUNT + j] = parcelNonces[i][j];
                    }
                }
            }
        }

        // Throttle
        await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
        parcelsLoading = false;
    }
}

const CHUNK_PRELOAD_RATIO = 0.25;
const VELOCITY_RATIO = 1 / 250;
async function loadChunksIfNeeded() {
    const { contract } = await connectPromise;

    const scene = game.scene.getScene('GameScene');
    const { scrollX, scrollY, displayWidth, displayHeight } = scene.cameras.main;

    const extendStartX = Math.max(0, -scene.player.body.velocity.x * CHUNK_PRELOAD_RATIO * VELOCITY_RATIO);
    const extendStartY = Math.max(0, -scene.player.body.velocity.y * CHUNK_PRELOAD_RATIO * VELOCITY_RATIO);
    const extendEndX = Math.min(scene.player.body.velocity.x * CHUNK_PRELOAD_RATIO * VELOCITY_RATIO, CHUNK_PRELOAD_RATIO);
    const extendEndY = Math.min(scene.player.body.velocity.y * CHUNK_PRELOAD_RATIO * VELOCITY_RATIO, CHUNK_PRELOAD_RATIO);
    const startX = Math.max(0, Math.floor(scrollX / CHUNK_SIZE_PIXELS - extendStartX));
    const startY = Math.max(0, Math.floor(scrollY / CHUNK_SIZE_PIXELS - extendStartY));
    const endX = Math.min(PARCEL_COUNT * CHUNK_COUNT, Math.ceil((scrollX + displayWidth) / CHUNK_SIZE_PIXELS + extendEndX));
    const endY = Math.min(PARCEL_COUNT * CHUNK_COUNT, Math.ceil((scrollY + displayHeight) / CHUNK_SIZE_PIXELS + extendEndY));

    for (let i = startX; i < endX; i++) {
        for (let j = startY; j < endY; j++) {
            const { nonce, loading } = fullMap[i][j] || {};
            if ((!nonce || nonce < nonceMap[i][j]) && !loading) {
                console.debug('nonce mismatch for chunk', i, j, nonce, nonceMap[i][j], );
                fullMap[i][j] = { ...fullMap[i][j], loading: true };
                // NOTE: no await on purpose
                contract.getChunk({ x: i, y: j })
                    .then(chunk => {
                        fullMap[i][j] = { ...chunk, loading: false };
                        updateChunk(i, j);
                    })
                    .catch(e => {
                        console.warn('Error loading chunk ', i, j, e);
                        fullMap[i][j] = { ...fullMap[i][j], loading: false };
                    });
            }
        }
    }
}


let setTileQueue = [];
let setTileBatch = [];
function putTileOnChain(x, y, tileId) {
    if (setTileQueue.concat(setTileBatch).some(tile => x == tile.x && y == tile.y && tileId == tile.tileId)) {
        return;
    }

    console.debug('putTileOnChain', x, y, tileId);
    setTileQueue.push({ x, y, tileId });
    updatePending();
}

function updatePending() {
    const scene = game.scene.getScene('UIScene');

    if (!scene || !scene.messageLabel) {
        return;
    }

    scene.updatePending({ setTileQueue, setTileBatch });
}

function updateError(e) {
    console.warn('updateError', e);

    const scene = game.scene.getScene('UIScene');
    if (!scene) {
        return;
    }

    scene.updateError(e);
}

async function setNextPixel() {
    const { contract } = await connectPromise;

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

        console.debug('setTiles', setTileBatch);
        await contract.setTiles({ tiles: setTileBatch }, SET_TILE_GAS);
    } catch (e) {
        updateError(e);
        updateChunk(Math.floor(setTileBatch[0].x / CHUNK_SIZE), Math.floor(setTileBatch[0].y / CHUNK_SIZE));
    } finally {
        setTileBatch = [];
        updatePending();
        setTimeout(() => setNextPixel(), 50);
    };
}
setNextPixel();

const UI_DEPTH = 10;

class GameScene extends Phaser.Scene
{
    constructor ()
    {
        super({ key: 'GameScene' });

        Phaser.GameObjects.GameObjectFactory.register('player', function ({ accountId, x, y, layers, controlledByUser = false}) {
            const player = new Player({ scene: this.scene, x, y, accountId, layers, controlledByUser })
            this.displayList.add(player);
            this.updateList.add(player);
            return player;
        });
    }

    preload() {
        this.load.image('desert', desertTilesImg);
        this.load.image('grass', grassTilesImg);
        this.load.image('water', waterTilesImg);

        this.load.spritesheet({ key: 'gamepad', url: gamepadSpritesheet, frameConfig: { frameWidth: 100, frameHeight: 100 } });
        this.load.spritesheet({ key: 'princess', url: princessSpritesheet, frameConfig: { frameWidth: 64, frameHeight: 64 }});
        this.load.spritesheet({ key: 'skeleton', url: '/lpc-character/body/male/skeleton.png', frameConfig: { frameWidth: 64, frameHeight: 64 }});
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

        const inventoryX = this.cameras.main.width - this.inventoryMap.widthInPixels - tiles.tileWidth;
        const inventoryY = tiles.tileHeight * 1.5;
        this.inventoryLayer = this.inventoryMap.createLayer(0, tiles, inventoryX, inventoryY);
        this.inventoryLayer.setScrollFactor(0);
        this.inventoryLayer.setDepth(UI_DEPTH);
        this.inventoryLayer.setInteractive();
        this.inventoryLayer.on('pointerdown', this.handleTileDrawing);
        this.inventoryLayer.on('pointermove', this.handleTileDrawing);

        this.inventoryBorder = this.add.graphics();
        this.inventoryBorder.lineStyle(2, 0x000000, 1);
        this.inventoryBorder.strokeRect(inventoryX, inventoryY, this.inventoryMap.widthInPixels, this.inventoryMap.heightInPixels);
        this.inventoryBorder.setScrollFactor(0);
        this.inventoryBorder.setDepth(UI_DEPTH);

        this.marker = this.add.graphics();
        this.marker.lineStyle(2, 0x000000, 1);
        this.marker.strokeRect(0, 0, this.mainMap.tileWidth, this.mainMap.tileHeight);
    }

    create() {
        this.input.addPointer(2);

        this.mainMap = this.make.tilemap({
            key: 'mainMap',
            width: WIDTH_TILES,
            height: HEIGHT_TILES
        });

        this.desertTiles = this.mainMap.addTilesetImage('desert', 'desert', 32, 32, 1, 1);
        this.grassTiles = this.mainMap.addTilesetImage('grass', 'grass', 32, 32, 0, 0, this.desertTiles.firstgid + this.desertTiles.total);
        this.waterTiles = this.mainMap.addTilesetImage('water', 'water', 32, 32, 0, 0, this.grassTiles.firstgid + this.grassTiles.total);
        this.allTiles = [this.desertTiles, this.grassTiles, this.waterTiles];
        this.lpcTiles = [this.grassTiles, this.waterTiles];

        this.mainLayer = this.mainMap.createBlankLayer('Main', this.allTiles, 0, 0, WIDTH_TILES, HEIGHT_TILES);
        this.mainLayer.setInteractive();
        this.mainLayer.on('pointerdown', this.handleTileDrawing);
        this.mainLayer.on('pointermove', this.handleTileDrawing);
        this.autotileLayer = this.mainMap.createBlankLayer('Main-autotile', this.allTiles, 0, 0, WIDTH_TILES, HEIGHT_TILES);
        this.mainMap.setLayer(this.mainLayer);

        // Mark colliding tiles
        const collides = true;
        const recalculateFaces = false;
        this.mainLayer.setCollisionBetween(-1, -1, collides, recalculateFaces);
        this.mainLayer.setCollisionBetween(45, 47, collides, recalculateFaces);
        this.mainLayer.setCollisionBetween(37, 39, collides, recalculateFaces);
        this.mainLayer.setCollisionBetween(30, 31, collides, recalculateFaces);
        this.mainLayer.setCollisionBetween(this.waterTiles.firstgid, this.waterTiles.firstgid + this.waterTiles.total, collides, recalculateFaces);
        this.autotileLayer.setCollisionBetween(this.waterTiles.firstgid, this.waterTiles.firstgid + this.waterTiles.total, collides, recalculateFaces);

        this.cameras.main.setBounds(0, 0, this.mainMap.widthInPixels, this.mainMap.heightInPixels);
        this.physics.world.setBounds(0, 0, this.mainLayer.width, this.mainLayer.height, true, true, true, true);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasdCursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.inventoryKeys = [
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        ]

        let x = 400, y = 300;
        const { hash } = window.location;
        if (hash) {
            [x, y] = hash.substring(1).split(',').map(s => parseFloat(s) * TILE_SIZE_PIXELS);
        }
        this.player = this.add.player({ scene: this, x, y, accountId: account.accountId, controlledByUser: true });

        const roundPixels = true;
        this.cameras.main.startFollow(this.player, roundPixels);

        this.createInventory(this.desertTiles);

        this.selectedTile = this.inventoryMap.getTileAt(5, 3);

        // Debug graphics
        if (DEBUG) {
            // Turn on physics debugging to show player's hitbox
            this.physics.world.createDebugGraphic();

            // Create worldLayer collision graphic above the player, but below the help text
            this.debugGraphics = this.add.graphics()
                .setAlpha(0.75)
                .setDepth(20);
        };
    }

    handleTileDrawing = (pointer) => {
        let worldPoint = pointer.positionToCamera(this.cameras.main);

        let inventoryX = this.inventoryMap.worldToTileX(worldPoint.x);
        let inventoryY = this.inventoryMap.worldToTileY(worldPoint.y);

        let insideInventory = !!(inventoryX >= 0 && inventoryY >= 0 && inventoryX < this.inventoryMap.width && inventoryY < this.inventoryMap.height);

        let sourceMap = insideInventory ? this.inventoryMap : this.mainMap;

        let pointerTileX = sourceMap.worldToTileX(worldPoint.x);
        let pointerTileY = sourceMap.worldToTileY(worldPoint.y);

        this.marker.x = sourceMap.tileToWorldX(pointerTileX);
        this.marker.y = sourceMap.tileToWorldY(pointerTileY);
        this.marker.setDepth(insideInventory ? UI_DEPTH + 1 : 0);

        if (pointer.isDown) {
            if (this.shiftKey.isDown || sourceMap == this.inventoryMap) {
                this.selectedTile = sourceMap.getTileAt(pointerTileX, pointerTileY);
            } else if (sourceMap == this.mainMap) {
                if (!walletConnection.isSignedIn()) {
                    updateError('You need to login to draw');
                    return;
                }

                this.mainLayer.putTileAt(this.selectedTile, pointerTileX, pointerTileY);
                this.populateAutotile(pointerTileX - 1, pointerTileY - 1, 3, 3);

                putTileOnChain(pointerTileX, pointerTileY, `${this.selectedTile.index}`);
            }
        }
    }

    get gameMode() {
        const uiScene = game.scene.getScene('UIScene');
        const mode = uiScene.modeButtons.value;
        return mode;
    }

    update(time, delta) {
        switch (this.gameMode) {
        case 'walk':
            this.inventoryLayer.visible = false;
            this.inventoryBorder.visible = false;
            this.marker.visible = false;
            this.inventoryLayer.removeInteractive();
            this.mainLayer.removeInteractive();
            break;
        case 'build':
            this.inventoryLayer.visible = true;
            this.inventoryBorder.visible = true;
            this.inventoryLayer.setInteractive();
            this.mainLayer.setInteractive();
            break;
        default:
            console.error('Unrecognized game mode: ', this.gameMode);
        }

        this.inventoryKeys.forEach((key, i) => {
            if (Phaser.Input.Keyboard.JustDown(key)) {
                this.createInventory(this.allTiles[i]);
            }
        });

        if (DEBUG && this.debugGraphics) {
            this.mainLayer.renderDebug(this.debugGraphics, {
                tileColor: null, // Color of non-colliding tiles
                collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255), // Color of colliding tiles
                faceColor: new Phaser.Display.Color(40, 39, 37, 255) // Color of colliding face edges
            });

            this.autotileLayer.renderDebug(this.debugGraphics, {
                tileColor: null, // Color of non-colliding tiles
                collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255), // Color of colliding tiles
                faceColor: new Phaser.Display.Color(40, 39, 37, 255) // Color of colliding face edges
            });
        }

        loadParcels().catch(console.error);
        loadChunksIfNeeded().catch(console.error);

        this.updateURL();
    }

    updateURL = debounce(() => {
        const x = this.player.x / TILE_SIZE_PIXELS;
        const y = this.player.y / TILE_SIZE_PIXELS;
        const newHash = `#${x.toFixed(1)},${y.toFixed(1)}`;

        if (this.player.body.velocity.length() == 0) {
            history.replaceState(null, null, newHash);
        }
    }, 500);

    populateAutotile(startX, startY, width, height) {
        console.debug('populateAutotile', startX, startY, width, height);
        startX = Math.max(0, startX);
        startY = Math.max(0, startY);

        const endX = Math.min(startX + width, this.mainMap.width);
        const endY = Math.min(startY + height, this.mainMap.height);

        let tilesetConfigs = [];
        for (let tileset of this.lpcTiles) {
            const toGid = localId => tileset.firstgid + localId;

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

        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
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

                        if (x + dx < 0 || x + dx >= this.mainMap.width || y + dy < 0 || y + dy >= this.mainMap.height) {
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
    type: Phaser.CANVAS,
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    backgroundColor: '#2d2d2d',
    parent: 'phaser-example',
    pixelArt: true,
    roundPixels: true,
    plugins: {
        global: [{
            key: 'rexVirtualJoystick',
            plugin: VirtualJoystick,
            start: true
        }],
        scene: [{
            key: 'rexUI',
            plugin: UIPlugin,
            mapping: 'rexUI'
        }]
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 } // Top down game, so no gravity
        }
    },
    scene: [ GameScene, UIScene ]
};

const game = new Phaser.Game(config);
function updateChunk(i, j) {
    console.debug('updateChunk', i, j);
    const scene = game.scene.getScene('GameScene');

    const chunk = fullMap[i][j];
    for (let ii = 0; ii < CHUNK_SIZE; ii++) {
        for (let jj = 0; jj < CHUNK_SIZE; jj++) {
            scene.mainLayer.putTileAt(chunk.tiles[ii][jj] | 0, i * CHUNK_SIZE + ii, j * CHUNK_SIZE + jj);
        }
    }

    updatePutTileQueue();

    scene.populateAutotile(i * CHUNK_SIZE - 1, j * CHUNK_SIZE - 1, CHUNK_SIZE + 2, CHUNK_SIZE + 2);
}

function updatePutTileQueue() {
    const scene = game.scene.getScene('GameScene');

    for (let { x, y, tileId } of [...setTileBatch, ...setTileQueue]) {
        scene.mainLayer.putTileAt(tileId, x, y);
    }
}

async function onLocationUpdate({ accountId, x, y, frame, animName, animProgress, layers }) {
    if (accountId && accountId == account.accountId) {
        return;
    }

    if (!accountIdToPlayer[accountId]) {
        const scene = game.scene.getScene('GameScene');
        accountIdToPlayer[accountId] = scene.add.player({ scene, x, y, accountId, layers });
    }
    const player = accountIdToPlayer[accountId];
    player.updateFromRemote({ x, y, layers, frame, animName, animProgress });
}

let p2p
async function connectP2PIfNeeded() {
    const { contract } = await connectPromise;
    if (!p2p) {
        p2p = await connectP2P({ accountId: contract.account.accountId });
        window.p2p = p2p;
    }
}

async function publishLocation() {
    try {
        await connectP2PIfNeeded();
        if (!p2p) {
            return;
        }

        const scene = game.scene.getScene('GameScene');
        if (!scene || !scene.player) {
            return;
        }

        const { x, y, playerSprites } = scene.player;
        const [{ anims, ...playerSprite }] = playerSprites;
        const layers = playerSprites.map(sprite => sprite.texture.key);
        p2p.publishLocation({
            x,
            y,
            frame: playerSprite.frame.name,
            animName: anims.isPlaying && anims.getName().replace(/:.+$/, ''),
            animProgress: anims.getProgress(),
            // TODO: Throttle layers transmission to save bandwidth?
            layers
        });
    } finally {
        setTimeout(publishLocation, UPDATE_DELTA);
    }
};
publishLocation();

(async () => {
    await connectP2PIfNeeded();
    if (!p2p) {
        console.error("Couldn't subscribe to location updates");
        return;
    }
    p2p.subscribeToLocation(onLocationUpdate);
})().catch(console.error);

Object.assign(window, { login, logout, game, onLocationUpdate, publishLocation });