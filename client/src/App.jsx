import React, { useEffect, useState } from "react";
import socket from "./socket";

function App() {
  const [playerHand, setPlayerHand] = useState([]);
  const [gameLog, setGameLog] = useState([]);
  const [playerId, setPlayerId] = useState(null);
  const [username, setUsername] = useState("");
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    // Request username on game start
    socket.on("requestUsername", () => {
      const name = prompt("Please enter your username:");
      setUsername(name);  // Store the username in the state
      socket.emit("setUsername", name);  // Send username to server
    });

    // Listen for updated player list
    socket.on("updatePlayerList", (playersWithNames) => {
      setPlayers(playersWithNames);
    });

    // Listen for game start to update the hand
    socket.on("gameStart", (data) => {
      setPlayerHand(data.hand); // Assuming hand is sent from the server
    });

    return () => {
      socket.off("requestUsername");
      socket.off("updatePlayerList");
      socket.off("gameStart");
    };
  }, []);

  useEffect(() => {
    // Listen for game start to update the hand
    socket.on("gameStart", (data) => {
      setPlayerHand(data.hand); // Assuming hand is sent from the server
    });

    // Get the player ID when connected
    socket.on("connect", () => {
      setPlayerId(socket.id); // Save current socket ID
    });

    return () => {
      socket.off("gameStart");
      socket.off("connect");
    };
  }, []);

  const playCard = (card) => {
    socket.emit("playCard", { card });
  };

  useEffect(() => {
    // Listen for card played events to update the game log
    socket.on("cardPlayed", ({ playerId, card }) => {
      setGameLog((prevLog) => [
        ...prevLog,
        `Player ${playerId} played ${card.suit} ${card.value}`,
      ]);
    });

    // Handle round results
    socket.on("roundResult", ({ cards, winnerId }) => {
      const logs = [...gameLog];

      cards.forEach(({ playerId, card }) => {
        logs.push(`Player ${playerId} played ${card.suit} ${card.value}`);
      });

      if (winnerId) {
        logs.push(`Player ${winnerId} wins the round!`);
      } else {
        logs.push("The round is a tie!");
      }

      if (winnerId === playerId) {
        logs.push("New round begins, your turn.");
      } else {
        logs.push("New round begins, await your turn.");
      }

      setGameLog(logs);
    });

    return () => {
      socket.off("cardPlayed");
      socket.off("roundResult");
    };
  }, [gameLog, playerId]);

  const kickPlayer = (player) => {
    socket.emit("kickPlayer", player);
  };

  return (
    <div>
      <h1>VUMPETTI</h1>
      <div>
        <h2>Players:</h2>
        <ul>
          {players.map((player, index) => (
            <li key={index}>
              {player}
              <button onClick={() => kickPlayer(player)}>Kick</button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Your Hand:</h2>
        <ul>
          {playerHand.map((card, index) => (
            <li key={index}>
              {card.suit} {card.value}
              <button onClick={() => playCard(card)}>Play</button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Game Log:</h2>
        <ul>
          {gameLog.map((entry, index) => (
            <li key={index}>{entry}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
