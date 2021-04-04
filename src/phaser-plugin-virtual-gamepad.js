/**
 * Phaser Plugin - Virtual Gamepad
 * @author      Shawn Hymel <@ShawnHymel>
 * @copyright   2016 Shawn Hymel
 * @license     {@link http://opensource.org/licenses/MIT}
 * @version     0.1.0
 *
 * Joystick math is based on work by Eugenio Fage, whose original touch control
 * plugin can be found at: 
 * https://github.com/Gamegur-us/phaser-touch-control-plugin
 *
 * The MIT License (MIT)
 * Copyright (c) 2016 Shawn Hymel
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy 
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights 
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell 
 * copies of the Software, and to permit persons to whom the Software is 
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in 
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Static variables
var UP_LOWER_BOUND = -7 * (Math.PI / 8);
var UP_UPPER_BOUND = -1 * (Math.PI / 8);
var DOWN_LOWER_BOUND = Math.PI / 8;
var DOWN_UPPER_BOUND = 7 * (Math.PI / 8);
var RIGHT_LOWER_BOUND = -3 * (Math.PI / 8);
var RIGHT_UPPER_BOUND = 3 * (Math.PI / 8);
var LEFT_LOWER_BOUND = 5 * (Math.PI / 8);
var LEFT_UPPER_BOUND = -5 * (Math.PI / 8);

export class VirtualGamepad extends Phaser.Plugins.ScenePlugin {
    
    /**
     * The Virtual Gamepad adds a thumbstick and button(s) to mobile devices.
     *
     * @class Phaser.Plugin.VirtualGamepad
     * @constructor
     */
    constructor(scene, pluginManager) {
        super(scene, pluginManager);
        
        // Class members
        this.joystick = null;
        this.joystickPad = null;
        this.joystickPoint = null;
        this.joystickRadius = null;
        this.joystickPointer = null;
        this.button = null;
        this.buttonPoint = null;
        this.buttonRadius = null;
    }

    boot() {
        let eventEmitter = this.systems.events;
        
        // Polling for the joystick and button pushes
        eventEmitter.on('preupdate', this.gamepadPoll.bind(this));
    };
    
    /**
     * Add a joystick to the screen (only one joystick allowed for now)
     *
     * @method Phaser.Plugin.VirtualGamepad#addJoystick
     * @param {number} x - Position (x-axis) of the joystick on the canvas
     * @param {number} y - Position (y-axis) of the joystick on the canvas
     * @param {number} scale - Size of the sprite. 1.0 is 100x100 pixels
     * @param {String} key - key for the gamepad's spritesheet
     * @param {Phaser.Sprite} The joystick object just created
     */
    addJoystick(x, y, scale, key) {
    
        // If we already have a joystick, return null
        if (this.joystick !== null) {
            return null;
        }
        
        // Add the joystick to the game
        this.joystick = this.scene.add.sprite(x, y, key, 2);
        // this.joystick.anchor.set(0.5);
        this.joystick.setScrollFactor(0);
        this.joystick.setScale(scale);
        this.joystickPad = this.scene.add.sprite(x, y, key, 3);
        // this.joystickPad.anchor.set(0.5);
        this.joystickPad.setScrollFactor(0);
        this.joystickPad.setScale(scale);
        
        // Remember the coordinates of the joystick
        this.joystickPoint = new Phaser.Geom.Point(x, y);
        
        // Set up initial joystick properties
        this.joystick.properties = {
            inUse: false,
            up: false,
            down: false,
            left: false,
            right: false,
            x: 0,
            y: 0,
            distance: 0,
            angle: 0,
            rotation: 0
        };
        
        // Set the touch area as defined by the button's radius
        this.joystickRadius = scale * (this.joystick.width / 2);
        
        return this.joystick;    
    };
    
    /**
     * Add a button to the screen (only one button allowed for now)
     *
     * @method Phaser.Plugin.VirtualGamepad#addButton
     * @param {number} x - Position (x-axis) of the button on the canvas
     * @param {number} y - Position (y-axis) of the button on the canvas
     * @param {number} scale - Size of the sprite. 1.0 is 100x100 pixels
     * @param {String} key - key for the gamepad's spritesheet
     * @param {Phaser.Button} The button object just created
     */
    addButton(x, y, scale, key) {
                                                                
        // If we already have a button, return null
        if (this.button !== null) {
            return null;
        }
                                                                
        // Add the button to the game
        this.button = this.scene.add.sprite(x, y, key);
        // this.button.anchor.set(0.5);
        this.button.setScrollFactor(0);
        this.button.setScale(scale);
        
        // Remember the coordinates of the button
        this.buttonPoint = new Phaser.Geom.Point(x, y);
        
        // Set up initial button state
        this.button.isDown = false;
        
        // Set the touch area as defined by the button's radius
        this.buttonRadius = scale * (this.button.width / 2);
        
        return this.button;
    };
    
    // TODO: Mark as private with _?
    buttonDown() {
        this.button.isDown = true;
    };
    
    buttonUp() {
        this.button.isDown = false;
    };
    
    gamepadPoll() {
        if (!this.button) {
            return;
        }
        
        var resetJoystick = true;
        
        // See if any pointers are in range of the joystick or buttons
        this.button.isDown = false;
        // TODO: Don't hardcoded texture key here
        this.button.setTexture('gamepad', 0);

        this.scene.game.input.pointers.forEach(function(p) {
            resetJoystick = this.testDistance(p);
        }, this);

        // If the pointer is removed, reset the joystick
        if (resetJoystick) {
            if ((this.joystickPointer === null) || !this.joystickPointer.isDown) {
                this.moveJoystick(this.joystickPoint);
                this.joystick.properties.inUse = false;
                this.joystickPointer = null;
            }
        }
        
    };
    
    testDistance(pointer) {
    
        var reset = true;
    
        // See if the pointer is over the joystick
        var d = Phaser.Math.Distance.BetweenPoints(this.joystickPoint, pointer.position);
        if ((pointer.isDown) && ((pointer === this.joystickPointer) || 
            (d < this.joystickRadius))) {
            reset = false;
            this.joystick.properties.inUse = true;
            this.joystickPointer = pointer;
            this.moveJoystick(pointer.position);
        }
        
        // See if the pointer is over the button
        d = Phaser.Math.Distance.BetweenPoints(this.buttonPoint, pointer.position);
        if ((pointer.isDown) && (d < this.buttonRadius)) {
            this.button.isDown = true;
            // TODO: Don't hardcoded texture key here
            this.button.setTexture('gamepad', 1);
        }
        
        return reset;
    };
    
    moveJoystick(point) {
        // Calculate x/y of pointer from joystick center
        var deltaX = point.x - this.joystickPoint.x;
		var deltaY = point.y - this.joystickPoint.y;
        
        // Get the angle (radians) of the pointer on the joystick
        var rotation = Phaser.Math.Angle.BetweenPoints(this.joystickPoint, point);
        
        // Set bounds on joystick pad
        if (Phaser.Math.Distance.BetweenPoints(this.joystickPoint, point) > this.joystickRadius) {
            deltaX = (deltaX === 0) ? 
                0 : Math.cos(rotation) * this.joystickRadius;
            deltaY = (deltaY === 0) ?
                0 : Math.sin(rotation) * this.joystickRadius;
        }
        
        // Normalize x/y
        this.joystick.properties.x = parseInt((deltaX / 
            this.joystickRadius) * 100, 10);
		this.joystick.properties.y = parseInt((deltaY  /
            this.joystickRadius) * 100, 10);
        
        // Set polar coordinates
        this.joystick.properties.rotation = rotation;
        this.joystick.properties.angle = (180 / Math.PI) * rotation;
        this.joystick.properties.distance = 
            parseInt((Phaser.Math.Distance.BetweenPoints(this.joystickPoint, point) / 
            this.joystickRadius) * 100, 10);
            
        // Set d-pad directions
        this.joystick.properties.up = ((rotation > UP_LOWER_BOUND) && 
            (rotation <= UP_UPPER_BOUND));
        this.joystick.properties.down = ((rotation > DOWN_LOWER_BOUND) && 
            (rotation <= DOWN_UPPER_BOUND));
        this.joystick.properties.right = ((rotation > RIGHT_LOWER_BOUND) && 
            (rotation <= RIGHT_UPPER_BOUND));
        this.joystick.properties.left = ((rotation > LEFT_LOWER_BOUND) || 
            (rotation <= LEFT_UPPER_BOUND));
            
        // Fix situation where left/right is true if X/Y is centered
        if ((this.joystick.properties.x === 0) && 
            (this.joystick.properties.y === 0)) {
            this.joystick.properties.right = false;
            this.joystick.properties.left = false;
        }
        
        // Move joystick pad images
        this.joystickPad.x = this.joystickPoint.x + deltaX;
        this.joystickPad.y = this.joystickPoint.y + deltaY;
    };
    
};
