# Multiplayer Bingo Game

A real-time multiplayer Bingo game built with Node.js, Express, Socket.IO, and Tailwind CSS.

## Features

- **Real-time multiplayer gameplay** - Two players can play simultaneously
- **Custom grid setup** - Players create their own 5x5 Bingo grids
- **Turn-based gameplay** - Players take turns selecting numbers
- **Live game state sync** - All actions are synchronized in real-time
- **Winner detection** - Automatic detection of winning patterns (rows, columns, diagonals)
- **Session leaderboard** - Track wins across multiple games
- **Responsive design** - Works on desktop and mobile devices

## Installation

1. **Clone or download the project**
2. **Install dependencies:**
   ```bash
   npm install
   ```

## Running the Game

1. **Start the server:**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

2. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

## How to Play

1. **Create a Game:**
   - Enter your name
   - Click "Create Game"
   - Share the generated game code with another player

2. **Join a Game:**
   - Enter your name
   - Enter the game code provided by the game creator
   - Click "Join"

3. **Setup Your Grid:**
   - Click cells in your preferred order to place numbers 1-25
   - Submit your grid when complete
   - Wait for the other player to finish setup

4. **Play the Game:**
   - Take turns selecting numbers from the pool
   - Numbers are automatically marked on both players' grids
   - First player to complete a row, column, or diagonal wins!

## Technical Details

### Server-side (Node.js)
- **Express.js** - Web server framework
- **Socket.IO** - Real-time communication
- **Game logic** - Turn management, winner detection, room management

### Client-side
- **Vanilla JavaScript** - Game interface and logic
- **Socket.IO Client** - Real-time communication with server
- **Tailwind CSS** - Styling and responsive design

### Game Rules
- 5x5 Bingo grid
- Players arrange numbers 1-25 in any order they choose
- Win conditions: Complete any row, column, or diagonal
- Turn-based number selection from a shared pool

## Project Structure

```
bingo-multiplayer/
├── server.js              # Node.js server with game logic
├── package.json           # Dependencies and scripts
├── public/                # Client-side files
│   ├── index.html        # Main HTML file
│   ├── script.js         # Client-side JavaScript
│   └── styles.css        # CSS styles
└── README.md             # This file
```

## Debugging Features

- Console logging for all major game events
- Error handling for network issues
- Input validation for player names and game codes
- Connection status indicators

## Dependencies

- **express**: ^4.18.2 - Web framework
- **socket.io**: ^4.7.2 - Real-time communication
- **nodemon**: ^3.0.1 (dev) - Auto-restart during development

## Browser Compatibility

- Modern browsers with ES6+ support
- WebSocket support required for real-time features
- Responsive design works on mobile and desktop
