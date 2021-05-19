import Phaser from 'phaser';

const PLAYER_SPEED = 0.5;

export const UPDATE_DELTA = 50;

export class Player extends Phaser.GameObjects.Container {
    constructor({ scene, x, y, accountId, controlledByUser }) {
        const playerSprite = scene.add.sprite(0, 0, "princess")
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
            fixedHeight: 28
        });
        nameText.setOrigin(0.5, 2.5);

        super(scene, x, y, [playerSprite, nameText]);

        this.controlledByUser = controlledByUser;

        scene.physics.world.enableBody(this);
        this.body
            .setSize(20, 20)
            .setOffset(-10, 10);

        this.setTexture = playerSprite.setTexture.bind(playerSprite);
        this.playerSprite = playerSprite;

        scene.physics.add.collider(this, scene.mainLayer);
        scene.physics.add.collider(this, scene.autotileLayer);

        this.anims = playerSprite.anims;
        const anims = scene.anims;
        anims.create({
            key: "player-left-walk",
            frames: anims.generateFrameNumbers("princess", { frames: [9, 10, 11, 12, 13, 14, 15, 16, 17] }),
            frameRate: 10,
            repeat: -1
        });
        anims.create({
            key: "player-right-walk",
            frames: anims.generateFrameNumbers("princess", { frames: [27, 28, 29, 30, 31, 32, 33, 34, 35, 36] }),
            frameRate: 10,
            repeat: -1
        });
        anims.create({
            key: "player-up-walk",
            frames: anims.generateFrameNumbers("princess", { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8] }),
            frameRate: 10,
            repeat: -1
        });
        anims.create({
            key: "player-down-walk",
            frames: anims.generateFrameNumbers("princess", { frames: [18, 19, 20, 21, 22, 23, 24, 25, 26] }),
            frameRate: 10,
            repeat: -1
        });
    }

    updateFromRemote({ x, y, frame, animName, animProgress }) {
        this.targetPosition = { x, y };
        if (animName) {
            this.anims.play(animName, true);
            this.anims.setProgress(animProgress);
        } else {
            this.anims.stop();
            this.playerSprite.setFrame(frame);
        }
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
                this.anims.play("player-left-walk", true);
            } else if (this.body.velocity.x > 0) {
                this.anims.play("player-right-walk", true);
            }
        } else {
            if (this.body.velocity.y < 0) {
                this.anims.play("player-up-walk", true);
            } else if (this.body.velocity.y > 0) {
                this.anims.play("player-down-walk", true);
            }
        }

        if (!this.scene.gamepad || !this.scene.gamepad.joystick.distance) {
            // Normalize and scale the velocity so that player can't move faster along a diagonal
            this.body.velocity.normalize().scale(speed);
        }

        if (this.body.velocity.length() == 0) {
            // If we were moving, pick and idle frame to use
            this.anims.stop();
            if (prevVelocity.x < 0) this.setTexture("princess", 9);
            else if (prevVelocity.x > 0) this.setTexture("princess", 27);
            else if (prevVelocity.y < 0) this.setTexture("princess", 0);
            else if (prevVelocity.y > 0) this.setTexture("princess", 18);
        }
    }
}