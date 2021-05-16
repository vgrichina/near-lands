import Phaser from 'phaser';

export class Player extends Phaser.GameObjects.Container {
    constructor({ scene, x, y, accountId }) {
        console.log('Player', accountId, x, y);
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
        });
        nameText.setOrigin(0.5, 2.5);

        super(scene, x, y, [playerSprite, nameText]);

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
        console.log('updateFromRemote');
        this.targetPosition = { x, y };
        if (animName) {
            this.anims.play(animName, true);
            this.anims.setProgress(animProgress);
        } else {
            this.anims.stop();
            this.playerSprite.setFrame(frame);
        }
    }
}