const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  name: { type: String, required: true },
  hand: [{ suit: String, value: Number }],
  boardPosition: { type: Number, default: 0 },
});

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  players: [playerSchema],
  deck: [{ suit: String, value: Number }],
  suitRanking: [String],
  currentTurn: { type: Number, default: 0 },
  currentRound: {
    cards: []
  }
});

const Player = mongoose.model("Player", playerSchema);
const Room = mongoose.model("Room", roomSchema);

module.exports = { Player, Room };
