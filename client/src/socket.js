import {io} from "socket.io-client";

// Establish socket connection with the server
const socket = io("http://localhost:1234", {
    transports: ['websocket', 'polling']
});

export default socket;
