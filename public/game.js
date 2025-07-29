// Socket.IO connection
const socket = io();

// Game variables
let currentPlayer = null;
let players = {};
let cursors;
let playerSprites = {};
let playerLabels = {};
let isChatFocused = false; // Global chat focus state

class HubScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HubScene' });
        this.tileSize = 64;
        this.mapWidth = 40;
        this.mapHeight = 40;
        this.tiles = [];
        this.obstacles = [];
        this.player = null;
        this.playerContainer = null;
        this.playerAvatar = null;
        this.weaponSprite = null;
        this.isMoving = false;
        this.walkBobTween = null;
        this.facingDirection = 1; // 1 for right, -1 for left
        this.lastMoveDirection = { x: 0, y: 0 };
        
        // Soul Knight-style weapon system
        this.activeSide = "right"; // Combat side: "left" or "right"
        this.pivotY = 0; // Vertical pivot adjustment (-40 to +40)
        this.lastMouseY = 0; // Track mouse Y for G key adjustment
        this.isAdjustingPivot = false; // Track if G key is held
        
        this.itemSwingTween = null;
        this.interactionZones = [];
        this.nearbyZone = null;
        this.coinsText = null;
        this.interactionText = null;
        this.playerCoins = 0;
        this.playerHealth = 100;
        this.maxHealth = 100;
        
        // Inventory system
        this.hotbar = Array(9).fill(null);
        this.activeSlot = 0;
        this.hotbarUI = null;
        this.hotbarSlots = [];
        
        // Equipment system
        this.equipment = {
            helmet: null,
            chestplate: null,
            leggings: null,
            boots: null
        };
        this.equipmentPanel = null;
        this.equipmentSlots = {};
        this.isEquipmentOpen = false;
        this.playerDefense = 0;
        
        // Item definitions
        this.itemTypes = {
            stick: { name: 'Stick', color: 0x8b4513, type: 'weapon' },
            sword: { name: 'Sword', color: 0xc0c0c0, type: 'weapon' },
            fishing_rod: { name: 'Fishing Rod', color: 0x8b4513, type: 'tool' },
            iron_helmet: { name: 'Iron Helmet', color: 0x696969, type: 'helmet', defense: 5 },
            iron_chestplate: { name: 'Iron Chestplate', color: 0x696969, type: 'chestplate', defense: 10 },
            iron_leggings: { name: 'Iron Leggings', color: 0x696969, type: 'leggings', defense: 7 },
            iron_boots: { name: 'Iron Boots', color: 0x696969, type: 'boots', defense: 3 }
        };
    }

    preload() {
        // Create placeholder graphics for tiles
        this.createPlaceholderAssets();
        
        // Try to load assets if they exist
        this.load.on('filecomplete', (key, type, data) => {
            console.log(`Loaded asset: ${key}`);
        });
        
        this.load.on('loaderror', (file) => {
            console.log(`Failed to load: ${file.key}, using placeholder`);
        });
        
        // Attempt to load actual assets
        this.load.image('grass', 'assets/grass.png');
        this.load.image('stone', 'assets/stone.png');
        this.load.image('player', 'assets/player.png');
        this.load.image('tree', 'assets/tree.png');
        this.load.image('rock', 'assets/rock.png');
    }

    create() {
        // Set world bounds
        this.physics.world.setBounds(0, 0, this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);
        
        // Create cursor keys for movement
        cursors = this.input.keyboard.createCursorKeys();
        
        // Add WASD keys
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Add E key for interaction
        this.eKey = this.input.keyboard.addKey('E');
        
        // Add G key for pivot adjustment
        this.gKey = this.input.keyboard.addKey('G');
        
        // Add TAB key for equipment panel
        this.tabKey = this.input.keyboard.addKey('TAB');
        
        // Add number keys for hotbar
        this.numberKeys = [];
        for (let i = 1; i <= 9; i++) {
            this.numberKeys[i] = this.input.keyboard.addKey(`DIGIT${i}`);
        }
        
        // Add mouse click for weapon swinging (only when chat not focused)
        this.input.on('pointerdown', () => {
            if (!isChatFocused) {
                this.swingWeapon();
            }
        });
        
        // Create the hub map
        this.createHubMap();
        
        // Create center plaza
        this.createCenterPlaza();
        
        // Create paths
        this.createPaths();
        
        // Add obstacles (trees and rocks)
        this.addObstacles();
        
        // Create interactable zones
        this.createInteractionZones();
        
        // Create player
        this.createPlayer();
        
        // Setup camera to follow player
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(1.0);
        
        // Create UI
        this.createUI();
        
        // Socket event listeners
        this.setupSocketListeners();
    }

    createPlaceholderAssets() {
        // Create grass tile
        const grassGraphics = this.add.graphics();
        grassGraphics.fillStyle(0x4a7c59, 1);
        grassGraphics.fillRect(0, 0, this.tileSize, this.tileSize);
        grassGraphics.lineStyle(1, 0x3d6b4a, 0.3);
        grassGraphics.strokeRect(0, 0, this.tileSize, this.tileSize);
        grassGraphics.generateTexture('grass_placeholder', this.tileSize, this.tileSize);
        grassGraphics.destroy();

        // Create stone tile
        const stoneGraphics = this.add.graphics();
        stoneGraphics.fillStyle(0x8b8680, 1);
        stoneGraphics.fillRect(0, 0, this.tileSize, this.tileSize);
        stoneGraphics.lineStyle(1, 0x6d665e, 0.5);
        stoneGraphics.strokeRect(0, 0, this.tileSize, this.tileSize);
        stoneGraphics.generateTexture('stone_placeholder', this.tileSize, this.tileSize);
        stoneGraphics.destroy();

        // Create player sprite
        const playerGraphics = this.add.graphics();
        playerGraphics.fillStyle(0x00ff00, 1);
        playerGraphics.fillCircle(16, 16, 14);
        playerGraphics.lineStyle(2, 0xffffff, 1);
        playerGraphics.strokeCircle(16, 16, 14);
        playerGraphics.generateTexture('player_placeholder', 32, 32);
        playerGraphics.destroy();

        // Create tree sprite
        const treeGraphics = this.add.graphics();
        treeGraphics.fillStyle(0x8b4513, 1); // Brown trunk
        treeGraphics.fillRect(18, 40, 8, 20);
        treeGraphics.fillStyle(0x228b22, 1); // Green foliage
        treeGraphics.fillCircle(22, 30, 18);
        treeGraphics.generateTexture('tree_placeholder', 44, 60);
        treeGraphics.destroy();

        // Create rock sprite
        const rockGraphics = this.add.graphics();
        rockGraphics.fillStyle(0x696969, 1);
        rockGraphics.fillEllipse(16, 20, 30, 20);
        rockGraphics.lineStyle(1, 0x2f4f4f, 0.8);
        rockGraphics.strokeEllipse(16, 20, 30, 20);
        rockGraphics.generateTexture('rock_placeholder', 32, 32);
        rockGraphics.destroy();
    }

    createHubMap() {
        // Create base grass layer
        for (let y = 0; y < this.mapHeight; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.mapWidth; x++) {
                const tileX = x * this.tileSize;
                const tileY = y * this.tileSize;
                
                // Use grass asset if available, otherwise use placeholder
                const grassKey = this.textures.exists('grass') ? 'grass' : 'grass_placeholder';
                const tile = this.add.image(tileX + this.tileSize/2, tileY + this.tileSize/2, grassKey);
                tile.setDisplaySize(this.tileSize, this.tileSize);
                tile.setDepth(-100); // Lowest depth for ground tiles
                
                this.tiles[y][x] = {
                    sprite: tile,
                    x: x,
                    y: y,
                    worldX: tileX,
                    worldY: tileY,
                    type: 'grass'
                };
            }
        }
    }

    createCenterPlaza() {
        // 8x8 stone plaza in center
        const centerX = Math.floor(this.mapWidth / 2) - 4;
        const centerY = Math.floor(this.mapHeight / 2) - 4;
        
        for (let y = centerY; y < centerY + 8; y++) {
            for (let x = centerX; x < centerX + 8; x++) {
                if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
                    // Replace grass with stone
                    this.tiles[y][x].sprite.destroy();
                    
                    const stoneKey = this.textures.exists('stone') ? 'stone' : 'stone_placeholder';
                    const stoneTile = this.add.image(
                        x * this.tileSize + this.tileSize/2, 
                        y * this.tileSize + this.tileSize/2, 
                        stoneKey
                    );
                    stoneTile.setDisplaySize(this.tileSize, this.tileSize);
                    stoneTile.setDepth(-99); // Slightly higher than grass
                    
                    this.tiles[y][x].sprite = stoneTile;
                    this.tiles[y][x].type = 'stone';
                }
            }
        }
    }

    createPaths() {
        const centerX = Math.floor(this.mapWidth / 2);
        const centerY = Math.floor(this.mapHeight / 2);
        
        // Horizontal path (left to right through center)
        for (let x = 0; x < this.mapWidth; x++) {
            if (this.tiles[centerY] && this.tiles[centerY][x] && this.tiles[centerY][x].type === 'grass') {
                this.tiles[centerY][x].sprite.destroy();
                
                const stoneKey = this.textures.exists('stone') ? 'stone' : 'stone_placeholder';
                const pathTile = this.add.image(
                    x * this.tileSize + this.tileSize/2, 
                    centerY * this.tileSize + this.tileSize/2, 
                    stoneKey
                );
                pathTile.setDisplaySize(this.tileSize, this.tileSize);
                pathTile.setDepth(-99);
                
                this.tiles[centerY][x].sprite = pathTile;
                this.tiles[centerY][x].type = 'stone';
            }
        }
        
        // Vertical path (top to bottom through center)
        for (let y = 0; y < this.mapHeight; y++) {
            if (this.tiles[y] && this.tiles[y][centerX] && this.tiles[y][centerX].type === 'grass') {
                this.tiles[y][centerX].sprite.destroy();
                
                const stoneKey = this.textures.exists('stone') ? 'stone' : 'stone_placeholder';
                const pathTile = this.add.image(
                    centerX * this.tileSize + this.tileSize/2, 
                    y * this.tileSize + this.tileSize/2, 
                    stoneKey
                );
                pathTile.setDisplaySize(this.tileSize, this.tileSize);
                pathTile.setDepth(-99);
                
                this.tiles[y][centerX].sprite = pathTile;
                this.tiles[y][centerX].type = 'stone';
            }
        }
    }

    addObstacles() {
        const numTrees = 30;
        const numRocks = 20;
        
        // Add trees
        for (let i = 0; i < numTrees; i++) {
            this.addRandomObstacle('tree');
        }
        
        // Add rocks
        for (let i = 0; i < numRocks; i++) {
            this.addRandomObstacle('rock');
        }
    }

    addRandomObstacle(type) {
        let attempts = 0;
        const maxAttempts = 50;
        
        while (attempts < maxAttempts) {
            const x = Phaser.Math.Between(1, this.mapWidth - 2);
            const y = Phaser.Math.Between(1, this.mapHeight - 2);
            
            // Don't place on stone tiles or too close to center
            const centerX = Math.floor(this.mapWidth / 2);
            const centerY = Math.floor(this.mapHeight / 2);
            const distFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);
            
            if (this.tiles[y][x].type === 'grass' && distFromCenter > 6) {
                const worldX = x * this.tileSize + this.tileSize/2;
                const worldY = y * this.tileSize + this.tileSize/2;
                
                // Check if position is clear
                let canPlace = true;
                for (let obstacle of this.obstacles) {
                    const dist = Phaser.Math.Distance.Between(worldX, worldY, obstacle.x, obstacle.y);
                    if (dist < 80) {
                        canPlace = false;
                        break;
                    }
                }
                
                if (canPlace) {
                    const assetKey = this.textures.exists(type) ? type : `${type}_placeholder`;
                    const obstacle = this.physics.add.staticSprite(worldX, worldY, assetKey);
                    
                    if (type === 'tree') {
                        obstacle.setSize(32, 40);
                        obstacle.setOffset(6, 20);
                        obstacle.setDepth(worldY + 30);
                    } else if (type === 'rock') {
                        obstacle.setSize(24, 20);
                        obstacle.setOffset(4, 6);
                        obstacle.setDepth(worldY + 10);
                    }
                    
                    this.obstacles.push(obstacle);
                    break;
                }
            }
            attempts++;
        }
    }

    createInteractionZones() {
        // Fishing Zone (bottom area)
        const fishingZone = this.add.rectangle(
            this.mapWidth * this.tileSize / 2,
            this.mapHeight * this.tileSize - 3 * this.tileSize,
            4 * this.tileSize,
            2 * this.tileSize,
            0x0066cc,
            0.3
        );
        fishingZone.setStrokeStyle(3, 0x0099ff);
        fishingZone.setDepth(-50);
        
        this.interactionZones.push({
            zone: fishingZone,
            type: 'fishing',
            x: fishingZone.x,
            y: fishingZone.y,
            width: fishingZone.width,
            height: fishingZone.height
        });

        // Portal Zone (right side)
        const portalZone = this.add.rectangle(
            this.mapWidth * this.tileSize - 3 * this.tileSize,
            this.mapHeight * this.tileSize / 2,
            2 * this.tileSize,
            4 * this.tileSize,
            0xcc00cc,
            0.3
        );
        portalZone.setStrokeStyle(3, 0xff00ff);
        portalZone.setDepth(-50);
        
        // Add glowing effect to portal
        this.tweens.add({
            targets: portalZone,
            alpha: { from: 0.2, to: 0.6 },
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        this.interactionZones.push({
            zone: portalZone, 
            type: 'portal',
            x: portalZone.x,
            y: portalZone.y,
            width: portalZone.width,
            height: portalZone.height
        });
    }

    createPlayer() {
        // Create player at center of plaza
        const centerX = this.mapWidth * this.tileSize / 2;
        const centerY = this.mapHeight * this.tileSize / 2;
        
        // Create physics sprite (invisible, used for collision)
        this.player = this.physics.add.sprite(centerX, centerY, null);
        this.player.setVisible(false);
        
        // Set physics properties
        this.player.setCollideWorldBounds(true);
        this.player.setDrag(300);
        this.player.setMaxVelocity(200);
        this.player.setSize(24, 24);
        
        // Add collision with obstacles
        this.physics.add.collider(this.player, this.obstacles);
        
        // Create visual avatar container
        this.createPlayerAvatar(centerX, centerY);
        
        // Create weapon sprite (stick for now)
        this.createWeapon();
        
        console.log('Player created at hub center');
    }

    createPlayerAvatar(x, y) {
        // Create main container for the player
        this.playerContainer = this.add.container(x, y);
        
        // Create shadow
        const shadow = this.add.ellipse(0, 12, 24, 12, 0x000000, 0.3);
        this.playerContainer.add(shadow);
        
        // Create avatar parts
        this.playerAvatar = {
            shadow: shadow,
            legs: [],
            body: null,
            head: null,
            hair: null,
            nameLabel: null,
            healthBarBg: null,
            healthBar: null
        };
        
        // Create legs (two small rectangles)
        const leftLeg = this.add.rectangle(-4, 8, 6, 12, 0x1a4c96);
        const rightLeg = this.add.rectangle(4, 8, 6, 12, 0x1a4c96);
        this.playerAvatar.legs = [leftLeg, rightLeg];
        this.playerContainer.add([leftLeg, rightLeg]);
        
        // Create body (blue shirt)
        const body = this.add.rectangle(0, -2, 16, 18, 0x4682b4);
        this.playerAvatar.body = body;
        this.playerContainer.add(body);
        
        // Create head (skin tone)
        const head = this.add.circle(0, -14, 8, 0xfdbcb4);
        this.playerAvatar.head = head;
        this.playerContainer.add(head);
        
        // Create hair (brown arc on top)
        const hair = this.add.arc(0, -18, 10, 10, 180, 360, false, 0x8b4513);
        hair.setStrokeStyle(2, 0x8b4513);
        this.playerAvatar.hair = hair;
        this.playerContainer.add(hair);
        
        // Create name label
        const nameLabel = this.add.text(0, -35, currentPlayer?.name || 'Player', {
            fontSize: '12px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.playerAvatar.nameLabel = nameLabel;
        this.playerContainer.add(nameLabel);
        
        // Create health bar background
        const healthBarBg = this.add.rectangle(0, -28, 30, 4, 0x8b0000);
        this.playerAvatar.healthBarBg = healthBarBg;
        this.playerContainer.add(healthBarBg);
        
        // Create health bar
        const healthBar = this.add.rectangle(0, -28, 30, 4, 0x228b22);
        this.playerAvatar.healthBar = healthBar;
        this.playerContainer.add(healthBar);
        
        // Set initial depth
        this.playerContainer.setDepth(y + 1000);
    }

    // Soul Knight-style weapon system
    createWeapon() {
        // Create stick weapon sprite (brown rectangle)
        this.weaponSprite = this.add.rectangle(0, 0, 4, 30, 0x8b4513);
        this.weaponSprite.setOrigin(0.5, 0.8); // Set origin near the grip end (bottom)
        this.weaponSprite.setDepth(this.player.y + 999); // Just behind player
        
        // Initial weapon positioning
        this.updateWeaponPosition();
    }

    updateWeaponPosition() {
        if (!this.weaponSprite) return;
        
        // Calculate hand pivot position (Soul Knight style)
        const pivotX = this.activeSide === "right" ? 
            this.player.x + 15 : this.player.x - 15;
        const pivotY = this.player.y + this.pivotY;
        
        // Get mouse position in world coordinates
        const worldPoint = this.cameras.main.getWorldPoint(
            this.input.activePointer.x, 
            this.input.activePointer.y
        );
        
        // Calculate angle from pivot (hand) to mouse
        const angle = Phaser.Math.Angle.Between(
            pivotX, 
            pivotY, 
            worldPoint.x, 
            worldPoint.y
        );
        
        // Position weapon so grip end (origin point) aligns with pivot
        this.weaponSprite.setPosition(pivotX, pivotY);
        this.weaponSprite.setRotation(angle);
        
        // Update weapon depth to stay just behind player
        this.weaponSprite.setDepth(this.player.y + 999);
    }

    swingWeapon() {
        if (!this.weaponSprite || this.itemSwingTween) return;
        
        const originalRotation = this.weaponSprite.rotation;
        const swingAmount = this.activeSide === "right" ? Math.PI/3 : -Math.PI/3; // 60 degrees swing
        
        this.itemSwingTween = this.tweens.add({
            targets: this.weaponSprite,
            rotation: originalRotation + swingAmount,
            duration: 150,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                this.itemSwingTween = null;
            }
        });
    }

    updatePlayerHealth(health) {
        this.playerHealth = Math.max(0, Math.min(this.maxHealth, health));
        const healthPercent = this.playerHealth / this.maxHealth;
        this.playerAvatar.healthBar.setSize(30 * healthPercent, 4);
        
        // Update health bar color based on health
        if (healthPercent > 0.6) {
            this.playerAvatar.healthBar.setFillStyle(0x228b22); // Green
        } else if (healthPercent > 0.3) {
            this.playerAvatar.healthBar.setFillStyle(0xffa500); // Orange
        } else {
            this.playerAvatar.healthBar.setFillStyle(0xff4500); // Red
        }
    }

    startWalkAnimation() {
        if (!this.isMoving) {
            this.isMoving = true;
            
            // Create bobbing animation
            this.walkBobTween = this.tweens.add({
                targets: this.playerContainer,
                y: this.playerContainer.y - 2,
                duration: 200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Animate legs for walking effect
            this.tweens.add({
                targets: this.playerAvatar.legs[0],
                y: this.playerAvatar.legs[0].y + 1,
                duration: 300,
                yoyo: true,
                repeat: -1
            });
            
            this.tweens.add({
                targets: this.playerAvatar.legs[1],
                y: this.playerAvatar.legs[1].y - 1,
                duration: 300,
                yoyo: true,
                repeat: -1,
                delay: 150
            });
        }
    }

    stopWalkAnimation() {
        if (this.isMoving) {
            this.isMoving = false;
            
            // Stop bobbing
            if (this.walkBobTween) {
                this.walkBobTween.stop();
                this.walkBobTween = null;
            }
            
            // Stop all tweens on player container and legs
            this.tweens.killTweensOf(this.playerContainer);
            this.tweens.killTweensOf(this.playerAvatar.legs);
            
            // Reset leg positions
            this.playerAvatar.legs[0].y = 8;
            this.playerAvatar.legs[1].y = 8;
        }
    }

    createUI() {
        // Coins display
        this.coinsText = this.add.text(20, 80, `Coins: ${this.playerCoins}`, {
            fontSize: '20px',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.coinsText.setScrollFactor(0);
        this.coinsText.setDepth(2000);

        // Health display
        const healthText = this.add.text(20, 110, `Health: ${this.playerHealth}/${this.maxHealth}`, {
            fontSize: '16px',
            fill: '#00ff00',
            stroke: '#000000',
            strokeThickness: 2
        });
        healthText.setScrollFactor(0);
        healthText.setDepth(2000);

        // Defense display
        this.defenseText = this.add.text(20, 135, `Defense: ${this.playerDefense}`, {
            fontSize: '16px',
            fill: '#0099ff',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.defenseText.setScrollFactor(0);
        this.defenseText.setDepth(2000);

        // Soul Knight weapon control info
        const controlsText = this.add.text(20, 165, 'Controls:\nWASD/Arrows: Move\nA/D: Switch Hand Side\nG + Mouse: Adjust Hand Height\nE: Interact\nTAB: Equipment\n1-9: Hotbar Slots\nMouse: Aim & Click to Swing', {
            fontSize: '12px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 1,
            lineSpacing: 2
        });
        controlsText.setScrollFactor(0);
        controlsText.setDepth(2000);

        // Combat side indicator
        this.combatSideText = this.add.text(20, 285, `Hand Side: ${this.activeSide.toUpperCase()}`, {
            fontSize: '14px',
            fill: '#ffaa00',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.combatSideText.setScrollFactor(0);
        this.combatSideText.setDepth(2000);

        // Pivot Y indicator
        this.pivotYText = this.add.text(20, 305, `Hand Height: ${this.pivotY}`, {
            fontSize: '14px',
            fill: '#00aaff',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.pivotYText.setScrollFactor(0);
        this.pivotYText.setDepth(2000);

        // Create hotbar
        this.createHotbar();

        // Create equipment panel (initially hidden)
        this.createEquipmentPanel();

        // Interaction prompt (initially hidden)
        this.interactionText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height - 150,
            'Press E to interact',
            {
                fontSize: '18px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 }
            }
        );
        this.interactionText.setOrigin(0.5);
        this.interactionText.setScrollFactor(0);
        this.interactionText.setDepth(2000);
        this.interactionText.setVisible(false);

        // Add some starting items for testing
        this.addItemToHotbar('stick', 0);
        this.addItemToHotbar('sword', 1);
        this.addItemToHotbar('fishing_rod', 2);
        this.addItemToHotbar('iron_helmet', 3);
        this.addItemToHotbar('iron_chestplate', 4);
        this.addItemToHotbar('iron_leggings', 5);
        this.addItemToHotbar('iron_boots', 6);
        
        // Initialize with first item equipped
        this.switchActiveSlot(0);
    }

    createHotbar() {
        const centerX = this.cameras.main.width / 2;
        const hotbarY = this.cameras.main.height - 60;
        const slotSize = 40;
        const slotSpacing = 45;
        const startX = centerX - (9 * slotSpacing) / 2 + slotSpacing / 2;

        // Create hotbar background
        this.hotbarUI = this.add.container(0, 0);
        this.hotbarUI.setScrollFactor(0);
        this.hotbarUI.setDepth(1900);

        // Create hotbar background panel
        const hotbarBg = this.add.rectangle(centerX, hotbarY, 9 * slotSpacing + 10, slotSize + 10, 0x2c2c2c, 0.8);
        hotbarBg.setStrokeStyle(2, 0x666666);
        this.hotbarUI.add(hotbarBg);

        // Create individual slots
        this.hotbarSlots = [];
        for (let i = 0; i < 9; i++) {
            const slotX = startX + i * slotSpacing;
            const slot = this.createHotbarSlot(slotX, hotbarY, i);
            this.hotbarSlots.push(slot);
            this.hotbarUI.add(slot.container);
        }

        // Update active slot highlight
        this.updateHotbarHighlight();
    }

    createHotbarSlot(x, y, index) {
        const container = this.add.container(x, y);
        
        // Slot background
        const bg = this.add.rectangle(0, 0, 38, 38, 0x444444);
        bg.setStrokeStyle(1, 0x666666);
        container.add(bg);

        // Slot number
        const numberText = this.add.text(15, -15, (index + 1).toString(), {
            fontSize: '10px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 1
        });
        container.add(numberText);

        // Item icon (initially empty)
        const itemIcon = this.add.rectangle(0, 0, 30, 30, 0x666666);
        itemIcon.setVisible(false);
        container.add(itemIcon);

        return {
            container: container,
            background: bg,
            itemIcon: itemIcon,
            index: index
        };
    }

    updateHotbarHighlight() {
        // Remove highlight from all slots
        this.hotbarSlots.forEach(slot => {
            slot.background.setStrokeStyle(1, 0x666666);
        });

        // Highlight active slot
        if (this.hotbarSlots[this.activeSlot]) {
            this.hotbarSlots[this.activeSlot].background.setStrokeStyle(2, 0xffff00);
        }
    }

    addItemToHotbar(itemType, slotIndex) {
        if (slotIndex >= 0 && slotIndex < 9) {
            this.hotbar[slotIndex] = itemType;
            this.updateHotbarSlot(slotIndex);
        }
    }

    updateHotbarSlot(slotIndex) {
        const slot = this.hotbarSlots[slotIndex];
        const itemType = this.hotbar[slotIndex];

        if (itemType && this.itemTypes[itemType]) {
            const item = this.itemTypes[itemType];
            slot.itemIcon.setFillStyle(item.color);
            slot.itemIcon.setVisible(true);
        } else {
            slot.itemIcon.setVisible(false);
        }
    }

    switchActiveSlot(newSlot) {
        if (newSlot >= 0 && newSlot < 9) {
            this.activeSlot = newSlot;
            this.updateHotbarHighlight();
            
            // Update weapon sprite based on active item
            const activeItem = this.hotbar[this.activeSlot];
            this.updateWeaponSprite(activeItem);
        }
    }

    updateWeaponSprite(itemType) {
        if (!this.weaponSprite) return;
        
        if (itemType && this.itemTypes[itemType]) {
            const item = this.itemTypes[itemType];
            if (item.type === 'weapon' || item.type === 'tool') {
                this.weaponSprite.setFillStyle(item.color);
                this.weaponSprite.setVisible(true);
                
                // Adjust weapon size based on type
                if (itemType === 'stick') {
                    this.weaponSprite.setSize(4, 30);
                } else if (itemType === 'sword') {
                    this.weaponSprite.setSize(3, 32);
                } else if (itemType === 'fishing_rod') {
                    this.weaponSprite.setSize(2, 35);
                }
            } else {
                this.weaponSprite.setVisible(false);
            }
        } else {
            this.weaponSprite.setVisible(false);
        }
    }

    createEquipmentPanel() {
        const panelX = 200;
        const panelY = 200;
        const slotSize = 50;

        // Create equipment panel container (initially hidden)
        this.equipmentPanel = this.add.container(0, 0);
        this.equipmentPanel.setScrollFactor(0);
        this.equipmentPanel.setDepth(2100);
        this.equipmentPanel.setVisible(false);

        // Create background overlay
        const overlay = this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2, 
                                          this.cameras.main.width, this.cameras.main.height, 0x000000, 0.5);
        this.equipmentPanel.add(overlay);

        // Create panel background
        const panelBg = this.add.rectangle(panelX, panelY, 200, 250, 0x333333, 0.9);
        panelBg.setStrokeStyle(3, 0x666666);
        this.equipmentPanel.add(panelBg);

        // Panel title
        const title = this.add.text(panelX, panelY - 100, 'Equipment', {
            fontSize: '20px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.equipmentPanel.add(title);

        // Create equipment slots
        const slotPositions = {
            helmet: { x: panelX, y: panelY - 50, label: 'Helmet' },
            chestplate: { x: panelX, y: panelY, label: 'Chestplate' },
            leggings: { x: panelX, y: panelY + 50, label: 'Leggings' },
            boots: { x: panelX, y: panelY + 100, label: 'Boots' }
        };

        this.equipmentSlots = {};
        Object.entries(slotPositions).forEach(([slotType, pos]) => {
            const slot = this.createEquipmentSlot(pos.x, pos.y, slotType, pos.label);
            this.equipmentSlots[slotType] = slot;
            this.equipmentPanel.add(slot.container);
        });

        // Close button
        const closeButton = this.add.rectangle(panelX + 80, panelY - 100, 30, 20, 0x666666);
        closeButton.setStrokeStyle(1, 0xffffff);
        closeButton.setInteractive();
        closeButton.on('pointerdown', () => this.toggleEquipmentPanel());
        this.equipmentPanel.add(closeButton);

        const closeText = this.add.text(panelX + 80, panelY - 100, 'X', {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        this.equipmentPanel.add(closeText);
    }

    createEquipmentSlot(x, y, slotType, label) {
        const container = this.add.container(x, y);

        // Slot background
        const bg = this.add.rectangle(0, 0, 48, 48, 0x555555);
        bg.setStrokeStyle(2, 0x777777);
        container.add(bg);

        // Slot label
        const labelText = this.add.text(-60, 0, label, {
            fontSize: '12px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0, 0.5);
        container.add(labelText);

        // Item icon (initially empty)
        const itemIcon = this.add.rectangle(0, 0, 40, 40, 0x666666);
        itemIcon.setVisible(false);
        container.add(itemIcon);

        // Make slot interactive for equipment
        bg.setInteractive();
        bg.on('pointerdown', () => this.tryEquipFromHotbar(slotType));

        return {
            container: container,
            background: bg,
            itemIcon: itemIcon,
            slotType: slotType
        };
    }

    toggleEquipmentPanel() {
        this.isEquipmentOpen = !this.isEquipmentOpen;
        this.equipmentPanel.setVisible(this.isEquipmentOpen);
    }

    tryEquipFromHotbar(slotType) {
        const activeItem = this.hotbar[this.activeSlot];
        if (activeItem && this.itemTypes[activeItem]) {
            const itemData = this.itemTypes[activeItem];
            if (itemData.type === slotType) {
                // Move item from hotbar to equipment
                const oldEquipment = this.equipment[slotType];
                this.equipment[slotType] = activeItem;
                this.hotbar[this.activeSlot] = oldEquipment;

                this.updateEquipmentSlot(slotType);
                this.updateHotbarSlot(this.activeSlot);
                this.updatePlayerStats();
            }
        }
    }

    updateEquipmentSlot(slotType) {
        const slot = this.equipmentSlots[slotType];
        const itemType = this.equipment[slotType];

        if (itemType && this.itemTypes[itemType]) {
            const item = this.itemTypes[itemType];
            slot.itemIcon.setFillStyle(item.color);
            slot.itemIcon.setVisible(true);
        } else {
            slot.itemIcon.setVisible(false);
        }
    }

    updatePlayerStats() {
        // Calculate total defense from equipment
        this.playerDefense = 0;
        Object.values(this.equipment).forEach(itemType => {
            if (itemType && this.itemTypes[itemType] && this.itemTypes[itemType].defense) {
                this.playerDefense += this.itemTypes[itemType].defense;
            }
        });

        // Update defense display
        this.defenseText.setText(`Defense: ${this.playerDefense}`);
    }

    setupSocketListeners() {
        socket.on('currentPlayer', (player) => {
            currentPlayer = player;
            console.log('Current player:', currentPlayer);
        });
        
        socket.on('playersUpdate', (updatedPlayers) => {
            players = updatedPlayers;
            this.updatePlayerSprites();
        });
        
        socket.on('chat message', (data) => {
            addChatMessage(data);
        });
    }

    createOtherPlayerAvatar(player) {
        // Create container for other player
        const container = this.add.container(player.x, player.y);
        
        // Get unique color for this player
        const playerColor = this.getPlayerColor(player.id);
        
        // Create shadow
        const shadow = this.add.ellipse(0, 12, 24, 12, 0x000000, 0.3);
        container.add(shadow);
        
        // Create legs
        const leftLeg = this.add.rectangle(-4, 8, 6, 12, 0x1a4c96);
        const rightLeg = this.add.rectangle(4, 8, 6, 12, 0x1a4c96);
        container.add([leftLeg, rightLeg]);
        
        // Create body (use player color for shirt)
        const body = this.add.rectangle(0, -2, 16, 18, playerColor);
        container.add(body);
        
        // Create head (skin tone)
        const head = this.add.circle(0, -14, 8, 0xfdbcb4);
        container.add(head);
        
        // Create hair (brown arc on top)
        const hair = this.add.arc(0, -18, 10, 10, 180, 360, false, 0x8b4513);
        hair.setStrokeStyle(2, 0x8b4513);
        container.add(hair);
        
        // Create name label
        const nameLabel = this.add.text(0, -35, player.name, {
            fontSize: '12px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        container.add(nameLabel);
        
        // Create health bar background
        const healthBarBg = this.add.rectangle(0, -28, 30, 4, 0x8b0000);
        container.add(healthBarBg);
        
        // Create health bar
        const healthBar = this.add.rectangle(0, -28, 30, 4, 0x228b22);
        container.add(healthBar);
        
        container.setDepth(player.y + 500);
        
        return container;
    }

    updatePlayerSprites() {
        // Remove sprites for disconnected players
        Object.keys(playerSprites).forEach(playerId => {
            if (!players[playerId]) {
                playerSprites[playerId].destroy();
                delete playerSprites[playerId];
                delete playerLabels[playerId];
            }
        });
        
        // Update or create sprites for all players
        Object.values(players).forEach(player => {
            if (!playerSprites[player.id] && player.id !== currentPlayer?.id) {
                const container = this.createOtherPlayerAvatar(player);
                playerSprites[player.id] = container;
                playerLabels[player.id] = container.list.find(child => child.type === 'Text');
            } else if (playerSprites[player.id]) {
                playerSprites[player.id].setPosition(player.x, player.y);
                playerSprites[player.id].setDepth(player.y + 500);
            }
        });
    }

    getPlayerColor(playerId) {
        const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0xf0932b, 0xeb4d4b, 0x6c5ce7, 0xa29bfe];
        const hash = playerId.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        return colors[Math.abs(hash) % colors.length];
    }

    checkInteractionZones() {
        let nearZone = null;
        
        for (let zone of this.interactionZones) {
            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                zone.x, zone.y
            );
            
            if (distance < Math.max(zone.width, zone.height) / 2 + 50) {
                nearZone = zone;
                break;
            }
        }
        
        if (nearZone !== this.nearbyZone) {
            this.nearbyZone = nearZone;
            
            if (this.nearbyZone) {
                this.interactionText.setText(`Press E to ${this.nearbyZone.type === 'fishing' ? 'go fishing' : 'enter portal'}`);
                this.interactionText.setVisible(true);
            } else {
                this.interactionText.setVisible(false);
            }
        }
    }

    handleInteraction() {
        if (this.nearbyZone) {
            if (this.nearbyZone.type === 'fishing') {
                console.log('Starting fishing activity...');
                // Add fishing rod to hotbar if not already there
                const fishingRodSlot = this.hotbar.indexOf('fishing_rod');
                if (fishingRodSlot === -1) {
                    this.addItemToHotbar('fishing_rod', this.activeSlot);
                } else {
                    this.switchActiveSlot(fishingRodSlot);
                }
                this.swingWeapon(); // Cast the line
                addChatMessage({
                    player: 'System',
                    message: 'You cast your fishing line into the water...',
                    timestamp: new Date().toLocaleTimeString()
                });
                // Simulate fishing result after a delay
                setTimeout(() => {
                    const fishTypes = ['🐟 Small Fish', '🐠 Tropical Fish', '🦈 Shark', '🐙 Octopus', '👢 Old Boot'];
                    const randomFish = fishTypes[Math.floor(Math.random() * fishTypes.length)];
                    if (randomFish === '👢 Old Boot') {
                        addChatMessage({
                            player: 'System',
                            message: 'You caught an old boot! Better luck next time.',
                            timestamp: new Date().toLocaleTimeString()
                        });
                    } else {
                        this.playerCoins += 5;
                        this.coinsText.setText(`Coins: ${this.playerCoins}`);
                        addChatMessage({
                            player: 'System',
                            message: `You caught a ${randomFish}! +5 coins`,
                            timestamp: new Date().toLocaleTimeString()
                        });
                    }
                }, 2000);
            } else if (this.nearbyZone.type === 'portal') {
                console.log('Entering portal...');
                // Add sword to hotbar if not already there
                const swordSlot = this.hotbar.indexOf('sword');
                if (swordSlot === -1) {
                    this.addItemToHotbar('sword', this.activeSlot);
                } else {
                    this.switchActiveSlot(swordSlot);
                }
                this.swingWeapon(); // Draw the sword
                addChatMessage({
                    player: 'System',
                    message: 'You draw your sword and prepare for adventure! The portal shimmers...',
                    timestamp: new Date().toLocaleTimeString()
                });
                // TODO: Implement portal travel
            }
        }
    }

    update() {
        if (!this.player || !this.player.body || !this.playerContainer) return;
        
        const speed = 180;
        const wasMoving = this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0;
        
        this.player.setVelocity(0);
        
        // Movement input - only process if chat is not focused
        let moveX = 0, moveY = 0;
        if (!isChatFocused) {
            if (cursors.left.isDown || this.wasd.A.isDown) {
                this.player.setVelocityX(-speed);
                moveX = -1;
                this.activeSide = "left"; // Switch to left hand when A pressed
            }
            if (cursors.right.isDown || this.wasd.D.isDown) {
                this.player.setVelocityX(speed);
                moveX = 1;
                this.activeSide = "right"; // Switch to right hand when D pressed
            }
            if (cursors.up.isDown || this.wasd.W.isDown) {
                this.player.setVelocityY(-speed);
                moveY = -1;
            }
            if (cursors.down.isDown || this.wasd.S.isDown) {
                this.player.setVelocityY(speed);
                moveY = 1;
            }
        }
        
        // Normalize diagonal movement
        if (this.player.body.velocity.x !== 0 && this.player.body.velocity.y !== 0) {
            this.player.setVelocity(this.player.body.velocity.x * 0.707, this.player.body.velocity.y * 0.707);
        }
        
        // Update facing direction based on movement
        if (moveX !== 0) {
            this.facingDirection = moveX;
            this.lastMoveDirection.x = moveX;
        }
        if (moveY !== 0) {
            this.lastMoveDirection.y = moveY;
        }
        
        // Handle G key for vertical pivot adjustment (Soul Knight style)
        if (!isChatFocused && this.gKey && this.gKey.isDown) {
            if (!this.isAdjustingPivot) {
                this.isAdjustingPivot = true;
                this.lastMouseY = this.input.activePointer.y;
            }
            
            // Track mouse Y movement delta
            const currentMouseY = this.input.activePointer.y;
            const deltaY = currentMouseY - this.lastMouseY;
            
            // Add delta to pivotY and clamp between -40 and +40
            this.pivotY += deltaY * 0.5; // Scale delta for smoother control
            this.pivotY = Phaser.Math.Clamp(this.pivotY, -40, 40);
            
            this.lastMouseY = currentMouseY;
            
            // Update pivot Y display
            this.pivotYText.setText(`Hand Height: ${Math.round(this.pivotY)}`);
        } else {
            this.isAdjustingPivot = false;
        }
        
        // Update combat side display
        this.combatSideText.setText(`Hand Side: ${this.activeSide.toUpperCase()}`);
        
        const isMoving = this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0;
        
        // Update avatar position to match physics body
        this.playerContainer.setPosition(this.player.x, this.player.y);
        
        // Update depth based on Y position for proper sorting
        this.playerContainer.setDepth(this.player.y + 1000);
        
        // Update weapon position (Soul Knight style)
        this.updateWeaponPosition();
        
        // Handle walking animation
        if (isMoving && !wasMoving) {
            this.startWalkAnimation();
        } else if (!isMoving && wasMoving) {
            this.stopWalkAnimation();
        }
        
        // Check for nearby interaction zones
        this.checkInteractionZones();
        
        // Handle game inputs only if chat is not focused
        if (!isChatFocused) {
            // Handle E key interaction
            if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
                this.handleInteraction();
            }
            
            // Handle TAB key for equipment panel
            if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
                this.toggleEquipmentPanel();
            }
            
            // Handle number keys for hotbar switching
            for (let i = 1; i <= 9; i++) {
                if (Phaser.Input.Keyboard.JustDown(this.numberKeys[i])) {
                    this.switchActiveSlot(i - 1);
                    break;
                }
            }
        }
        
        // Update networking
        if (currentPlayer && (this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0)) {
            currentPlayer.x = this.player.x;
            currentPlayer.y = this.player.y;
            socket.emit('move', { x: this.player.x, y: this.player.y });
        }
    }
}

// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    parent: 'game-area',
    scene: HubScene,
    backgroundColor: '#2d5a3d',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    }
};

// Initialize the game
const game = new Phaser.Game(config);

// Chat functionality
function addChatMessage(data) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    messageDiv.innerHTML = `
        <div class="timestamp">${data.timestamp}</div>
        <span class="player-name">${data.player}:</span> ${escapeHtml(data.message)}
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Chat input handling
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const gameArea = document.getElementById('game-area');
    
    // Game area click handler - unfocus chat, focus game
    gameArea.addEventListener('click', () => {
        isChatFocused = false;
        chatInput.blur(); // Remove focus from chat input
        // Re-enable Phaser keyboard input when clicking game area
        if (game && game.scene && game.scene.scenes[0]) {
            game.scene.scenes[0].input.keyboard.enabled = true;
        }
    });
    
    // Chat input click handler - focus chat
    chatInput.addEventListener('click', () => {
        isChatFocused = true;
        // Disable Phaser keyboard input when clicking chat
        if (game && game.scene && game.scene.scenes[0]) {
            game.scene.scenes[0].input.keyboard.enabled = false;
        }
    });
    
    // Chat input focus/blur handlers
    chatInput.addEventListener('focus', () => {
        isChatFocused = true;
        // Disable Phaser keyboard input when chat is focused
        if (game && game.scene && game.scene.scenes[0]) {
            game.scene.scenes[0].input.keyboard.enabled = false;
        }
    });
    
    chatInput.addEventListener('blur', () => {
        isChatFocused = false;
        // Re-enable Phaser keyboard input when chat loses focus
        if (game && game.scene && game.scene.scenes[0]) {
            game.scene.scenes[0].input.keyboard.enabled = true;
        }
    });
    
    // Prevent event bubbling for chat input keydown events
    chatInput.addEventListener('keydown', (e) => {
        e.stopPropagation(); // Prevent Phaser from capturing these keys
    });
    
    // Also handle keyup to prevent Phaser interference
    chatInput.addEventListener('keyup', (e) => {
        e.stopPropagation(); // Prevent Phaser from capturing these keys
    });
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim()) {
            socket.emit('chat message', chatInput.value.trim());
            chatInput.value = '';
        }
    });
    
    // Remove auto-focus behavior - chat only activates by clicking
    // No document keydown handler needed for auto-focus
});

// Connection status feedback
socket.on('connect', () => {
    console.log('Connected to server');
    addChatMessage({
        player: 'System',
        message: 'Connected to Tidal Idle Hub!',
        timestamp: new Date().toLocaleTimeString()
    });
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    addChatMessage({
        player: 'System',
        message: 'Disconnected from server',
        timestamp: new Date().toLocaleTimeString()
    });
});