import Phaser from 'phaser';

import desertTilesImg from 'url:~src/assets/tilemaps/tiles/tmw_desert_spacing.png';
import grassTilesImg from 'url:~src/assets/tilemaps/tiles/grass.png';
import waterTilesImg from 'url:~src/assets/tilemaps/tiles/water.png';
import gamepadSpritesheet from 'url:~src/assets/gamepad/gamepad_spritesheet.png'
import princessSpritesheet from 'url:~src/assets/princess.png'

import 'regenerator-runtime/runtime';

import VirtualJoystick from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin'

import { connectP2P } from './p2p'
import { connectNear, CONTRACT_NAME } from './near'

import { Player, UPDATE_DELTA } from './player'

const SET_TILE_GAS = 120 * 1000 * 1000 * 1000 * 1000;
const SET_TILE_BATCH_SIZE = 10;
const DEBUG = false;

function $forEach(selector, fn) {
    document.querySelectorAll(selector).forEach(fn);
}

const connectPromise = connectNear();
connectPromise
    .then(() => {
        if (walletConnection.isSignedIn()) {
            $forEach('.before-login', elem => elem.style.display = 'none');
            $forEach('.user-name', elem => elem.innerHTML = walletConnection.getAccountId());
        } else {
            $forEach('.require-login', elem => elem.style.display = 'none');
        }
    });

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
const CHUNK_COUNT = 5;

let lastMap = null;
let fullMap = [];
async function loadBoardAndDraw() {
    const { contract } = await connectPromise;

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
    if (setTileQueue.concat(setTileBatch).some(tile => x == tile.x && y == tile.y && tileId == tile.tileId)) {
        return;
    }

    console.log('putTileOnChain', x, y, tileId);
    setTileQueue.push({ x, y, tileId });
    updatePending();
}

function updatePending() {
    const scene = game.scene.scenes[0];

    if (!scene || !scene.messageLabel) {
        return;
    }

    if (setTileQueue.length == 0 && setTileBatch.length == 0) {
        scene.messageLabel.visible = false;
        return;
    }

    scene.messageLabel.visible = true;
    scene.messageLabel.text = `Pending: ${setTileQueue.length + setTileBatch.length}`;
}

function updateError(e) {
    console.log('updateError', e);

    const scene = game.scene.scenes[0];
    if (!scene) {
        return;
    }

    const { width } = scene.cameras.main;

    if (scene.errorLabel) {
        scene.errorLabel.destroy();
    }
    scene.errorLabel = scene.add.text(0, 0, `Last error: ${e}`, {
        fontSize: '14px',
        padding: { x: 10, y: 5 },
        backgroundColor: '#000000',
        fill: '#f00'
    });
    scene.errorLabel.setScrollFactor(0);
    scene.errorLabel.setDepth(Number.MAX_VALUE);
    scene.errorLabel.setAlpha(0.75);
    scene.errorLabel.x = Math.floor((width - scene.errorLabel.width) / 2);
    scene.errorLabel.y = scene.messageLabel.y - 10 - scene.errorLabel.height;
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

        console.log('setTiles', setTileBatch);
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

class MyGame extends Phaser.Scene
{
    constructor ()
    {
        super();

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
            width: CHUNK_SIZE * CHUNK_COUNT,
            height: CHUNK_SIZE * CHUNK_COUNT
        });

        this.desertTiles = this.mainMap.addTilesetImage('desert', 'desert', 32, 32, 1, 1);
        this.grassTiles = this.mainMap.addTilesetImage('grass', 'grass', 32, 32, 0, 0, this.desertTiles.firstgid + this.desertTiles.total);
        this.waterTiles = this.mainMap.addTilesetImage('water', 'water', 32, 32, 0, 0, this.grassTiles.firstgid + this.grassTiles.total);
        this.allTiles = [this.desertTiles, this.grassTiles, this.waterTiles];
        this.lpcTiles = [this.grassTiles, this.waterTiles];

        this.mainLayer = this.mainMap.createBlankLayer('Main', this.allTiles, 0, 0, CHUNK_SIZE * CHUNK_SIZE, CHUNK_SIZE * CHUNK_COUNT);
        this.autotileLayer = this.mainMap.createBlankLayer('Main-autotile', this.allTiles, 0, 0, CHUNK_SIZE * CHUNK_SIZE, CHUNK_SIZE * CHUNK_COUNT);
        this.mainMap.setLayer(this.mainLayer);

        this.cameras.main.setBounds(0, 0, this.mainMap.widthInPixels, this.mainMap.heightInPixels);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.inventoryKeys = [
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        ]

        this.player = this.add.player({ scene: this, x: 400, y: 300, accountId: account.accountId, controlledByUser: true });

        const roundPixels = true;
        this.cameras.main.startFollow(this.player, roundPixels);

        this.createOrUpdateUI();

        this.selectedTile = this.inventoryMap.getTileAt(5, 3);

        loadBoardAndDraw().catch(console.error);

        // Debug graphics
        if (DEBUG) {
            // Turn on physics debugging to show player's hitbox
            this.physics.world.createDebugGraphic();

            // Create worldLayer collision graphic above the player, but below the help text
            this.debugGraphics = this.add.graphics()
                .setAlpha(0.75)
                .setDepth(20);
        };

        this.scale.on('resize', () => {
            this.createOrUpdateUI();
        });
    }

    createOrUpdateUI() {
        const { width, height } = this.cameras.main;

        this.createInventory(this.desertTiles);

        if (this.logoutButton) {
            this.logoutButton.destroy();
            this.logoutButton = null;
        }
        if (this.loginButton) {
            this.loginButton.destroy();
            this.loginButton = null;
        }
        if (walletConnection.isSignedIn()) {
            this.logoutButton = this.add.text(0, 0, 'Logout', {
                fontSize: '16px',
                padding: { x: 10, y: 5 },
                backgroundColor: '#000000',
            });
            this.logoutButton.setScrollFactor(0);
            this.logoutButton.setDepth(Number.MAX_VALUE);
            this.logoutButton.setAlpha(0.75);
            this.logoutButton.setInteractive({ useHandCursor: true });
            this.logoutButton.on('pointerup', () => {
                logout();
            });
            this.logoutButton.x = width - 10 - this.logoutButton.width;
            this.logoutButton.y = 10;
        } else {
            this.loginButton = this.add.text(0, 0, 'Login with NEAR', {
                fontSize: '16px',
                padding: { x: 10, y: 5 },
                backgroundColor: '#000000',
            });
            this.loginButton.setScrollFactor(0);
            this.loginButton.setDepth(Number.MAX_VALUE);
            this.loginButton.setAlpha(0.75);
            this.loginButton.setInteractive({ useHandCursor: true });
            this.loginButton.on('pointerup', () => {
                login();
            });
            this.loginButton.x = width - 10 - this.loginButton.width;
            this.loginButton.y = 10;
        }

        if (this.messageLabel) {
            this.messageLabel.destroy();
        }
        this.messageLabel = this.add.text(0, 0, 'Pending ...', {
            fontSize: '14px',
            padding: { x: 10, y: 5 },
            backgroundColor: '#000000',
        });
        this.messageLabel.setScrollFactor(0);
        this.messageLabel.setDepth(Number.MAX_VALUE);
        this.messageLabel.setAlpha(0.75);
        this.messageLabel.x = Math.floor((width - this.messageLabel.width) / 2);
        this.messageLabel.y = height - 10 - this.messageLabel.height;
        updatePending();

        const isTouchDevice = navigator.maxTouchPoints > 0;

        if (!isTouchDevice) {
            if (this.help) {
                this.help.destroy();
            }

            this.help = this.add.text(16, 16, 'Left-click to paint.\nShift + Left-click to select tile.\nArrows to scroll. Digits to switch tiles.', {
                fontSize: '14px',
                padding: { x: 10, y: 5 },
                backgroundColor: '#000000',
                fill: '#ffffff',
                // NOTE: Looks like Brave needs explicit line height
                lineHeight: 28
            });
            this.help.setScrollFactor(0);
            this.help.setDepth(Number.MAX_VALUE);
            this.help.setAlpha(0.75);
        }

        if (isTouchDevice) {
            if (!this.joystick) {
                this.joystick = this.plugins.get('rexVirtualJoystick').add(this, {
                    x: 0,
                    y: 0,
                    radius: 70,
                    base: this.add.circle(0, 0, 70, 0x888888),
                    thumb: this.add.circle(0, 0, 30, 0xcccccc),
                })
            }
            this.joystick.x = this.joystick.base.width / 2 + 10;
            this.joystick.y = height - this.joystick.base.height / 2 - 10;
            window.joystick = this.joystick;
        }
    }

    update(time, delta) {
        var worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);

        let inventoryX = this.inventoryMap.worldToTileX(worldPoint.x);
        let inventoryY = this.inventoryMap.worldToTileY(worldPoint.y);

        let insideInventory = !!(inventoryX >= 0 && inventoryY >= 0 && inventoryX < this.inventoryMap.width && inventoryY < this.inventoryMap.height);

        let sourceMap = insideInventory ? this.inventoryMap : this.mainMap;

        let pointerTileX = sourceMap.worldToTileX(worldPoint.x);
        let pointerTileY = sourceMap.worldToTileY(worldPoint.y);

        this.marker.x = sourceMap.tileToWorldX(pointerTileX);
        this.marker.y = sourceMap.tileToWorldY(pointerTileY);
        this.marker.setDepth(insideInventory ? UI_DEPTH + 1 : 0);

        const uiElements = [this.loginButton, this.logoutButton, this.joystick?.base].filter(elem => !!elem);
        const insideUI = uiElements.some(elem =>
            Phaser.Geom.Rectangle.ContainsPoint(
                Phaser.Geom.Rectangle.Inflate(elem.getBounds(), 10, 10), this.input.activePointer.position));

        if (this.input.manager.activePointer.isDown && !insideUI) {
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
        }]
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 } // Top down game, so no gravity
        }
    },
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

    // Mark colliding tiles
    scene.mainLayer.setCollisionBetween(45, 47);
    scene.mainLayer.setCollisionBetween(37, 39);
    scene.mainLayer.setCollisionBetween(30, 31);
    scene.mainLayer.setCollisionBetween(scene.waterTiles.firstgid, scene.waterTiles.firstgid + scene.waterTiles.total);

    // TODO: Only do it for tiles that got updated
    scene.populateAutotile();

    scene.autotileLayer.setCollisionBetween(scene.waterTiles.firstgid, scene.waterTiles.firstgid + scene.waterTiles.total);
}

function updatePutTileQueue() {
    const scene = game.scene.scenes[0];

    for (let { x, y, tileId } of [...setTileBatch, ...setTileQueue]) {
        scene.mainLayer.putTileAt(tileId, x, y);
    }
}

async function onLocationUpdate({ accountId, x, y, frame, animName, animProgress, layers }) {
    if (accountId && accountId == account.accountId) {
        return;
    }

    if (!accountIdToPlayer[accountId]) {
        const scene = game.scene.scenes[0];
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

        const scene = game.scene.scenes[0];
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