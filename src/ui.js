import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene', active: true });
    }

    create() {
        this.input.addPointer(2);

        this.createOrUpdateUI();
        this.scale.on('resize', () => {
            this.createOrUpdateUI();
        });
    }

    createOrUpdateUI() {
        const { width, height } = this.cameras.main;

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
                metrics: { ascent: 13, descent: 4, fontSize: 17 }
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
                metrics: { ascent: 13, descent: 4, fontSize: 17 }
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
            metrics: { ascent: 12, descent: 4, fontSize: 16 }
        });
        this.messageLabel.setScrollFactor(0);
        this.messageLabel.setDepth(Number.MAX_VALUE);
        this.messageLabel.setAlpha(0.75);
        this.messageLabel.x = Math.floor((width - this.messageLabel.width) / 2);
        this.messageLabel.y = height - 10 - this.messageLabel.height;

        if (this.modeButtons) {
            this.modeButtons.destroy();
        }
        this.modeButtons = this.rexUI.add.buttons({
            orientation: 'x',
            buttons: [
                this.createButton('Walk', 'walk'),
                this.createButton('Build', 'build')
            ],
            type: 'radio',
            setValueCallback: (button, value) => {
                button
                    .setAlpha(value ? 0.75 : 0.5);
            },
            space: { item: 8 }
        }).layout();
        this.modeButtons.value = 'walk';
        this.modeButtons.x = Math.floor(width / 2);
        this.modeButtons.y = 30;

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
                metrics: { ascent: 12, descent: 4, fontSize: 16 }
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
            this.joystick.base.removeInteractive();
            this.joystick.base.setInteractive({
                hitArea: new Phaser.Geom.Circle(this.joystick.base.displayOriginX, this.joystick.base.displayOriginY, 150),
                hitAreaCallback: Phaser.Geom.Circle.Contains,
            });
            window.joystick = this.joystick;
        }

        const gameScene = this.scene.get('GameScene');
        this.input.on('gameobjectout', () => gameScene.marker.visible = true);
        this.input.on('gameobjectover', () => gameScene.marker.visible = false);
    }

    createButton(text, name) {
        const button = this.add.text(0, 0, text, {
            fontSize: '16px',
            padding: { x: 10, y: 5 },
            backgroundColor: '#000000',
            metrics: { ascent: 13, descent: 4, fontSize: 17 }
        });
        button.name = name;
        button.setAlpha(0.75);
        return button;
    }

    update() {

    }

    updatePending({ setTileQueue, setTileBatch }) {
        if (setTileQueue.length == 0 && setTileBatch.length == 0) {
            this.messageLabel.visible = false;
            return;
        }

        this.messageLabel.visible = true;
        this.messageLabel.text = `Pending: ${setTileQueue.length + setTileBatch.length}`;
    }

    updateError(e) {
        const { width } = this.cameras.main;

        if (this.errorLabel) {
            this.errorLabel.destroy();
        }
        this.errorLabel = this.add.text(0, 0, `Last error: ${e}`, {
            fontSize: '14px',
            padding: { x: 10, y: 5 },
            backgroundColor: '#000000',
            fill: '#f00'
        });
        this.errorLabel.setScrollFactor(0);
        this.errorLabel.setDepth(Number.MAX_VALUE);
        this.errorLabel.setAlpha(0.75);
        this.errorLabel.x = Math.floor((width - this.errorLabel.width) / 2);
        this.errorLabel.y = this.messageLabel.y - 10 - this.errorLabel.height;
    }
}