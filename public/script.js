class BingoGame {
    constructor() {
        this.socket = io();
        this.gameState = 'menu'; // menu, waiting, setup, playing
        this.playerIndex = null;
        this.setupGrid = Array(5).fill().map(() => Array(5).fill(null));
        this.currentSetupNumber = 1;
        this.leaderboard = [];
        this.gameCounter = 0;
        this.playerWins = {}; // Track win counts for each player
        this.playerGames = {}; // Track total games played for each player
        this.gridSubmitted = false; // Track if current grid has been submitted
        
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
            // Visual feedback that grid is submitted
            const submitBtn = document.getElementById('submitGridBtn');
            submitBtn.textContent = '✓ Grid Submitted';
            submitBtn.style.backgroundColor = '#6b7280'; // Gray color
            submitBtn.style.cursor = 'default';
            submitBtn.disabled = true;
            this.gridSubmitted = true; // Mark grid as submitted
        });

        // Random fill button
        document.getElementById('randomFillBtn').addEventListener('click', () => {
            this.randomFillGrid();
        });

        // Clear grid button
        document.getElementById('clearGridBtn').addEventListener('click', () => {
            this.clearGrid();
        });

        // Rematch button
        document.getElementById('rematchBtn').addEventListener('click', () => {
            this.requestRematch();
        });
        
        // New game button (View Leaderboard)
        document.getElementById('newGameBtn').addEventListener('click', () => {
            document.getElementById('winnerModal').classList.add('hidden'); // Use new class for modals
            
            const leaderboard = document.querySelector('.leaderboard-card');
            if (leaderboard) {
                leaderboard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                leaderboard.style.boxShadow = '0 0 20px var(--neon-green-glow)';
                leaderboard.style.borderColor = 'var(--neon-green)';
                
                setTimeout(() => {
                    leaderboard.style.boxShadow = '';
                    leaderboard.style.borderColor = '';
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
            if (data.playerIndex !== undefined) {
                this.playerIndex = data.playerIndex;
            }
            
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
                this.showWinner(data);
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
        const gameCodeDisplay = document.getElementById('gameCodeDisplay');
        gameCodeDisplay.textContent = gameCode;
        
        // Add click functionality to copy to clipboard
        gameCodeDisplay.style.cursor = 'pointer';
        gameCodeDisplay.title = 'Click to copy to clipboard';
        gameCodeDisplay.onclick = async () => {
            try {
                await navigator.clipboard.writeText(gameCode);
                // Visual feedback
                const originalText = gameCodeDisplay.textContent;
                gameCodeDisplay.textContent = 'Copied!';
                gameCodeDisplay.style.color = 'var(--neon-green)';
                setTimeout(() => {
                    gameCodeDisplay.textContent = originalText;
                    gameCodeDisplay.style.color = '';
                }, 1000);
            } catch (err) {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = gameCode;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                // Visual feedback
                const originalText = gameCodeDisplay.textContent;
                gameCodeDisplay.textContent = 'Copied!';
                gameCodeDisplay.style.color = 'var(--neon-green)';
                setTimeout(() => {
                    gameCodeDisplay.textContent = originalText;
                    gameCodeDisplay.style.color = '';
                }, 1000);
            }
        };
        
        document.getElementById('waitingMessage').textContent = 'Waiting for another player to join...';
        this.gameState = 'waiting';
    }
    
    updatePlayersStatus(players) {
        const statusDiv = document.getElementById('playersStatus');
        statusDiv.innerHTML = '';
        
        players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-status-item';
            playerDiv.innerHTML = `
                <span>${player.name} ${index === this.playerIndex ? '(You)' : ''}</span>
                <span style="color: ${player.ready ? 'var(--neon-green)' : 'var(--neon-violet)'};">
                    ${player.ready ? '✓ Ready' : '⏳ Setting up...'}
                </span>
            `;
            statusDiv.appendChild(playerDiv);
        });
    }
    
    showGridSetup() {
        this.hideAllScreens();
        document.getElementById('gridSetup').classList.remove('hidden');
        document.getElementById('setupMessage').textContent = 'Both players joined! Set up your grid.';
        this.gridSubmitted = false; // Reset submission flag for new grid setup
        this.createSetupGrid();
        
        const submitBtn = document.getElementById('submitGridBtn');
        submitBtn.classList.add('hidden');
        submitBtn.textContent = 'Confirm Grid';
        submitBtn.style.backgroundColor = '';
        submitBtn.style.cursor = '';
        submitBtn.disabled = false;
        document.getElementById('clearGridBtn').classList.add('hidden');
        document.getElementById('randomFillBtn').style.display = 'inline-block';
        document.getElementById('nextNumber').textContent = 'Next: 1';
        
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
        if (this.setupGrid[row][col] !== null || this.currentSetupNumber > 25) return;
        
        this.setupGrid[row][col] = this.currentSetupNumber;
        cellElement.textContent = this.currentSetupNumber;
        cellElement.classList.add('filled');
        
        this.currentSetupNumber++;
        document.getElementById('nextNumber').textContent = 
            this.currentSetupNumber <= 25 ? `Next: ${this.currentSetupNumber}` : 'Grid Complete!';
        
        if (this.currentSetupNumber > 1) {
            document.getElementById('clearGridBtn').classList.remove('hidden');
        }
        
        if (this.currentSetupNumber > 25) {
            if (!this.gridSubmitted) {
                const submitBtn = document.getElementById('submitGridBtn');
                submitBtn.classList.remove('hidden');
                submitBtn.textContent = 'Confirm Grid';
                submitBtn.style.backgroundColor = '';
                submitBtn.style.cursor = '';
                submitBtn.disabled = false;
            }
            document.getElementById('randomFillBtn').style.display = 'none';
        }
    }
    
    randomFillGrid() {
        const numbers = Array.from({length: 25}, (_, i) => i + 1);
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        
        let index = 0;
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                this.setupGrid[i][j] = numbers[index++];
            }
        }
        
        this.currentSetupNumber = 26;
        this.createSetupGrid();
        
        const cells = document.getElementById('setupGrid').children;
        let cellIndex = 0;
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                cells[cellIndex].textContent = this.setupGrid[i][j];
                cells[cellIndex].classList.add('filled');
                cellIndex++;
            }
        }
        
        document.getElementById('nextNumber').textContent = 'Grid Complete!';
        if (!this.gridSubmitted) {
            const submitBtn = document.getElementById('submitGridBtn');
            submitBtn.classList.remove('hidden');
            submitBtn.textContent = 'Confirm Grid';
            submitBtn.style.backgroundColor = '';
            submitBtn.style.cursor = '';
            submitBtn.disabled = false;
        }
        document.getElementById('clearGridBtn').classList.remove('hidden');
        document.getElementById('randomFillBtn').style.display = 'none';
    }
    
    clearGrid() {
        this.setupGrid = Array(5).fill().map(() => Array(5).fill(null));
        this.currentSetupNumber = 1;
        this.gridSubmitted = false; // Reset submission flag
        this.createSetupGrid();
        
        document.getElementById('nextNumber').textContent = 'Next: 1';
        const submitBtn = document.getElementById('submitGridBtn');
        submitBtn.classList.add('hidden');
        submitBtn.textContent = 'Confirm Grid';
        submitBtn.style.backgroundColor = '';
        submitBtn.style.cursor = '';
        submitBtn.disabled = false;
        document.getElementById('clearGridBtn').classList.add('hidden');
        document.getElementById('randomFillBtn').style.display = 'inline-block';
    }
    
    showGameBoard(data) {
        this.hideAllScreens();
        document.getElementById('gameBoard').classList.remove('hidden');
        
        document.getElementById('player1Name').textContent = data.players[0].name;
        document.getElementById('player2Name').textContent = data.players[1].name;
        document.getElementById('player1Score').textContent = `Score: ${data.players[0].score}/5`;
        document.getElementById('player2Score').textContent = `Score: ${data.players[1].score}/5`;
        
        if (this.playerIndex === 0) {
            document.getElementById('player1Name').textContent += ' (You)';
        } else {
            document.getElementById('player2Name').textContent += ' (You)';
        }
        
        const currentPlayerGrid = data.players[this.playerIndex].grid;
        this.createGameGrid('playerGrid', currentPlayerGrid, data.currentPlayer, data.numberPool);
        this.updateTurnIndicator(data.currentPlayer, data.players);
        
        this.gameState = 'playing';
    }
    
    createGameGrid(gridId, gridData, currentPlayer, numberPool) {
        const gridDiv = document.getElementById(gridId);
        gridDiv.innerHTML = '';
        
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.textContent = gridData[i][j].value;
                
                if (gridData[i][j].marked) {
                    cell.classList.add('marked');
                } else {
                    const cellNumber = gridData[i][j].value;
                    // Make cells clickable when it's the player's turn and the cell isn't already marked
                    if (currentPlayer === this.playerIndex) {
                        cell.classList.add('clickable-cell');
                        cell.addEventListener('click', () => this.selectNumber(cellNumber));
                    }
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
                numberDiv.classList.add('selected');
            } else {
                 numberDiv.addEventListener('click', () => this.selectNumber(i));
            }
            poolDiv.appendChild(numberDiv);
        }
    }
    
    selectNumber(number) {
        this.socket.emit('selectNumber', number);
    }
    
    updateGameBoard(data) {
        document.getElementById('player1Score').textContent = `Score: ${data.players[0].score}/5`;
        document.getElementById('player2Score').textContent = `Score: ${data.players[1].score}/5`;
        
        const currentPlayerGrid = data.players[this.playerIndex].grid;
        this.createGameGrid('playerGrid', currentPlayerGrid, data.currentPlayer, data.numberPool);
        
        if (!data.gameEnded) {
            this.updateTurnIndicator(data.currentPlayer, data.players);
        }
    }
    
    updateTurnIndicator(currentPlayer, players) {
        const turnDiv = document.getElementById('currentTurn');
        const messageDiv = document.getElementById('gameMessage');
        const playerGridContainer = document.getElementById('playerGridContainer');

        if (currentPlayer === this.playerIndex) {
            turnDiv.textContent = 'Your Turn!';
            turnDiv.style.color = 'var(--neon-green)';
            messageDiv.textContent = 'Select a number from the pool to mark it.';
            playerGridContainer.classList.add('my-turn'); // ✨ ADD GLOW
        } else {
            turnDiv.textContent = `Waiting for ${players[currentPlayer].name}...`;
            turnDiv.style.color = 'var(--text-primary)';
            messageDiv.textContent = 'Opponent is choosing a number.';
            playerGridContainer.classList.remove('my-turn'); // ✨ REMOVE GLOW
        }
    }
    
    showWinner(data) {
        this.addToLeaderboard({
            players: [
                { name: document.getElementById('player1Name').textContent.replace(' (You)', ''), score: data.players[0].score },
                { name: document.getElementById('player2Name').textContent.replace(' (You)', ''), score: data.players[1].score }
            ],
            winner: data.winner
        });
        
        document.getElementById('winnerModal').classList.remove('hidden');
        document.getElementById('winnerText').textContent = `${data.winner.name} wins with ${data.winner.score} completed lines!`;
        document.getElementById('playerGridContainer').classList.remove('my-turn');
    }
    
    addToLeaderboard(data) {
        this.gameCounter++;
        
        // Update win counts and games played
        const player1Name = data.players[0].name;
        const player2Name = data.players[1].name;
        const winnerName = data.winner.name;
        
        // Initialize player stats if they don't exist
        if (!this.playerWins[player1Name]) this.playerWins[player1Name] = 0;
        if (!this.playerWins[player2Name]) this.playerWins[player2Name] = 0;
        if (!this.playerGames[player1Name]) this.playerGames[player1Name] = 0;
        if (!this.playerGames[player2Name]) this.playerGames[player2Name] = 0;
        
        // Increment winner's count and games played for both
        this.playerWins[winnerName]++;
        this.playerGames[player1Name]++;
        this.playerGames[player2Name]++;
        
        this.updateLeaderboardDisplay();
    }
    
    updateLeaderboardDisplay() {
        const tbody = document.getElementById('leaderboardBody');
        const noGamesDiv = document.getElementById('noGames');
        
        if (Object.keys(this.playerWins).length === 0) {
            noGamesDiv.style.display = 'block';
            tbody.innerHTML = '';
            return;
        }
        
        noGamesDiv.style.display = 'none';
        tbody.innerHTML = '';
        
        // Get all unique players and sort by wins (descending)
        const players = Object.keys(this.playerWins).sort((a, b) => this.playerWins[b] - this.playerWins[a]);
        
        players.forEach(playerName => {
            const row = document.createElement('tr');
            const wins = this.playerWins[playerName];
            const gamesPlayed = this.playerGames[playerName];
            
            row.innerHTML = `
                <td style="color: var(--text-primary); font-weight: 600;">${playerName}</td>
                <td style="color: var(--neon-green); font-weight: 600;">${wins}</td>
                <td style="color: var(--text-secondary);">${gamesPlayed}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    }
    
    resetToMenu() {
        this.hideAllScreens();
        document.getElementById('mainMenu').classList.remove('hidden');
        document.getElementById('playerName').value = '';
        document.getElementById('gameCode').value = '';
        
        this.gameState = 'menu';
        this.playerIndex = null;
        this.clearGrid();
    }

    requestRematch() {
        document.getElementById('winnerModal').classList.add('hidden');
        this.showRematchRequest();
        this.socket.emit('requestRematch');
    }

    handleRematchRequest(data) {
        this.showRematchRequest(data.requestingPlayer);
    }

    showRematchRequest(requestingPlayer = null) {
        this.removeRematchModal(); // Ensure no duplicates
        const modal = document.createElement('div');
        modal.id = 'rematchModal';
        modal.className = 'modal-overlay';
        
        const message = requestingPlayer 
            ? `${requestingPlayer.name} wants a rematch!`
            : 'Rematch request sent. Waiting for opponent...';
            
        const buttons = requestingPlayer 
            ? `<div class="winner-buttons">
                 <button id="acceptRematchBtn" class="modal-btn rematch-btn">Accept</button>
                 <button id="declineRematchBtn" class="modal-btn back-to-menu-btn">Decline</button>
               </div>`
            : `<div style="height: 100px;"></div>`; // Placeholder for spinner
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-inner">
                    <div class="winner-emoji">🔄</div>
                    <h2 class="winner-title">Rematch?</h2>
                    <p class="winner-text">${message}</p>
                    ${buttons}
                </div>
            </div>`;
        
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
        if (modal) modal.remove();
    }

    startRematch() {
        this.removeRematchModal();
        this.setupGrid = Array(5).fill().map(() => Array(5).fill(null));
        this.currentSetupNumber = 1;
        this.showGridSetup();
        document.getElementById('setupMessage').textContent = 'Rematch! Set up your new grid.';
        document.getElementById('nextNumber').textContent = 'Next: 1';
        document.getElementById('submitGridBtn').classList.add('hidden');
        document.getElementById('clearGridBtn').classList.add('hidden');
        document.getElementById('randomFillBtn').style.display = 'inline-block';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BingoGame();
});