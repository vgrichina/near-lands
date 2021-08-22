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
            'shirts/sleeveless/female/brown_pirate',
            'shirts/sleeveless/female/brown_sleeveless',
            'shirts/sleeveless/female/maroon_pirate',
            'shirts/sleeveless/female/maroon_sleeveless',
            'shirts/sleeveless/female/teal_pirate',
            'shirts/sleeveless/female/teal_sleeveless',
            'shirts/sleeveless/female/white_pirate',
            'shirts/sleeveless/female/white_sleeveless',
            'tunics/female/brown_tunic',
            'tunics/female/maroon_tunic',
            'tunics/female/teal_tunic',
            'tunics/female/white_tunic',
        ],
        male: [
            'shirts/longsleeve/male/brown_longsleeve',
            'shirts/longsleeve/male/maroon_longsleeve',
            'shirts/longsleeve/male/teal_longsleeve',
            'shirts/longsleeve/male/white_longsleeve',
        ]
    };
    const LEGS = {
        female: [
            'pants/female/magenta_pants_female',
            'pants/female/red_pants_female',
            'pants/female/teal_pants_female',
            'pants/female/white_pants_female',
            'skirt/female/robe_skirt_female_incomplete',
        ],
        male: [
            'pants/male/magenta_pants_male',
            'pants/male/red_pants_male',
            'pants/male/teal_pants_male',
            'pants/male/white_pants_male',
            'skirt/male/robe_skirt_male',
        ]
    };
    const FEET = {
        female: [
            'shoes/female/black_shoes_female',
            'shoes/female/brown_shoes_female',
            'shoes/female/maroon_shoes_female',
            'slippers_female/black',
            'slippers_female/brown',
            'slippers_female/gray',
            'slippers_female/white',
        ],
        male: [
            'shoes/male/black_shoes_male',
            'shoes/male/brown_shoes_male',
            'shoes/male/maroon_shoes_male',
        ]
    };

    const selectRandom = (items) => items[Math.floor(Math.random() * items.length)];

    const bodyType = selectRandom(BODY_TYPE);
    const skinColor = selectRandom(SKIN_COLOR);
    const haircut = selectRandom(HAIRCUT);
    const hairColor = selectRandom(HAIR_COLOR);
    const torso = selectRandom(TORSO[bodyType]);
    const feet = selectRandom(FEET[bodyType]);

    const needsLegsCover = !torso.includes('dress');
    const legs = needsLegsCover && selectRandom(LEGS[bodyType]);

    const layers = [
        `body/${bodyType}/${skinColor}`,
        `hair/${bodyType}/${haircut}/${hairColor}`,
        `feet/${feet}`,
        `torso/${torso}`,
    ]
    if (needsLegsCover) {
        layers.push(`legs/${legs}`);
    }

    return layers.map(layer => `/lpc-character/${layer}.png`);
}

function createAnim(scene, key, imageKey, i, row) {
    const { anims } = scene;
    const start = row * FRAMES_PER_ROW;
    const end = row * FRAMES_PER_ROW + FRAMES_PER_ROW_ANIM;
    const animKey = `${key}:${imageKey}:${i}`;
    anims.remove(animKey);
    anims.create({
        key: animKey,
        frames: anims.generateFrameNumbers(imageKey, { frames: range(start, end) }),
        frameRate: 10,
        repeat: -1
    });
}

function createSprites(scene, layers) {
    const playerSprites = layers.map(layer => scene.add.sprite(0, 0, layer))
    playerSprites.forEach((sprite, i) => {
        const imageKey = sprite.texture.key;
        createAnim(scene, 'player-up-walk', imageKey, i, 8);
        createAnim(scene, 'player-left-walk', imageKey, i, 9);
        createAnim(scene, 'player-down-walk', imageKey, i, 10);
        createAnim(scene, 'player-right-walk', imageKey, i, 11);
    });
    return playerSprites;
}

function arrayEquals(a, b) {
    return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
}

const allLoaded = (scene, layers) => layers.every(layer => scene.textures.exists(layer));

export class Player extends Phaser.GameObjects.Container {
    constructor({ scene, x, y, accountId, controlledByUser, layers = randomLayers() }) {
        const playerSprites = createSprites(scene, ['skeleton']);

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
            metrics: { ascent: 15, descent: 4, fontSize: 19 }
        });
        nameText.setOrigin(0.5, 2.5);
        console.log('name metrics', nameText.getTextMetrics());

        super(scene, x, y, [...playerSprites, nameText]);
        this.controlledByUser = controlledByUser;
        this.playerSprites = playerSprites;

        scene.physics.world.enableBody(this);
        this.body
            .setSize(20, 20)
            .setOffset(-10, 10)
            .setCollideWorldBounds(true);

        scene.physics.add.collider(this, scene.mainLayer);
        scene.physics.add.collider(this, scene.autotileLayer);

        this.preloadLayers(layers);
    }

    get layers() {
        return this.playerSprites.map(sprite => sprite.texture.key);
    }

    preloadLayers(layers) {
        const scene = this.scene;
        for (let layer of layers) {
            scene.load.spritesheet({ key: layer, url: layer, frameConfig: { frameWidth: 64, frameHeight: 64 } });
        }

        scene.load.once(Phaser.Loader.Events.COMPLETE, () => this.updateLayers(layers));
        scene.load.start();
    }

    updateLayers(layers, recurse = true) {
        if (!allLoaded(this.scene, layers)) {
            if (recurse) {
                this.preloadLayers(layers);
            } else {
                layers.forEach(layer => {
                    if (!scene.textures.exists(layer)) {
                        console.error(`Couldn't load`, layer);
                    }
                });
            }
            return;
        }

        if (!arrayEquals(this.layers, layers)) {
            console.info('updating layers', this.layers, layers);
            for (let sprite of this.playerSprites) {
                this.remove(sprite);
            }
            this.playerSprites = createSprites(this.scene, layers);
            this.add(this.playerSprites);
        }
    }

    updateFromRemote({ x, y, layers, frame, animName, animProgress }) {
        this.targetPosition = { x, y };

        if (layers) {
            this.updateLayers(layers);
        }

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
            if (sprite.anims.currentAnim) {
                sprite.anims.setProgress(animProgress);
            }
        }
    }

    play(animName, ignoreIfPlaying) {
        this.playerSprites.forEach((sprite, i) => {
            const spriteAnimName = `${animName}:${sprite.texture.key}:${i}`;
            if (!this.scene.anims.exists(spriteAnimName)) {
                console.warn('No such animation', spriteAnimName);
                return;
            }
            sprite.play(spriteAnimName, ignoreIfPlaying);
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

        const uiScene = this.scene.scene.get('UIScene');

        // Stop any previous movement from the last frame
        const prevVelocity = this.body.velocity.clone();
        this.body.setVelocity(0);

        const speed = 500 * PLAYER_SPEED;

        if (uiScene.joystick) {
            this.body.setVelocityX(uiScene.joystick.forceX / uiScene.joystick.radius * speed);
            this.body.setVelocityY(uiScene.joystick.forceY / uiScene.joystick.radius * speed);
        }

        if (this.scene.cursors.left.isDown || this.scene.wasdCursors.left.isDown) {
            this.body.setVelocityX(-speed);
        } else if (this.scene.cursors.right.isDown || this.scene.wasdCursors.right.isDown) {
            this.body.setVelocityX(speed);
        }
        if (this.scene.cursors.up.isDown || this.scene.wasdCursors.up.isDown) {
            this.body.setVelocityY(-speed);
        } else if (this.scene.cursors.down.isDown || this.scene.wasdCursors.down.isDown) {
            this.body.setVelocityY(speed);
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

        if (!uiScene.joystick || uiScene.joystick.force > uiScene.joystick.radius) {
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