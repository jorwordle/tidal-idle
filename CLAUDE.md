# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tidal Idle is a multiplayer idle game with real-time chat and 2D movement. Built with Node.js/Express backend and Phaser 3 frontend, using Socket.IO for real-time multiplayer communication.

## Development Commands

- **Start server**: `npm start` or `npm run dev` - runs server on port 3000
- **Install dependencies**: `npm install`
- **Health check**: Visit `http://localhost:3000/api/health` to verify server status

## Architecture

### Backend (server.js)
- Express server with Socket.IO for real-time multiplayer
- In-memory player storage using `players` object
- Player position bounds checking (15-785 x, 15-585 y)
- Socket events: 'move', 'chat message', connection/disconnect handling
- Serves static files from `/public` directory

### Frontend Architecture
- **HTML**: Single page app (`public/index.html`) with ocean theme styling
- **Game Engine**: Phaser 3 for 2D isometric game rendering
- **Networking**: Socket.IO client for real-time communication
- **Scene**: `HubScene` class handles game logic, player movement, and sprite management

### Game Systems
- **Map**: 40x40 isometric tile grid with fallback rectangles if assets missing
- **Player Movement**: WASD/Arrow keys, speed 150px/s, normalized diagonal movement
- **Rendering**: Isometric projection with depth sorting, camera follows player
- **Multiplayer**: Real-time position sync, colored player circles with name labels
- **Chat**: Side panel with message history, auto-focus on typing

### Asset Structure
- **Graphics**: Kenney asset pack tiles in `/public/assets/PNG/`
  - Voxel tiles, Abstract tiles, Platformer tiles
  - Expected sprites: `grass.png`, `well.png`, `player_knight.png` in `/public/assets/`
  - Fallback graphics generated if assets missing

### Coordinate System
- Cartesian to Isometric conversion: `(cartX - cartY) * (tileSize/2)`, `(cartX + cartY) * (tileSize/4)`
- World bounds: `mapWidth * mapHeight * 0.5 * tileSize`
- Camera: 1.2x zoom, follows player with smooth lerp

### Socket Events
- **Server→Client**: `currentPlayer`, `playersUpdate`, `chat message`
- **Client→Server**: `move` (x,y position), `chat message` (string)
- Player disconnection automatically removes from `players` object and updates all clients

### Key Dependencies
- express ^4.18.2
- socket.io ^4.7.5
- cors ^2.8.5
- Phaser 3.70.0 (CDN)