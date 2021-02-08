import Phaser from 'phaser';

import tilesImg from './assets/tilemaps/tiles/tmw_desert_spacing.png';
import mapJson from './assets/tilemaps/maps/desert.json';

var controls;
var marker;
var map;
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
        this.load.tilemapTiledJSON('map', mapJson);
    }

    create() {
        map = this.make.tilemap({ key: 'map' });

        // The first parameter is the name of the tileset in Tiled and the second parameter is the key
        // of the tileset image used when loading the file in preload.
        var tiles = map.addTilesetImage('Desert', 'tiles');

        // You can load a layer from the map using the layer name from Tiled ('Ground' in this case), or
        // by using the layer index. Since we are going to be manipulating the map, this needs to be a
        // dynamic tilemap layer, not a static one.
        var layer = map.createLayer('Ground', tiles, 0, 0);

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
        this.inventoryMap.createLayer(0, tiles, inventoryX, inventoryY);

        this.inventoryBorder = this.add.graphics();
        this.inventoryBorder.lineStyle(2, 0x000000, 1);
        this.inventoryBorder.strokeRect(inventoryX, inventoryY, this.inventoryMap.widthInPixels, this.inventoryMap.heightInPixels);

        selectedTile = map.getTileAt(2, 3);

        marker = this.add.graphics();
        marker.lineStyle(2, 0x000000, 1);
        marker.strokeRect(0, 0, map.tileWidth, map.tileHeight);

        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

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
    }

    update(time, delta) {
        controls.update(delta);

        var worldPoint = this.input.activePointer.positionToCamera(this.cameras.main);

        let inventoryX = this.inventoryMap.worldToTileX(worldPoint.x);
        let inventoryY = this.inventoryMap.worldToTileY(worldPoint.y);

        let insideInventory = !!(inventoryX >= 0 && inventoryY >= 0 && inventoryX < this.inventoryMap.width && inventoryY < this.inventoryMap.height);

        let sourceMap = insideInventory ? this.inventoryMap : map;

        let pointerTileX = sourceMap.worldToTileX(worldPoint.x);
        let pointerTileY = sourceMap.worldToTileY(worldPoint.y);

        marker.x = sourceMap.tileToWorldX(pointerTileX);
        marker.y = sourceMap.tileToWorldY(pointerTileY);

        if (this.input.manager.activePointer.isDown) {
            if (shiftKey.isDown || sourceMap == this.inventoryMap) {
                selectedTile = sourceMap.getTileAt(pointerTileX, pointerTileY);
            } else if (sourceMap == map) {
                map.putTileAt(selectedTile, pointerTileX, pointerTileY);
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
