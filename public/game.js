// Socket.IO connection
const socket = io();

// Game variables
let currentPlayer = null;
let players = {};
let cursors;
let playerSprites = {};
let playerLabels = {};

// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-area',
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    backgroundColor: '#1e6091'
};

// Initialize the game
const game = new Phaser.Game(config);

function preload() {
    // Create simple colored circles for players
    this.add.graphics()
        .fillStyle(0x00ff00)
        .fillCircle(10, 10, 10)
        .generateTexture('player', 20, 20);
}

function create() {
    // Create cursor keys for movement
    cursors = this.input.keyboard.createCursorKeys();
    
    // Add WASD keys
    this.wasd = this.input.keyboard.addKeys('W,S,A,D');
    
    // Add ocean-like background elements
    createOceanBackground(this);
    
    // Socket event listeners
    setupSocketListeners(this);
}

function createOceanBackground(scene) {
    // Add some decorative ocean elements
    const graphics = scene.add.graphics();
    
    // Create wave-like patterns
    graphics.lineStyle(2, 0x4da6ff, 0.3);
    for (let i = 0; i < 10; i++) {
        const y = 100 + i * 50;
        graphics.beginPath();
        graphics.moveTo(0, y);
        for (let x = 0; x < 800; x += 20) {
            graphics.lineTo(x, y + Math.sin(x * 0.01 + i) * 10);
        }
        graphics.strokePath();
    }
    
    // Add some floating particles
    for (let i = 0; i < 20; i++) {
        scene.add.circle(
            Math.random() * 800,
            Math.random() * 600,
            Math.random() * 3 + 1,
            0x66ccff,
            0.3
        );
    }
}

function setupSocketListeners(scene) {
    // Receive current player data
    socket.on('currentPlayer', (player) => {
        currentPlayer = player;
        console.log('Current player:', currentPlayer);
    });
    
    // Update all players
    socket.on('playersUpdate', (updatedPlayers) => {
        players = updatedPlayers;
        updatePlayerSprites(scene);
    });
    
    // Handle chat messages
    socket.on('chat message', (data) => {
        addChatMessage(data);
    });
}

function updatePlayerSprites(scene) {
    // Remove sprites for disconnected players
    Object.keys(playerSprites).forEach(playerId => {
        if (!players[playerId]) {
            playerSprites[playerId].destroy();
            playerLabels[playerId].destroy();
            delete playerSprites[playerId];
            delete playerLabels[playerId];
        }
    });
    
    // Update or create sprites for all players
    Object.values(players).forEach(player => {
        if (!playerSprites[player.id]) {
            // Create new player sprite
            const color = player.id === currentPlayer?.id ? 0x00ff00 : getPlayerColor(player.id);
            const sprite = scene.add.circle(player.x, player.y, 15, color);
            sprite.setStrokeStyle(2, 0xffffff);
            
            // Create player name label
            const label = scene.add.text(player.x, player.y - 30, player.name, {
                fontSize: '12px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);
            
            playerSprites[player.id] = sprite;
            playerLabels[player.id] = label;
        } else {
            // Update existing sprite position
            playerSprites[player.id].setPosition(player.x, player.y);
            playerLabels[player.id].setPosition(player.x, player.y - 30);
        }
    });
}

function getPlayerColor(playerId) {
    // Generate consistent color based on player ID
    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0xf0932b, 0xeb4d4b, 0x6c5ce7, 0xa29bfe];
    const hash = playerId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
}

function update() {
    if (!currentPlayer) return;
    
    let moved = false;
    let newX = currentPlayer.x;
    let newY = currentPlayer.y;
    
    const speed = 3;
    
    // Handle movement input
    if (cursors.left.isDown || this.wasd.A.isDown) {
        newX -= speed;
        moved = true;
    }
    if (cursors.right.isDown || this.wasd.D.isDown) {
        newX += speed;
        moved = true;
    }
    if (cursors.up.isDown || this.wasd.W.isDown) {
        newY -= speed;
        moved = true;
    }
    if (cursors.down.isDown || this.wasd.S.isDown) {
        newY += speed;
        moved = true;
    }
    
    // Send movement to server if player moved
    if (moved) {
        // Update local position immediately for responsiveness
        currentPlayer.x = newX;
        currentPlayer.y = newY;
        
        // Send to server
        socket.emit('move', { x: newX, y: newY });
    }
}

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
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim()) {
            socket.emit('chat message', chatInput.value.trim());
            chatInput.value = '';
        }
    });
    
    // Focus chat input when typing (but not during game controls)
    document.addEventListener('keydown', (e) => {
        if (e.target === document.body && 
            !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
            chatInput.focus();
        }
    });
});

// Connection status feedback
socket.on('connect', () => {
    console.log('Connected to server');
    addChatMessage({
        player: 'System',
        message: 'Connected to Tidal Idle!',
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