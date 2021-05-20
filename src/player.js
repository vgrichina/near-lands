import Phaser from 'phaser';

const PLAYER_SPEED = 0.5;

export const UPDATE_DELTA = 50;

export class Player extends Phaser.GameObjects.Container {
    constructor({ scene, x, y, accountId, controlledByUser }) {
        const playerSprites = [
            // scene.add.sprite(0, 0, 'body-female-light')
            scene.add.sprite(0, 0, 'princess')
        ];
        const nameText = scene.add.text(0, 0, accountId, {
            fontSize: 16,
            fontFamily: 'sans-serif',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            padding: {
                left: 8,
                right: 8,
                top: 4,
                bottom: 4,
            },
            // NOTE: Specifying height explicitly to avoid non-round pixels when combined with origin
            fixedHeight: 28,
            // NOTE: Looks like Brave needs explicit line height
            lineHeight: 28
        });
        nameText.setOrigin(0.5, 2.5);

        super(scene, x, y, [...playerSprites, nameText]);

        this.controlledByUser = controlledByUser;

        scene.physics.world.enableBody(this);
        this.body
            .setSize(20, 20)
            .setOffset(-10, 10);

        this.playerSprites = playerSprites;

        scene.physics.add.collider(this, scene.mainLayer);
        scene.physics.add.collider(this, scene.autotileLayer);

        const { anims } = scene;

        const range = (start, end) => Array.from({length: (end - start)}, (v, k) => k + start);
    
        function createAnim(key, imageKey, i, start, end) {
            anims.create({
                key: `${key}-${i}`,
                frames: anims.generateFrameNumbers(imageKey, { frames: range(start, end) }),
                frameRate: 10,
                repeat: -1
            });
        }

        playerSprites.forEach((sprite, i) => {
            const imageKey = sprite.texture.key;
            createAnim('player-left-walk', imageKey, i, 9, 17);
            createAnim('player-right-walk', imageKey, i, 27, 36);
            createAnim('player-up-walk', imageKey, i, 0, 8);
            createAnim('player-down-walk', imageKey, i, 18, 26);
        });
    }

    updateFromRemote({ x, y, frame, animName, animProgress }) {
        this.targetPosition = { x, y };
        if (animName) {
            this.play(animName, true);
            this.setAnimProgress(animProgress);
        } else {
            this.stopAnims();
            this.setSpriteFrame(frame);
        }
    }

    stopAnims() {
        for (let sprite of this.playerSprites) {
            sprite.anims.stop();
        }
    }

    setSpriteFrame(frame) {
        for (let sprite of this.playerSprites) {
            sprite.setFrame(frame);
        }
    }

    setAnimProgress(animProgress) {
        for (let sprite of this.playerSprites) {
            sprite.anims.setProgress(animProgress);
        }
    }

    play(animName, ignoreIfPlaying) {
        this.playerSprites.forEach((sprite, i) => {
            sprite.play(`${animName}-${i}`, ignoreIfPlaying);
        });
    }

    preUpdate(time, delta) {
        if (this.targetPosition) {
            this.setPosition(
                this.x + (this.targetPosition.x - this.x) / UPDATE_DELTA * delta,
                this.y + (this.targetPosition.y - this.y) / UPDATE_DELTA * delta,
            );
        }

        if (!this.controlledByUser) {
            return;
        }        

        // Stop any previous movement from the last frame
        const prevVelocity = this.body.velocity.clone();
        this.body.setVelocity(0);

        const speed = 1000 * PLAYER_SPEED;

        if (this.scene.gamepad) {
            this.body.setVelocityX(this.scene.gamepad.joystick.properties.x / 100 * speed);
            this.body.setVelocityY(this.scene.gamepad.joystick.properties.y / 100 * speed);
        }

        if (this.scene.cursors.left.isDown) {
            this.body.setVelocityX(-100);
        } else if (this.scene.cursors.right.isDown) {
            this.body.setVelocityX(100);
        }
        if (this.scene.cursors.up.isDown) {
            this.body.setVelocityY(-100);
        } else if (this.scene.cursors.down.isDown) {
            this.body.setVelocityY(100);
        }

        if (Math.abs(this.body.velocity.y) < Math.abs(this.body.velocity.x)) {
            if (this.body.velocity.x < 0) {
                this.play("player-left-walk", true);
            } else if (this.body.velocity.x > 0) {
                this.play("player-right-walk", true);
            }
        } else {
            if (this.body.velocity.y < 0) {
                this.play("player-up-walk", true);
            } else if (this.body.velocity.y > 0) {
                this.play("player-down-walk", true);
            }
        }

        if (!this.scene.gamepad || !this.scene.gamepad.joystick.distance) {
            // Normalize and scale the velocity so that player can't move faster along a diagonal
            this.body.velocity.normalize().scale(speed);
        }

        if (this.body.velocity.length() == 0) {
            // If we were moving, pick and idle frame to use
            this.stopAnims();
            if (prevVelocity.x < 0) this.setSpriteFrame(9);
            else if (prevVelocity.x > 0) this.setSpriteFrame(27);
            else if (prevVelocity.y < 0) this.setSpriteFrame(0);
            else if (prevVelocity.y > 0) this.setSpriteFrame(18);
        }
    }
}