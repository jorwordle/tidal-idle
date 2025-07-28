const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// In-memory player storage
const players = {};

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Generate random starting position
  const startX = Math.floor(Math.random() * 760) + 20; // Keep within canvas bounds
  const startY = Math.floor(Math.random() * 560) + 20;
  
  // Create new player
  players[socket.id] = {
    id: socket.id,
    x: startX,
    y: startY,
    name: `Player${Math.floor(Math.random() * 1000)}`
  };

  // Send current player their info
  socket.emit('currentPlayer', players[socket.id]);
  
  // Broadcast updated player list to all clients
  io.emit('playersUpdate', players);

  // Handle player movement
  socket.on('move', (data) => {
    if (players[socket.id]) {
      // Update player position with bounds checking
      players[socket.id].x = Math.max(15, Math.min(785, data.x));
      players[socket.id].y = Math.max(15, Math.min(585, data.y));
      
      // Broadcast updated position to all clients
      io.emit('playersUpdate', players);
    }
  });

  // Handle chat messages
  socket.on('chat message', (msg) => {
    if (players[socket.id] && msg.trim().length > 0) {
      const chatData = {
        player: players[socket.id].name,
        message: msg.trim(),
        timestamp: new Date().toLocaleTimeString()
      };
      io.emit('chat message', chatData);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playersUpdate', players);
  });
});

server.listen(PORT, () => {
  console.log(`Tidal Idle server running on port ${PORT}`);
});