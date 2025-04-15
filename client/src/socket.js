import { io } from "socket.io-client";

// Establish socket connection with the server
const socket = io("http://localhost:5000");

// Socket event handlers
socket.on("connect", () => {
  console.log("Connected to the server");
});

socket.on("gameStart", (data) => {
  console.log("Game started:", data);
});

socket.on("cardPlayed", (data) => {
  console.log("Card played:", data);
});

export default socket;
