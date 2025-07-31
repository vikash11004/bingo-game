const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Game state management
class GameRoom {
    constructor(gameCode, creator) {
        this.gameCode = gameCode;
        this.players = [creator];
        this.currentPlayer = Math.floor(Math.random() * 2); // Randomly choose 0 or 1
        this.gameState = 'waiting'; // waiting, setup, playing, ended
        this.numberPool = Array.from({length: 25}, (_, i) => i + 1);
        this.gameStarted = false;
        // Track completed lines for each player to avoid double counting
        this.completedLines = [new Set(), new Set()]; // Set for each player
    }

    addPlayer(player) {
        if (this.players.length < 2) {
            this.players.push(player);
            return true;
        }
        return false;
    }

    isReady() {
        return this.players.length === 2;
    }

    areAllPlayersReady() {
        return this.players.every(player => player.ready);
    }

    setPlayerGrid(playerId, grid) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.grid = this.processGrid(grid);
            player.ready = true;
        }
    }

    processGrid(setupGrid) {
        const grid = [];
        for (let i = 0; i < 5; i++) {
            grid[i] = [];
            for (let j = 0; j < 5; j++) {
                grid[i][j] = {
                    value: setupGrid[i][j],
                    marked: false
                };
            }
        }
        return grid;
    }

    selectNumber(playerId, number) {
        if (this.gameState !== 'playing') return null;
        if (this.players[this.currentPlayer].id !== playerId) return null;
        if (!this.numberPool.includes(number)) return null;

        // Remove number from pool
        this.numberPool = this.numberPool.filter(n => n !== number);

        // Mark number on both players' grids
        this.players.forEach(player => {
            for (let i = 0; i < 5; i++) {
                for (let j = 0; j < 5; j++) {
                    if (player.grid[i][j].value === number) {
                        player.grid[i][j].marked = true;
                    }
                }
            }
        });

        // Check for winner
        const winner = this.checkWinner();
        if (winner) {
            this.gameState = 'ended';
            return {
                players: this.players,
                numberPool: this.numberPool,
                currentPlayer: this.currentPlayer,
                winner: winner,
                gameEnded: true
            };
        }

        // Switch turns
        this.currentPlayer = 1 - this.currentPlayer;

        return {
            players: this.players,
            numberPool: this.numberPool,
            currentPlayer: this.currentPlayer,
            gameEnded: false
        };
    }

    checkWinner() {
        // Update scores for all players
        this.updatePlayerScores();
        
        // Check if any player has reached 5 points
        for (const player of this.players) {
            if (player.score >= 5) {
                return player;
            }
        }
        return null;
    }

    updatePlayerScores() {
        this.players.forEach((player, playerIndex) => {
            const newLines = this.getCompletedLines(player.grid);
            const previousLines = this.completedLines[playerIndex];
            
            // Count new completed lines that weren't completed before
            newLines.forEach(lineId => {
                if (!previousLines.has(lineId)) {
                    player.score++;
                    previousLines.add(lineId);
                    console.log(`Player ${player.name} completed line ${lineId}. Score: ${player.score}`);
                }
            });
        });
    }

    getCompletedLines(grid) {
        const completedLines = new Set();
        
        // Check rows
        for (let i = 0; i < 5; i++) {
            if (grid[i].every(cell => cell.marked)) {
                completedLines.add(`row-${i}`);
            }
        }

        // Check columns
        for (let j = 0; j < 5; j++) {
            if (grid.every(row => row[j].marked)) {
                completedLines.add(`col-${j}`);
            }
        }

        // Check main diagonal
        if (grid.every((row, i) => row[i].marked)) {
            completedLines.add('diag-main');
        }

        // Check anti-diagonal
        if (grid.every((row, i) => row[4 - i].marked)) {
            completedLines.add('diag-anti');
        }

        return completedLines;
    }
}

// Store active games
const games = new Map();
const playerSockets = new Map();

function generateGameCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createGame', (playerName) => {
        const gameCode = generateGameCode();
        const player = {
            id: socket.id,
            name: playerName,
            ready: false,
            grid: null,
            score: 0
        };

        const game = new GameRoom(gameCode, player);
        games.set(gameCode, game);
        playerSockets.set(socket.id, { gameCode, playerIndex: 0 });

        socket.join(gameCode);
        socket.emit('gameCreated', { 
            gameCode, 
            playerIndex: 0 
        });

        console.log(`Game created: ${gameCode} by ${playerName}`);
    });

    socket.on('joinGame', ({ gameCode, playerName }) => {
        const game = games.get(gameCode);
        
        if (!game) {
            socket.emit('error', 'Game not found');
            return;
        }

        if (game.players.length < 2) {
            const player = {
                id: socket.id,
                name: playerName,
                ready: false,
                grid: null,
                score: 0
            };

            game.addPlayer(player);
            playerSockets.set(socket.id, { gameCode, playerIndex: 1 });

            socket.join(gameCode);
            
            // Send playerIndex to the joining player
            socket.emit('playerJoined', {
                players: game.players,
                canStart: game.isReady(),
                playerIndex: 1
            });
            
            // Send update to all other players in the room
            socket.to(gameCode).emit('playerJoined', {
                players: game.players,
                canStart: game.isReady()
            });

            console.log(`Player ${playerName} joined game ${gameCode}`);
        }
        // Removed the "Game is full" error message - silently ignore join attempts for full games
    });

    socket.on('submitGrid', (gridData) => {
        const playerInfo = playerSockets.get(socket.id);
        if (!playerInfo) return;

        const game = games.get(playerInfo.gameCode);
        if (!game) return;

        game.setPlayerGrid(socket.id, gridData);

        io.to(playerInfo.gameCode).emit('playerReady', {
            players: game.players
        });

        if (game.areAllPlayersReady()) {
            game.gameState = 'playing';
            // currentPlayer is already randomly set in constructor

            io.to(playerInfo.gameCode).emit('gameStarted', {
                players: game.players,
                numberPool: game.numberPool,
                currentPlayer: game.currentPlayer
            });

            console.log(`Game ${playerInfo.gameCode} started with ${game.players[game.currentPlayer].name} going first`);
        }
    });

    socket.on('selectNumber', (number) => {
        const playerInfo = playerSockets.get(socket.id);
        if (!playerInfo) return;

        const game = games.get(playerInfo.gameCode);
        if (!game) return;

        const result = game.selectNumber(socket.id, number);
        if (result) {
            io.to(playerInfo.gameCode).emit('numberSelected', result);

            if (result.gameEnded) {
                console.log(`Game ${playerInfo.gameCode} ended. Winner: ${result.winner.name}`);
            }
        }
    });

    socket.on('requestRematch', () => {
        const playerInfo = playerSockets.get(socket.id);
        if (!playerInfo) return;

        const game = games.get(playerInfo.gameCode);
        if (!game) return;

        // Find the requesting player
        const requestingPlayer = game.players.find(p => p.id === socket.id);
        if (!requestingPlayer) return;

        // Notify the other player about the rematch request
        socket.to(playerInfo.gameCode).emit('rematchRequested', {
            requestingPlayer: requestingPlayer
        });

        console.log(`${requestingPlayer.name} requested a rematch in game ${playerInfo.gameCode}`);
    });

    socket.on('acceptRematch', () => {
        const playerInfo = playerSockets.get(socket.id);
        if (!playerInfo) return;

        const game = games.get(playerInfo.gameCode);
        if (!game) return;

        // Reset the game for rematch
        game.gameState = 'setup';
        game.currentPlayer = Math.floor(Math.random() * 2); // Randomly choose starting player for rematch
        game.numberPool = Array.from({length: 25}, (_, i) => i + 1);
        game.completedLines = [new Set(), new Set()]; // Reset completed lines tracking
        
        // Reset all players
        game.players.forEach(player => {
            player.ready = false;
            player.grid = null;
            player.score = 0;
        });

        // Notify both players that rematch was accepted
        io.to(playerInfo.gameCode).emit('rematchAccepted');

        console.log(`Rematch accepted in game ${playerInfo.gameCode}`);
    });

    socket.on('declineRematch', () => {
        const playerInfo = playerSockets.get(socket.id);
        if (!playerInfo) return;

        // Notify the other player that rematch was declined
        socket.to(playerInfo.gameCode).emit('rematchDeclined');

        console.log(`Rematch declined in game ${playerInfo.gameCode}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        const playerInfo = playerSockets.get(socket.id);
        if (playerInfo) {
            const game = games.get(playerInfo.gameCode);
            if (game) {
                // Notify other players
                socket.to(playerInfo.gameCode).emit('playerDisconnected');
                
                // Clean up the game
                games.delete(playerInfo.gameCode);
                console.log(`Game ${playerInfo.gameCode} ended due to disconnection`);
            }
            playerSockets.delete(socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play the game`);
});

module.exports = app;