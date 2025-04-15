const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { createDeck, shuffleDeck } = require("./gameLogic");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

let rooms = {}; // Store room data

// Helper function to get player names from the room
const getPlayerNames = (roomId) => {
  const room = rooms[roomId];
  return room ? room.players.map(player => player.name) : [];
};

function compareCards(play1, play2, suitRanking) {
  const { card: card1 } = play1;
  const { card: card2 } = play2;

  const rank1 = suitRanking.indexOf(card1.suit);
  const rank2 = suitRanking.indexOf(card2.suit);

  if (rank1 < rank2) return play1.playerId;
  if (rank2 < rank1) return play2.playerId;

  if (card1.value > card2.value) return play1.playerId;
  if (card2.value > card1.value) return play2.playerId;

  return null;
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  let playerName = `Player-${socket.id}`;  // Default player name
  socket.emit("requestUsername"); // Ask user for username when they connect

  // Handle username input
  socket.on("setUsername", (name) => {
    playerName = name;

    const roomId = "room1"; // Set this to the actual roomId you're using
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };  // Initialize room if it doesn't exist
    }

    // Store the player in the room with playerId and name
    rooms[roomId].players.push({ id: socket.id, name: playerName });
    
    // Emit updated player list after new player joins
    io.to(roomId).emit("updatePlayerList", getPlayerNames(roomId));
  });

  // Always create and deal a fresh hand on connection
  const deck = shuffleDeck(createDeck());
  const hand = deck.slice(0, 7); // Deal 7 cards

  // Assign the hand and send the game start message
  socket.emit("gameStart", {
    hand,
    suitRanking: ["hearts", "spades", "diamonds", "clubs", "stars", "crowns"],
  });

  // Create a game room and store players
  let roomId = "room1"; // Example static room id, adjust as needed
  if (!rooms[roomId]) {
    rooms[roomId] = {
      players: [{ id: socket.id, name: playerName }], // Store player name with socket id
      currentRound: {
        cards: [], // Cards played during the round
        turn: 0, // Track whose turn it is
      },
      suitRanking: ["hearts", "spades", "diamonds", "clubs", "stars", "crowns"],
    };
  } else {
    rooms[roomId].players.push({ id: socket.id, name: playerName }); // Add player to room
  }

  socket.join(roomId); // Join the room

  // Emit updated player list to all players in the room
  io.to(roomId).emit("updatePlayerList", getPlayerNames(roomId));

    // Handle card played by a player
    socket.on("playCard", ({ card }) => {
        const room = rooms[roomId];
        if (!room) return;

        // Prevent players from playing if they've already played
        if (room.currentRound.cards.some(play => play.playerId === socket.id)) {
        return; // Player has already played in this round
        }

        room.currentRound.cards.push({ playerId: socket.id, card });
        io.to(roomId).emit("cardPlayed", { playerId: socket.id, card });

        // If both players have played their cards, determine the winner
        if (room.currentRound.cards.length === room.players.length) {
        const [play1, play2] = room.currentRound.cards;
        const winner = compareCards(play1, play2, room.suitRanking);

        // Notify all players of the result
        io.to(roomId).emit("roundResult", {
            cards: room.currentRound.cards,
            winnerId: winner,
        });

        // Reset the round
        room.currentRound.cards = []; // Clear the played cards for the next round
        room.currentRound.turn = (room.currentRound.turn + 1) % room.players.length; // Set the next player’s turn
        }
    });

    // Kick player
    socket.on("kickPlayer", (targetPlayerId) => {
        const roomId = "room1"; // Replace with your actual room ID logic
    
        const room = rooms[roomId];
        console.log("KICK PLAYER: " + targetPlayerId);
        console.log(room);
        
        if (!room) return; // If the room doesn't exist, return
        
        // Find the target player in the room using their socket id
        const targetPlayer = room.players.find(player => player.id === targetPlayerId);
        if (targetPlayer) {
            // Remove player from the room
            room.players = room.players.filter(player => player.id !== targetPlayerId);
            
            // Emit updated player list to all players
            io.to(roomId).emit("updatePlayerList", getPlayerNames(roomId));
    
            // Send a message to the player who was kicked
            io.to(targetPlayerId).emit("playerKicked", { message: "You have been disconnected from the game!" });
    
            // Disconnect the player
            io.sockets.sockets.get(targetPlayerId)?.disconnect();
        }
    });

    // Handle username input
    socket.on("setUsername", (name) => {
        playerName = name;
    
        const roomId = "room1"; // Replace with your actual room ID logic
    
        if (!rooms[roomId]) {
            rooms[roomId] = { players: [] };  // Initialize room if it doesn't exist
        }
    
        // Ensure the player has a unique ID and store their name
        rooms[roomId].players.push({ id: socket.id, name: playerName });  // Store player name and id
    
        // Emit the updated player list with names
        io.to(roomId).emit("updatePlayerList", getPlayerNames(roomId));
    });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("Server is running on port 5000");
});
