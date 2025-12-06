const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        //origin: "http://localhost:3000",
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Game state
const rooms = new Map();
const players = new Map();

// Generate unique room ID
function generateRoomId() {
    return Math.floor(Math.random() * 900000) + 100000;
}

// Create a deck of cards
function createDeck() {
    const suits = ['spades', 'hearts', 'diamonds', 'clubs', 'stars', 'crowns'];
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const deck = [];

    // Add regular cards
    for (const suit of suits) {
        for (const value of values) {
            deck.push({suit, value});
        }
    }

    // Add 3 jokers
    for (let i = 0; i < 3; i++) {
        deck.push({suit: 'joker', value: null});
    }

    return deck;
}

// Shuffle array
function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Deal cards to players
function dealCardsFromDeck(room, numCards = 7) {
    const playerCount = room.players.length;
    const cardsNeeded = playerCount * numCards;

    // Check if we need a new deck
    if (!room.currentDeck || room.currentDeck.length < cardsNeeded) {
        console.log(`[0] Creating new deck - needed: ${cardsNeeded}, available: ${room.currentDeck ? room.currentDeck.length : 0}`);
        room.currentDeck = shuffle(createDeck());
        room.isNewShuffle = true;
    } else {
        room.isNewShuffle = false;
    }

    // Shuffle the remaining cards before dealing
    room.currentDeck = shuffle(room.currentDeck);

    const hands = {};

    // Initialize empty hands
    room.players.forEach(player => {
        hands[player.id] = [];
    });

    // Deal cards one by one to ensure even distribution
    for (let round = 0; round < numCards; round++) {
        for (const player of room.players) {
            if (room.currentDeck.length > 0) {
                hands[player.id].push(room.currentDeck.pop());
            }
        }
    }

    console.log(`[0] Cards dealt. Remaining in deck: ${room.currentDeck.length}`);
    return hands;
}

// Find next available position on board (skipping occupied spaces)
function findNextAvailablePosition(currentPosition, allPlayers, playerId) {
    const occupiedPositions = new Set(
        allPlayers
            .filter(p => p.id !== playerId)
            .map(p => p.position)
    );

    let nextPosition = currentPosition + 1;

    // Keep incrementing until we find an empty space
    while (occupiedPositions.has(nextPosition) && nextPosition <= 24) {
        nextPosition++;
    }

    return Math.min(nextPosition, 24);
}

// Helper function to check if a suit can beat the lead suit
function canBeatLeadSuit(suit, leadSuit, suitRanking) {
    // If no ranking exists, no suit can beat lead suit
    if (suitRanking.length === 0) return false;

    const suitIndex = suitRanking.indexOf(suit);
    const leadSuitIndex = suitRanking.indexOf(leadSuit);

    // If the played suit is not in ranking, it cannot beat lead suit
    if (suitIndex === -1) return false;

    // If lead suit is not in ranking, any ranked suit beats it
    if (leadSuitIndex === -1) return true;

    // Lower index = higher rank, so can only beat if index is lower
    return suitIndex < leadSuitIndex;
}

// Helper function to compare cards by ranking and value
function compareCardsByRankingAndValue(card1, card2, suitRanking) {
    const suit1Index = suitRanking.indexOf(card1.suit);
    const suit2Index = suitRanking.indexOf(card2.suit);

    // Both suits are in ranking
    if (suit1Index !== -1 && suit2Index !== -1) {
        if (suit1Index < suit2Index) return 1;
        if (suit1Index > suit2Index) return -1;
        // Same suit rank, compare by value
        if (card1.value > card2.value) return 1;
        if (card1.value < card2.value) return -1;
        return 0;
    }

    // Only card1's suit is ranked
    if (suit1Index !== -1 && suit2Index === -1) {
        return 1;
    }

    // Only card2's suit is ranked
    if (suit1Index === -1 && suit2Index !== -1) {
        return -1;
    }

    // Neither suit is ranked, compare by value only
    if (card1.value > card2.value) return 1;
    if (card1.value < card2.value) return -1;
    return 0;
}

// Compare cards to determine winner - CORRECTED LOGIC
function compareCards(card1, card2, suitRanking, leadSuit, card1Index, card2Index) {
    // Handle jokers - jokers always win, but latest joker wins among jokers
    if (card1.suit === 'joker' && card2.suit === 'joker') {
        // Later played joker wins (higher index = played later)
        if (card2Index > card1Index) return -1;
        if (card1Index > card2Index) return 1;
        return 0; // Same timing (shouldn't happen)
    }
    if (card1.suit === 'joker') return 1;
    if (card2.suit === 'joker') return -1;

    // If no lead suit is set, compare normally
    if (!leadSuit) {
        return compareCardsByRankingAndValue(card1, card2, suitRanking);
    }

    // Determine if each card follows lead suit
    const card1FollowsLead = card1.suit === leadSuit;
    const card2FollowsLead = card2.suit === leadSuit;

    // If both follow lead suit, compare by value (higher value wins)
    if (card1FollowsLead && card2FollowsLead) {
        if (card1.value > card2.value) return 1;
        if (card1.value < card2.value) return -1;
        return 0;
    }

    // If only card1 follows lead suit
    if (card1FollowsLead && !card2FollowsLead) {
        // card1 follows lead, card2 doesn't
        // card2 can only win if it's from a HIGHER-ranked suit than lead suit
        return canBeatLeadSuit(card2.suit, leadSuit, suitRanking) ? -1 : 1;
    }

    // If only card2 follows lead suit
    if (!card1FollowsLead && card2FollowsLead) {
        // card2 follows lead, card1 doesn't
        // card1 can only win if it's from a HIGHER-ranked suit than lead suit
        return canBeatLeadSuit(card1.suit, leadSuit, suitRanking) ? 1 : -1;
    }

    // Neither follows lead suit - both are "discarding"
    // Compare by ranking and value, but neither should beat a lead suit card
    return compareCardsByRankingAndValue(card1, card2, suitRanking);
}

// Update findRoundWinner to pass card indices for joker timing
function findRoundWinner(cardsPlayed, suitRanking, leadSuit) {
    if (cardsPlayed.length === 0) return null;

    let winner = cardsPlayed[0];
    let winnerIndex = 0;

    for (let i = 1; i < cardsPlayed.length; i++) {
        // Pass indices to handle joker timing
        if (compareCards(cardsPlayed[i].card, winner.card, suitRanking, leadSuit, i, winnerIndex) > 0) {
            winner = cardsPlayed[i];
            winnerIndex = i;
        }
    }

    return winner.playerId;
}

// Check if player in green zone
function isInGreenZone(position) {
    return position >= 19 && position <= 25;
}

// Check if player can play a specific card (CORRECTED LOGIC)
function canPlayCard(card, leadSuit, playerHand) {
    // If no lead suit yet, any card can be played
    if (!leadSuit) return true;

    // Jokers can always be played
    if (card.suit === 'joker') return true;

    // Check if player has cards of the lead suit (excluding jokers)
    const hasLeadSuit = playerHand.some(c => c.suit === leadSuit);

    if (hasLeadSuit) {
        // Player HAS lead suit cards, so they must play lead suit or joker
        return card.suit === leadSuit || card.suit === 'joker';
    } else {
        // Player does NOT have lead suit cards, so they can play any card
        return true;
    }
}

// Get valid cards for a player (CORRECTED LOGIC)
function getValidCards(playerHand, leadSuit) {
    if (!leadSuit) return playerHand;

    // Check if player has cards of the lead suit (excluding jokers)
    const hasLeadSuit = playerHand.some(c => c.suit === leadSuit);

    if (hasLeadSuit) {
        // Player HAS lead suit cards, so they can only play lead suit or jokers
        return playerHand.filter(c => c.suit === leadSuit || c.suit === 'joker');
    } else {
        // Player does NOT have lead suit cards, so they can play any card
        return playerHand;
    }
}

// Check if player is on a pick step
function isOnPickStep(position) {
    const pickSteps = [3, 6, 9, 14, 19, 22];
    return pickSteps.includes(position);
}

// Start a round
function startRound(room) {
    console.log(`[0] Starting round ${room.currentRound} in room: ${room.id}`);

    // Reset round state
    room.cardsPlayed = [];
    room.leadSuit = null;

    // Determine turn order
    if (room.currentRound === 1) {
        // First round: randomize order
        room.turnOrder = shuffle([...room.players.map(p => p.id)]);
    } else {
        // Subsequent rounds: winner starts
        const lastWinner = room.lastRoundWinner;
        if (lastWinner) {
            const winnerIndex = room.players.findIndex(p => p.id === lastWinner);
            if (winnerIndex !== -1) {
                room.turnOrder = [];
                // Start with winner, then continue in original order
                for (let i = 0; i < room.players.length; i++) {
                    const playerIndex = (winnerIndex + i) % room.players.length;
                    room.turnOrder.push(room.players[playerIndex].id);
                }
            }
        }
    }

    room.currentTurnIndex = 0;
    room.currentPlayerId = room.turnOrder[0];

    // Emit round start to all players
    room.players.forEach(player => {
        const isPlayerTurn = player.id === room.currentPlayerId;
        const validCards = isPlayerTurn ? getValidCards(player.hand, room.leadSuit) : [];

        io.to(player.id).emit("roundStart", {
            message: `Round ${room.currentRound} started!`,
            round: room.currentRound,
            isYourTurn: isPlayerTurn,
            currentPlayer: room.currentPlayerId,
            turnOrder: room.turnOrder,
            validCards: validCards
        });
    });
}

// Process turn end and move to next player
function processNextTurn(room) {
    room.currentTurnIndex++;

    if (room.currentTurnIndex >= room.turnOrder.length) {
        // All players have played, end the round
        processRoundEnd(room);
    } else {
        // Move to next player
        room.currentPlayerId = room.turnOrder[room.currentTurnIndex];

        // Emit turn update to all players
        room.players.forEach(player => {
            const isPlayerTurn = player.id === room.currentPlayerId;
            const validCards = isPlayerTurn ? getValidCards(player.hand, room.leadSuit) : [];

            io.to(player.id).emit("turnUpdate", {
                isYourTurn: isPlayerTurn,
                currentPlayer: room.currentPlayerId,
                validCards: validCards,
                leadSuit: room.leadSuit
            });
        });
    }
}

// Process round end
function processRoundEnd(room) {
    console.log(`[0] Processing round end for room: ${room.id}`);

    // Find round winner
    const winnerId = findRoundWinner(room.cardsPlayed, room.suitRanking);
    room.lastRoundWinner = winnerId;

    // Update positions
    if (winnerId) {
        const winner = room.players.find(p => p.id === winnerId);
        if (winner) {
            const newPosition = findNextAvailablePosition(winner.position, room.players, winnerId);
            winner.position = newPosition;
            console.log(`[0] Player ${winner.name} moved to position ${newPosition}`);

            // Check if winner landed in green zone (positions 19-25)
            /*if (isInGreenZone(newPosition)) {
                const otherGreenZonePlayers = room.players.filter(p =>
                    p.id !== winnerId && isInGreenZone(p.position)
                );

                if (otherGreenZonePlayers.length > 0) {
                    // Emit movement choice to winner
                    io.to(winnerId).emit("movementChoice", {
                        greenZonePlayers: otherGreenZonePlayers
                    });

                    // Emit round result first
                    room.players.forEach(player => {
                        io.to(player.id).emit("roundResult", {
                            cards: room.cardsPlayed,
                            winnerId: winnerId,
                            playerPositions: room.players
                        });
                    });
                    return; // Wait for movement choice
                }
            }*/
        }
    }

    // Continue with normal round end processing...
    // Emit round result
    room.players.forEach(player => {
        io.to(player.id).emit("roundResult", {
            cards: room.cardsPlayed,
            winnerId: winnerId,
            playerPositions: room.players
        });
    });

    // Check for game end
    const gameWinner = room.players.find(p => p.position >= 25);
    if (gameWinner) {
        room.players.forEach(player => {
            io.to(player.id).emit("gameWon", {
                winnerId: gameWinner.id,
                winnerName: gameWinner.name
            });
        });
        return;
    }

    // Check if anyone is out of cards
    const playersWithCards = room.players.filter(p => p.hand.length > 0);
    if (playersWithCards.length === 0) {
        // Need to deal new hands
        const hands = dealCardsFromDeck(room, 7);

        room.players.forEach(player => {
            player.hand = hands[player.id];
            io.to(player.id).emit("updateHand", player.hand);
        });

        room.players.forEach(player => {
            io.to(player.id).emit("newHandsDealt");
        });

        // Check if winner is on pick step AFTER new cards are dealt
        if (winnerId) {
            const winner = room.players.find(p => p.id === winnerId);
            if (winner && isOnPickStep(winner.position)) {
                const canAddSuit = room.suitRanking.length < 6;
                io.to(winnerId).emit("pickStep", {
                    position: winner.position,
                    canAddSuit: canAddSuit
                });
                return;
            }
        }
    } else {
        // Still have cards, check for pick step immediately
        if (winnerId) {
            const winner = room.players.find(p => p.id === winnerId);
            if (winner && isOnPickStep(winner.position)) {
                const canAddSuit = room.suitRanking.length < 6;
                io.to(winnerId).emit("pickStep", {
                    position: winner.position,
                    canAddSuit: canAddSuit
                });
                return;
            }
        }
    }

    // Start next round after delay
    setTimeout(() => {
        room.currentRound += 1;
        startRound(room);
    }, 3000);
}

io.on("connection", (socket) => {
    console.log(`[0] A user connected: ${socket.id}`);

    // Generate initial username and assign random color
    const animalNames = ['Fox', 'Wolf', 'Bear', 'Eagle', 'Lion', 'Tiger', 'Shark', 'Hawk'];
    const adjectives = ['Sharp', 'Swift', 'Bold', 'Fierce', 'Brave', 'Quick', 'Strong', 'Wild'];
    const colors = ['#000000', '#FF0000', '#0000FF', '#FFFF00', '#FFFFFF', '#008000'];

    const randomAnimal = animalNames[Math.floor(Math.random() * animalNames.length)];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNumber = Math.floor(Math.random() * 100);
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const initialUsername = `${randomAdjective}${randomAnimal}${randomNumber}`;

    players.set(socket.id, {
        id: socket.id,
        name: initialUsername,
        position: 0,
        hand: [],
        color: null,
        colorSelected: false
    });

    socket.emit("initialUsername", initialUsername);
    console.log(`[0] Sent initial username: ${initialUsername}`);

    // Handle username changes
    socket.on("changeUsername", (newUsername) => {
        console.log(`[0] Username change requested: ${newUsername} by: ${socket.id}`);
        const player = players.get(socket.id);
        if (player) {
            player.name = newUsername;
            players.set(socket.id, player);

            // Update all rooms this player is in
            for (const [roomId, room] of rooms.entries()) {
                if (room.players.some(p => p.id === socket.id)) {
                    const updatedPlayers = room.players.map(p =>
                        p.id === socket.id ? {...p, name: newUsername} : p
                    );
                    room.players = updatedPlayers;

                    // Emit to all players in this room
                    room.players.forEach(player => {
                        io.to(player.id).emit("updatePlayerList", updatedPlayers);
                    });
                }
            }
        }
    });

    // Update the room creation to include deck tracking
    socket.on("createLobby", () => {
        console.log(`[0] Create lobby requested by: ${socket.id}`);
        const roomId = generateRoomId();
        const player = players.get(socket.id);

        const playerWithColorStatus = {
            ...player,
            colorSelected: false
        };

        const room = {
            id: roomId,
            players: [player],
            gameState: 'waiting',
            suitRanking: [],
            currentRound: 0,
            cardsPlayed: [],
            leadSuit: null,
            turnOrder: [],
            currentTurnIndex: 0,
            currentPlayerId: null,
            lastRoundWinner: null,
            currentDeck: null,
            isNewShuffle: false
        };

        rooms.set(roomId, room);
        socket.emit("lobbyCreated", {lobbyId: roomId, players: room.players});
        console.log(`[0] Lobby created: ${roomId}`);
    });


    // Handle lobby joining
    socket.on("joinLobby", (lobbyId) => {
        console.log(`[0] Join lobby requested: ${lobbyId} by: ${socket.id}`);
        const room = rooms.get(parseInt(lobbyId));
        if (!room) {
            socket.emit("lobbyError", "Lobby not found");
            return;
        }

        if (room.gameState !== 'waiting') {
            socket.emit("lobbyError", "Game already in progress");
            return;
        }

        const player = players.get(socket.id);
        if (!room.players.find(p => p.id === socket.id)) {
            // Ensure player has colorSelected property
            const playerWithColorStatus = {
                ...player,
                colorSelected: false
            };
            room.players.push(playerWithColorStatus);
        }

        // Emit to all players in room
        room.players.forEach(player => {
            io.to(player.id).emit("lobbyJoined", {lobbyId: lobbyId, players: room.players});
        });
        console.log(`[0] Player joined lobby: ${lobbyId}`);
    });

    // Handle game start
    socket.on("startGame", () => {
        console.log(`[0] Start game requested by: ${socket.id}`);

        // Find the room this player is in
        let currentRoom = null;
        for (const [roomId, room] of rooms.entries()) {
            if (room.players.some(p => p.id === socket.id)) {
                currentRoom = room;
                break;
            }
        }

        if (!currentRoom || currentRoom.players.length < 2) {
            socket.emit("lobbyError", "Need at least 2 players to start");
            return;
        }

        // Randomize player order and assign table positions
        const shuffledPlayers = shuffle([...currentRoom.players]);
        shuffledPlayers.forEach((player, index) => {
            player.tablePosition = index; // Assign table positions 0-4
        });
        currentRoom.players = shuffledPlayers;

        // Start the game
        currentRoom.gameState = 'playing';
        currentRoom.currentRound = 1;
        currentRoom.currentDeck = null;

        // Deal initial hands
        const hands = dealCardsFromDeck(currentRoom, 7);

        // Update player hands
        currentRoom.players.forEach(player => {
            player.hand = hands[player.id];
            io.to(player.id).emit("updateHand", player.hand);
        });

        // Emit game start to all players
        currentRoom.players.forEach(player => {
            io.to(player.id).emit("gameStart", {
                suitRanking: currentRoom.suitRanking,
                players: currentRoom.players
            });
        });

        console.log(`[0] Game started in room: ${currentRoom.id}`);

        // Start the first round immediately
        setTimeout(() => {
            startRound(currentRoom);
        }, 1000);
    });

    socket.on("selectColor", (selectedColor) => {
        console.log(`\n[SERVER] ===== COLOR SELECTION START =====`);
        console.log(`[SERVER] Player ${socket.id} wants color: ${selectedColor}`);
        console.log(`[SERVER] Socket connected: ${socket.connected}`);

        // FIX: Use .get() for Map, not .find()
        const player = players.get(socket.id);
        console.log(`[SERVER] Found player:`, player);

        if (!player) {
            console.log(`[SERVER] ERROR: Player not found!`);
            socket.emit("colorError", "Player not found");
            return;
        }

        // FIX: Check if color is taken by iterating through Map values
        const colorTaken = Array.from(players.values()).some(p =>
            p.color === selectedColor && p.id !== socket.id
        );
        console.log(`[SERVER] Color ${selectedColor} taken by another player:`, colorTaken);

        if (colorTaken) {
            console.log(`[SERVER] Sending colorError: Color already taken`);
            socket.emit("colorError", "Color already taken");
            return;
        }

        // Update player color
        player.color = selectedColor;
        player.colorSelected = true;
        players.set(socket.id, player); // Update the Map

        console.log(`[SERVER] Updated player:`, player);
        console.log(`[SERVER] About to emit colorSelected event to ${socket.id}`);

        // Emit success
        socket.emit("colorSelected", selectedColor);
        console.log(`[SERVER] colorSelected event emitted`);

        // Update the room this player is in
        for (const [roomId, room] of rooms.entries()) {
            if (room.players.some(p => p.id === socket.id)) {
                // Update the player in the room's player list
                const roomPlayerIndex = room.players.findIndex(p => p.id === socket.id);
                if (roomPlayerIndex !== -1) {
                    room.players[roomPlayerIndex] = player;

                    // Broadcast updated player list to all players in this room
                    room.players.forEach(roomPlayer => {
                        io.to(roomPlayer.id).emit("lobbyJoined", {
                            lobbyId: roomId,
                            players: room.players
                        });
                    });
                }
                break;
            }
        }

        console.log(`[SERVER] ===== COLOR SELECTION END =====\n`);
    });



    // Handle card playing
    socket.on("playCard", ({card}) => {
        console.log(`[0] Player ${socket.id} attempting to play card:`, card);

        // Find the room this player is in
        let currentRoom = null;
        for (const [roomId, room] of rooms.entries()) {
            if (room.players.some(p => p.id === socket.id)) {
                currentRoom = room;
                break;
            }
        }

        if (!currentRoom || currentRoom.gameState !== 'playing') {
            console.log(`[0] No room found or game not in progress`);
            return;
        }

        // Check if it's this player's turn
        if (currentRoom.currentPlayerId !== socket.id) {
            console.log(`[0] Not player's turn`);
            return;
        }

        // Find the player
        const player = currentRoom.players.find(p => p.id === socket.id);
        if (!player) {
            console.log(`[0] Player not found in room`);
            return;
        }

        // Check if player can play this card (USING CORRECTED LOGIC)
        if (!canPlayCard(card, currentRoom.leadSuit, player.hand)) {
            console.log(`[0] Player cannot play this card - lead suit: ${currentRoom.leadSuit}`);
            return;
        }

        // Check if player has this card
        const cardIndex = player.hand.findIndex(c =>
            c.suit === card.suit && c.value === card.value
        );

        if (cardIndex === -1) {
            console.log(`[0] Player doesn't have this card`);
            return;
        }

        // Set lead suit if this is the first card
        if (currentRoom.cardsPlayed.length === 0 && card.suit !== 'joker') {
            currentRoom.leadSuit = card.suit;
        }

        // Remove card from player's hand
        player.hand.splice(cardIndex, 1);

        // Add to cards played this round
        currentRoom.cardsPlayed.push({
            playerId: socket.id,
            card: card
        });

        // Update player's hand
        io.to(socket.id).emit("updateHand", player.hand);

        // Emit card played to all players
        currentRoom.players.forEach(player => {
            io.to(player.id).emit("cardPlayed", {
                playerId: socket.id,
                card,
                leadSuit: currentRoom.leadSuit
            });
        });

        console.log(`[0] Card played successfully, moving to next turn`);

        // Move to next turn
        processNextTurn(currentRoom);
    });

    // Handle suit ranking updates
    socket.on("updateSuitRanking", ({action, suit, suit1, suit2}) => {
        // Find the room this player is in
        let currentRoom = null;
        for (const [roomId, room] of rooms.entries()) {
            if (room.players.some(p => p.id === socket.id)) {
                currentRoom = room;
                break;
            }
        }

        if (!currentRoom) return;

        if (action === 'add' && suit) {
            if (!currentRoom.suitRanking.includes(suit)) {
                currentRoom.suitRanking.unshift(suit);
            }
        } else if (action === 'swap' && suit1 && suit2) {
            const index1 = currentRoom.suitRanking.indexOf(suit1);
            const index2 = currentRoom.suitRanking.indexOf(suit2);
            if (index1 !== -1 && index2 !== -1) {
                [currentRoom.suitRanking[index1], currentRoom.suitRanking[index2]] =
                    [currentRoom.suitRanking[index2], currentRoom.suitRanking[index1]];
            }
        }

        // Emit updated ranking to all players
        currentRoom.players.forEach(player => {
            io.to(player.id).emit("suitRankingUpdated", currentRoom.suitRanking);
        });

        // Continue the game after pick step
        setTimeout(() => {
            // Check for game end
            const gameWinner = currentRoom.players.find(p => p.position >= 24);
            if (gameWinner) {
                currentRoom.players.forEach(player => {
                    io.to(player.id).emit("gameWon", {
                        winnerId: gameWinner.id,
                        winnerName: gameWinner.name
                    });
                });
                return;
            }

            // Check if anyone is out of cards
            const playersWithCards = currentRoom.players.filter(p => p.hand.length > 0);
            if (playersWithCards.length === 0) {
                // Deal new hands
                const playerIds = currentRoom.players.map(p => p.id);
                const hands = dealCards(playerIds, 7);

                currentRoom.players.forEach(player => {
                    player.hand = hands[player.id];
                    io.to(player.id).emit("updateHand", player.hand);
                });

                currentRoom.players.forEach(player => {
                    io.to(player.id).emit("newHandsDealt");
                });
            }

            // Start next round
            currentRoom.currentRound += 1;
            startRound(currentRoom);
        }, 1000);
    });

    // Movement choice handler
    socket.on("movementChoice", ({choice, targetPlayerId}) => {
        console.log(`[0] Movement choice: ${choice} by ${socket.id}, target: ${targetPlayerId}`);

        // Find the room this player is in
        let currentRoom = null;
        for (const [roomId, room] of rooms.entries()) {
            if (room.players.some(p => p.id === socket.id)) {
                currentRoom = room;
                break;
            }
        }

        if (!currentRoom) return;

        const movingPlayer = currentRoom.players.find(p => p.id === socket.id);
        if (!movingPlayer) return;

        if (choice === 'forward') {
            // Move the player forward one more space
            const newPosition = findNextAvailablePosition(movingPlayer.position, currentRoom.players, socket.id);
            movingPlayer.position = Math.min(newPosition, 25);
        } else if (choice === 'pullback' && targetPlayerId) {
            // Pull the target player back one space (but not below position 1)
            const targetPlayer = currentRoom.players.find(p => p.id === targetPlayerId);
            if (targetPlayer && targetPlayer.position > 1) {
                targetPlayer.position = Math.max(1, targetPlayer.position - 1);
            }
        }

        // Update all players with new positions
        currentRoom.players.forEach(player => {
            io.to(player.id).emit("updatePlayerList", currentRoom.players);
        });

        // Check if the moving player is now on a pick step
        if (isOnPickStep(movingPlayer.position)) {
            const canAddSuit = currentRoom.suitRanking.length < 6;
            io.to(socket.id).emit("pickStep", {
                position: movingPlayer.position,
                canAddSuit: canAddSuit
            });
            return; // Wait for pick step completion
        }

        // Continue with game flow
        continueAfterMovement(currentRoom);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log(`[0] A user disconnected: ${socket.id}`);
        players.delete(socket.id);

        // Remove from all rooms
        for (const [roomId, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);

                // If room is empty, delete it
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                    console.log(`[0] Room deleted: ${roomId}`);
                } else {
                    // Update remaining players
                    room.players.forEach(player => {
                        io.to(player.id).emit("updatePlayerList", room.players);
                    });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 1234;
server.listen(PORT, () => {
    console.log(`[0] Server running on port ${PORT}`);
});
