import Phaser from 'phaser';

const PLAYER_SPEED = 0.5;

export const UPDATE_DELTA = 50;
export const FRAMES_PER_ROW = 13;
export const FRAMES_PER_ROW_ANIM = 9;

const range = (start, end) => Array.from({ length: (end - start) }, (v, k) => k + start);

function randomLayers() {
    // TODO: Expand the list to cover all LPC variety
    const BODY_TYPE = [ 'male', 'female' ];
    const SKIN_COLOR = [ 'dark', 'dark2', 'darkelf', 'darkelf2', 'light', 'orc', 'red_orc', 'tanned', 'tanned2' ];
    const HAIRCUT = [
        'bangs', 'bangslong', 'bangslong2',
        'bangsshort', 'bedhead', 'bunches',
        'jewfro', 'long', 'longhawk',
        'longknot', 'loose', 'messy1',
        'messy2', 'mohawk', 'page',
        'page2', 'parted', 'pixie',
        'plain', 'ponytail', 'ponytail2',
        'princess', 'shorthawk', 'shortknot',
        'shoulderl', 'shoulderr', 'swoop',
        'unkempt', 'xlong', 'xlongknot'
    ];
    const HAIR_COLOR = [
        'black', 'blonde', 'blonde2',
        'blue', 'blue2', 'brown',
        'brown2', 'brunette', 'brunette2',
        'dark-blonde', 'gold', 'gray',
        'gray2', 'green', 'green2',
        'light-blonde', 'light-blonde2', 'pink',
        'pink2', 'purple', 'raven',
        'raven2', 'redhead', 'redhead2',
        'ruby-red', 'white-blonde', 'white-blonde2',
        'white-cyan', 'white'
    ];
    const TORSO = {
        female: [
            'dress_female/dress_w_sash_female',
            'dress_female/underdress',
        ],
        male: [
            'shirts/longsleeve/male/brown_longsleeve',
            'shirts/longsleeve/male/maroon_longsleeve',
            'shirts/longsleeve/male/teal_longsleeve',
            'shirts/longsleeve/male/white_longsleeve',
        ]
    };
    const PANTS = {
        male: [
            'magenta_pants_male',
            'red_pants_male',
            'teal_pants_male',
            'white_pants_male'
        ]
    }

    const selectRandom = (items) => items[Math.floor(Math.random() * items.length)];

    const bodyType = selectRandom(BODY_TYPE);
    const skinColor = selectRandom(SKIN_COLOR);
    const haircut = selectRandom(HAIRCUT);
    const hairColor = selectRandom(HAIR_COLOR);
    const torso = selectRandom(TORSO[bodyType]);

    const needsPants = !torso.includes('dress');
    const pants = needsPants && selectRandom(PANTS[bodyType]);

    const layers = [
        `body/${bodyType}/${skinColor}`,
        `hair/${bodyType}/${haircut}/${hairColor}`,
        `torso/${torso}`,
    ]
    if (needsPants) {
        layers.push(`legs/pants/${bodyType}/${pants}`);
    }

    return layers.map(layer => `/lpc-character/${layer}.png`);
}

export class Player extends Phaser.GameObjects.Container {
    constructor({ scene, x, y, accountId, controlledByUser }) {
        const layers = randomLayers();
        console.log('layers', layers);
        
        for (let layer of layers) {
            scene.load.spritesheet({ key: layer, url: layer, frameConfig: { frameWidth: 64, frameHeight: 64 }});
        }
        scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
            if (this.playerSprites[0].texture.key == 'skeleton') {
                this.remove(this.playerSprites[0]);
                this.playerSprites = createSprites(layers);
                this.add(this.playerSprites);
            }

            layers.forEach(layer => {
                if (!scene.textures.exists(layer)) {
                    console.error(`Couldn't load`, layer);
                }
            });
        });
        scene.load.start();

        const allLoaded = layers.every(layer => scene.textures.exists(layer));
        const playerSprites = allLoaded ? createSprites(layers) : createSprites(['skeleton']);

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
    
        function createAnim(key, imageKey, i, row) {
            const { anims } = scene;
            const start = row * FRAMES_PER_ROW;
            const end = row * FRAMES_PER_ROW + FRAMES_PER_ROW_ANIM;
            const animKey = `${key}-${i}`;
            anims.remove(animKey);
            anims.create({
                key: animKey,
                frames: anims.generateFrameNumbers(imageKey, { frames: range(start, end) }),
                frameRate: 10,
                repeat: -1
            });
        }

        function createSprites(layers) {
            const playerSprites = layers.map(layer => scene.add.sprite(0, 0, layer))
            playerSprites.forEach((sprite, i) => {
                const imageKey = sprite.texture.key;
                createAnim('player-up-walk', imageKey, i, 8);
                createAnim('player-left-walk', imageKey, i, 9);
                createAnim('player-down-walk', imageKey, i, 10);
                createAnim('player-right-walk', imageKey, i, 11);
            });
            return playerSprites;
        }
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
            if (prevVelocity.y < 0) {
                this.setSpriteFrame(FRAMES_PER_ROW * 8);
            } else if (prevVelocity.x < 0) {
                this.setSpriteFrame(FRAMES_PER_ROW * 9);
            } else if (prevVelocity.y > 0) {
                this.setSpriteFrame(FRAMES_PER_ROW * 10);
            } else if (prevVelocity.x > 0) {
                this.setSpriteFrame(FRAMES_PER_ROW * 11);
            }
        }
    }
}