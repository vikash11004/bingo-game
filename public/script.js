class BingoGame {
    constructor() {
        this.socket = io();
        this.gameState = 'menu'; // menu, waiting, setup, playing
        this.playerIndex = null;
        this.setupGrid = Array(5).fill().map(() => Array(5).fill(null));
        this.currentSetupNumber = 1;
        this.leaderboard = [];
        this.gameCounter = 0;
        this.opponentName = null; // Track opponent name for leaderboard
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
    }
    
    initializeEventListeners() {
        // Main menu events
        document.getElementById('createGameBtn').addEventListener('click', () => {
            const playerName = document.getElementById('playerName').value.trim();
            if (!playerName) {
                alert('Please enter your name');
                return;
            }
            this.socket.emit('createGame', playerName);
        });
        
        document.getElementById('joinGameBtn').addEventListener('click', () => {
            const playerName = document.getElementById('playerName').value.trim();
            const gameCode = document.getElementById('gameCode').value.trim();
            if (!playerName || !gameCode) {
                alert('Please enter your name and game code');
                return;
            }
            this.socket.emit('joinGame', { gameCode, playerName });
        });
        
        // Grid setup events
        document.getElementById('submitGridBtn').addEventListener('click', () => {
            this.socket.emit('submitGrid', this.setupGrid);
        });

        // Rematch button
        document.getElementById('rematchBtn').addEventListener('click', () => {
            this.requestRematch();
        });
        
        // New game button
        document.getElementById('newGameBtn').addEventListener('click', () => {
            // Close winner modal and stay on game board to show leaderboard
            document.getElementById('winnerModal').classList.add('hidden');
            
            // Scroll to leaderboard and highlight it
            const leaderboard = document.querySelector('.bg-white.rounded-lg.shadow-lg.p-6:last-child');
            if (leaderboard) {
                leaderboard.scrollIntoView({ behavior: 'smooth' });
                leaderboard.style.border = '3px solid #22c55e';
                leaderboard.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.3)';
                
                // Remove highlight after 3 seconds
                setTimeout(() => {
                    leaderboard.style.border = '';
                    leaderboard.style.boxShadow = '';
                }, 3000);
            }
        });

        // Back to main menu button
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            this.resetToMenu();
        });
    }
    
    initializeSocketListeners() {
        this.socket.on('gameCreated', (data) => {
            this.playerIndex = data.playerIndex;
            this.showWaitingRoom(data.gameCode);
        });
        
        this.socket.on('playerJoined', (data) => {
            this.updatePlayersStatus(data.players);
            if (data.canStart) {
                this.showGridSetup();
            }
        });
        
        this.socket.on('playerReady', (data) => {
            this.updatePlayersStatus(data.players);
        });
        
        this.socket.on('gameStarted', (data) => {
            this.showGameBoard(data);
        });
        
        this.socket.on('numberSelected', (data) => {
            this.updateGameBoard(data);
            if (data.winner) {
                this.showWinner(data.winner);
                // Don't call addToLeaderboard here since it's now called in showWinner
            }
        });
        
        this.socket.on('error', (message) => {
            alert(message);
        });
        
        this.socket.on('playerDisconnected', () => {
            alert('Other player disconnected');
            this.resetToMenu();
        });

        this.socket.on('rematchRequested', (data) => {
            this.handleRematchRequest(data);
        });

        this.socket.on('rematchAccepted', () => {
            this.startRematch();
        });

        this.socket.on('rematchDeclined', () => {
            alert('Opponent declined the rematch request');
        });
    }
    
    showWaitingRoom(gameCode) {
        this.hideAllScreens();
        document.getElementById('waitingRoom').classList.remove('hidden');
        document.getElementById('gameCodeDisplay').textContent = `Game Code: ${gameCode}`;
        document.getElementById('waitingMessage').textContent = 'Waiting for another player to join...';
        this.gameState = 'waiting';
    }
    
    updatePlayersStatus(players) {
        const statusDiv = document.getElementById('playersStatus');
        statusDiv.innerHTML = '';
        
        players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'flex justify-between items-center p-3 bg-gray-50 rounded';
            playerDiv.innerHTML = `
                <span>Player ${index + 1}: ${player.name}</span>
                <span class="${player.ready ? 'text-green-600' : 'text-yellow-600'}">
                    ${player.ready ? '✓ Ready' : '⏳ Setting up grid'}
                </span>
            `;
            statusDiv.appendChild(playerDiv);
        });
    }
    
    showGridSetup() {
        this.hideAllScreens();
        document.getElementById('gridSetup').classList.remove('hidden');
        document.getElementById('waitingMessage').textContent = 'Both players joined! Set up your grid.';
        this.createSetupGrid();
        this.gameState = 'setup';
    }
    
    createSetupGrid() {
        const gridDiv = document.getElementById('setupGrid');
        gridDiv.innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.addEventListener('click', () => this.fillSetupCell(i, j, cell));
                gridDiv.appendChild(cell);
            }
        }
    }
    
    fillSetupCell(row, col, cellElement) {
        if (this.setupGrid[row][col] !== null) return;
        if (this.currentSetupNumber > 25) return;
        
        this.setupGrid[row][col] = this.currentSetupNumber;
        cellElement.textContent = this.currentSetupNumber;
        cellElement.classList.add('filled');
        
        this.currentSetupNumber++;
        document.getElementById('nextNumber').textContent = 
            this.currentSetupNumber <= 25 ? `Next: ${this.currentSetupNumber}` : 'Grid Complete!';
        
        if (this.currentSetupNumber > 25) {
            document.getElementById('submitGridBtn').classList.remove('hidden');
        }
    }
    
    showGameBoard(data) {
        this.hideAllScreens();
        document.getElementById('gameBoard').classList.remove('hidden');
        
        // Get current player data
        const currentPlayer = data.players[this.playerIndex];
        const opponentPlayer = data.players[1 - this.playerIndex];
        
        // Store opponent name for leaderboard (with safety check)
        this.opponentName = opponentPlayer ? opponentPlayer.name : 'Opponent';
        
        // Set current player's name and score
        document.getElementById('currentPlayerName').textContent = `${currentPlayer.name} (You)`;
        document.getElementById('currentPlayerScore').textContent = `Score: ${currentPlayer.score}/5`;
        
        // Show only current player's grid
        this.createGameGrid('currentPlayerGrid', currentPlayer.grid);
        
        // Create number pool
        this.createNumberPool(data.numberPool);
        
        // Update turn indicator
        this.updateTurnIndicator(data.currentPlayer, data.players);
        
        this.gameState = 'playing';
    }
    
    createGameGrid(gridId, gridData) {
        const gridDiv = document.getElementById(gridId);
        gridDiv.innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell text-sm';
                cell.textContent = gridData[i][j].value;
                if (gridData[i][j].marked) {
                    cell.classList.add('marked');
                }
                gridDiv.appendChild(cell);
            }
        }
    }


    
    createNumberPool(numbers) {
        const poolDiv = document.getElementById('numberPool');
        poolDiv.innerHTML = '';
        
        for (let i = 1; i <= 25; i++) {
            const numberDiv = document.createElement('div');
            numberDiv.className = 'number-pool-item';
            numberDiv.textContent = i;
            
            if (numbers.includes(i)) {
                numberDiv.addEventListener('click', () => this.selectNumber(i));
            } else {
                numberDiv.classList.add('selected');
            }
            
            poolDiv.appendChild(numberDiv);
        }
    }
    
    selectNumber(number) {
        this.socket.emit('selectNumber', number);
    }
    
    updateGameBoard(data) {
        // Get current player data
        const currentPlayer = data.players[this.playerIndex];
        
        // Update current player's score
        document.getElementById('currentPlayerScore').textContent = `Score: ${currentPlayer.score}/5`;
        
        // Update current player's grid
        this.createGameGrid('currentPlayerGrid', currentPlayer.grid);
        
        // Update number pool
        this.createNumberPool(data.numberPool);
        
        // Update turn indicator
        if (!data.gameEnded) {
            this.updateTurnIndicator(data.currentPlayer, data.players);
        }
    }
    
    updateTurnIndicator(currentPlayer, players) {
        const turnDiv = document.getElementById('currentTurn');
        const messageDiv = document.getElementById('gameMessage');
        
        if (currentPlayer === this.playerIndex) {
            turnDiv.textContent = 'Your Turn';
            turnDiv.className = 'text-xl font-bold mb-2 text-green-600 pulse';
            messageDiv.textContent = 'Select a number from the pool below';
        } else {
            turnDiv.textContent = `${players[currentPlayer].name}'s Turn`;
            turnDiv.className = 'text-xl font-bold mb-2 text-blue-600';
            messageDiv.textContent = 'Waiting for opponent to select a number...';
        }
    }
    
    showWinner(winner) {
        // Get current player name
        const currentPlayerName = document.getElementById('currentPlayerName').textContent.replace(' (You)', '');
        
        // For leaderboard, we need both player names in correct order
        const player1Name = this.playerIndex === 0 ? currentPlayerName : this.opponentName;
        const player2Name = this.playerIndex === 0 ? this.opponentName : currentPlayerName;
        
        // First update the leaderboard before showing winner modal
        this.addToLeaderboard({
            players: [
                { name: player1Name },
                { name: player2Name }
            ],
            winner: winner
        });
        
        document.getElementById('winnerModal').classList.remove('hidden');
        document.getElementById('winnerText').textContent = `${winner.name} wins with ${winner.score} completed lines!`;
    }
    
    addToLeaderboard(data) {
        this.gameCounter++;
        this.leaderboard.push({
            gameNumber: this.gameCounter,
            player1: data.players[0].name,
            player2: data.players[1].name,
            winner: data.winner.name
        });
        
        this.updateLeaderboardDisplay();
    }
    
    updateLeaderboardDisplay() {
        const tbody = document.getElementById('leaderboardBody');
        const noGamesDiv = document.getElementById('noGames');
        
        if (this.leaderboard.length === 0) {
            noGamesDiv.classList.remove('hidden');
            tbody.innerHTML = '';
            return;
        }
        
        noGamesDiv.classList.add('hidden');
        tbody.innerHTML = '';
        
        // Show games in reverse order (most recent first)
        this.leaderboard.slice().reverse().forEach(game => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            
            // Highlight the most recent game
            if (game.gameNumber === this.gameCounter) {
                row.className += ' bg-green-50 border-green-200';
            }
            
            row.innerHTML = `
                <td class="p-2">${game.gameNumber}</td>
                <td class="p-2">${game.player1}</td>
                <td class="p-2">${game.player2}</td>
                <td class="p-2 font-semibold text-green-600">${game.winner}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    hideAllScreens() {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('waitingRoom').classList.add('hidden');
        document.getElementById('gridSetup').classList.add('hidden');
        document.getElementById('gameBoard').classList.add('hidden');
        document.getElementById('winnerModal').classList.add('hidden');
    }
    
    resetToMenu() {
        this.hideAllScreens();
        document.getElementById('mainMenu').classList.remove('hidden');
        
        // Reset form fields
        document.getElementById('playerName').value = '';
        document.getElementById('gameCode').value = '';
        
        // Reset game state
        this.gameState = 'menu';
        this.playerIndex = null;
        this.setupGrid = Array(5).fill().map(() => Array(5).fill(null));
        this.currentSetupNumber = 1;
        document.getElementById('nextNumber').textContent = 'Next: 1';
        document.getElementById('submitGridBtn').classList.add('hidden');
    }

    requestRematch() {
        // Hide winner modal and show rematch request
        document.getElementById('winnerModal').classList.add('hidden');
        this.showRematchRequest();
        this.socket.emit('requestRematch');
    }

    handleRematchRequest(data) {
        // Show rematch request modal for the other player
        this.showRematchRequest(data.requestingPlayer);
    }

    showRematchRequest(requestingPlayer = null) {
        const modal = document.createElement('div');
        modal.id = 'rematchModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        const message = requestingPlayer 
            ? `${requestingPlayer.name} wants a rematch!`
            : 'Waiting for opponent to accept rematch...';
            
        const buttons = requestingPlayer 
            ? `<div class="space-y-3">
                 <button id="acceptRematchBtn" class="w-full bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-semibold">
                     Accept Rematch
                 </button>
                 <button id="declineRematchBtn" class="w-full bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 font-semibold">
                     Decline
                 </button>
               </div>`
            : `<div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>`;
        
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-8 max-w-md mx-4">
                <div class="text-center">
                    <div class="text-4xl mb-4">🔄</div>
                    <h2 class="text-2xl font-bold mb-4">Rematch Request</h2>
                    <p class="text-lg text-gray-700 mb-6">${message}</p>
                    ${buttons}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        if (requestingPlayer) {
            document.getElementById('acceptRematchBtn').addEventListener('click', () => {
                this.socket.emit('acceptRematch');
                this.removeRematchModal();
            });
            
            document.getElementById('declineRematchBtn').addEventListener('click', () => {
                this.socket.emit('declineRematch');
                this.removeRematchModal();
            });
        }
    }

    removeRematchModal() {
        const modal = document.getElementById('rematchModal');
        if (modal) {
            modal.remove();
        }
    }

    startRematch() {
        this.removeRematchModal();
        
        // Reset grid setup state
        this.setupGrid = Array(5).fill().map(() => Array(5).fill(null));
        this.currentSetupNumber = 1;
        
        // Show grid setup screen
        this.showGridSetup();
        
        // Update message for rematch
        document.getElementById('waitingMessage').textContent = 'Rematch! Set up your new grid.';
        
        // Reset the UI elements
        document.getElementById('nextNumber').textContent = 'Next: 1';
        document.getElementById('submitGridBtn').classList.add('hidden');
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BingoGame();
});