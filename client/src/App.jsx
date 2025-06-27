import React, {useEffect, useState} from "react";
import socket from "./socket";

function App() {
    const [gameState, setGameState] = useState('menu'); // 'menu', 'lobby', 'game'
    const [playerHand, setPlayerHand] = useState([]);
    const [gameLog, setGameLog] = useState([]);
    const [playerId, setPlayerId] = useState(null);
    const [username, setUsername] = useState("");
    const [tempUsername, setTempUsername] = useState("");
    const [players, setPlayers] = useState([]);
    const [lobbyId, setLobbyId] = useState("");
    const [joinLobbyId, setJoinLobbyId] = useState("");
    const [suitRanking, setSuitRanking] = useState([]);
    const [showPickStep, setShowPickStep] = useState(false);
    const [pickStepData, setPickStepData] = useState(null);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [validCards, setValidCards] = useState([]);
    const [leadSuit, setLeadSuit] = useState(null);
    const [turnOrder, setTurnOrder] = useState([]);
    const [cardsPlayedThisRound, setCardsPlayedThisRound] = useState([]);

    useEffect(() => {
        // Get initial username
        socket.on("initialUsername", (name) => {
            setUsername(name);
            setTempUsername(name);
        });

        // Handle lobby creation
        socket.on("lobbyCreated", ({lobbyId, players}) => {
            setLobbyId(lobbyId);
            setPlayers(players);
            setGameState('lobby');
        });

        // Handle lobby joining
        socket.on("lobbyJoined", ({lobbyId, players}) => {
            setLobbyId(lobbyId);
            setPlayers(players);
            setGameState('lobby');
        });

        // Handle lobby errors
        socket.on("lobbyError", (message) => {
            alert(message);
        });

        // Listen for updated player list
        socket.on("updatePlayerList", (playersWithData) => {
            setPlayers(playersWithData);
        });

        // Listen for game start
        socket.on("gameStart", (data) => {
            setGameState('game');
            setSuitRanking(data.suitRanking);
            setPlayers(data.players);
            setGameLog(prev => [...prev, "Game started!"]);
        });

        // Listen for round start
        socket.on("roundStart", (data) => {
            setIsMyTurn(data.isYourTurn);
            setCurrentPlayer(data.currentPlayer);
            setValidCards(data.validCards || []);
            setTurnOrder(data.turnOrder || []);
            setLeadSuit(null);
            setCardsPlayedThisRound([]); // Clear cards played for new round
            setGameLog(prev => [...prev, data.message]);
        });

        // Listen for turn updates
        socket.on("turnUpdate", (data) => {
            setIsMyTurn(data.isYourTurn);
            setCurrentPlayer(data.currentPlayer);
            setValidCards(data.validCards || []);
            setLeadSuit(data.leadSuit);
        });

        // Listen for hand updates
        socket.on("updateHand", (hand) => {
            setPlayerHand(hand);
            console.log("Hand updated:", hand);
        });

        // Handle pick steps
        socket.on("pickStep", (data) => {
            setPickStepData(data);
            setShowPickStep(true);
        });

        // Handle suit ranking updates
        socket.on("suitRankingUpdated", (ranking) => {
            setSuitRanking(ranking);
        });

        // Get the player ID when connected
        socket.on("connect", () => {
            setPlayerId(socket.id);
            console.log("Connected with ID:", socket.id);
        });

        // Handle new hands dealt
        socket.on("newHandsDealt", () => {
            setGameLog(prev => [...prev, "New hands dealt!"]);
        });

        // Handle game won
        socket.on("gameWon", ({winnerId, winnerName}) => {
            setGameLog(prev => [...prev, `🎉 ${winnerName} wins the game! 🎉`]);
            setIsMyTurn(false);
        });

        return () => {
            socket.off("initialUsername");
            socket.off("lobbyCreated");
            socket.off("lobbyJoined");
            socket.off("lobbyError");
            socket.off("updatePlayerList");
            socket.off("gameStart");
            socket.off("roundStart");
            socket.off("turnUpdate");
            socket.off("updateHand");
            socket.off("pickStep");
            socket.off("suitRankingUpdated");
            socket.off("connect");
            socket.off("newHandsDealt");
            socket.off("gameWon");
        };
    }, []);

    useEffect(() => {
        // Listen for card played events to update the game log and cards played
        socket.on("cardPlayed", ({playerId, card, leadSuit}) => {
            const player = players.find(p => p.id === playerId);
            const playerName = player ? player.name : playerId;

            // Add to cards played this round
            setCardsPlayedThisRound(prev => [...prev, {
                playerId,
                playerName,
                card,
                order: prev.length + 1
            }]);

            setGameLog((prevLog) => [
                ...prevLog,
                `${playerName} played ${card.suit} ${card.value || 'Joker'}`,
            ]);
            setLeadSuit(leadSuit);
        });

        // Handle round results
        socket.on("roundResult", ({cards, winnerId, playerPositions}) => {
            setIsMyTurn(false);

            const logs = [...gameLog];

            if (winnerId) {
                const winner = players.find(p => p.id === winnerId);
                const winnerName = winner ? winner.name : winnerId;
                logs.push(`🏆 ${winnerName} wins the round!`);
            } else {
                logs.push("The round is a tie!");
            }

            setGameLog(logs);
            setPlayers(playerPositions);

            // Keep cards visible for a moment before clearing
            setTimeout(() => {
                setCardsPlayedThisRound([]);
            }, 3000);
        });

        return () => {
            socket.off("cardPlayed");
            socket.off("roundResult");
        };
    }, [gameLog, players]);

    const createLobby = () => {
        socket.emit("createLobby");
    };

    const joinLobby = () => {
        if (joinLobbyId.length === 6) {
            socket.emit("joinLobby", joinLobbyId);
        } else {
            alert("Please enter a valid 6-digit lobby ID");
        }
    };

    const startGame = () => {
        socket.emit("startGame");
    };

    const saveUsername = () => {
        setUsername(tempUsername);
        socket.emit("changeUsername", tempUsername);
    };

    const playCard = (card) => {
        console.log("Attempting to play card:", card);
        console.log("Is my turn:", isMyTurn);

        if (!isMyTurn) {
            alert("It's not your turn!");
            return;
        }

        // Check if card is valid
        const isValidCard = validCards.some(c =>
            c.suit === card.suit && c.value === card.value
        );

        if (!isValidCard) {
            alert("You cannot play this card!");
            return;
        }

        socket.emit("playCard", {card});
    };

    const handleSuitRankingUpdate = (action, data) => {
        socket.emit("updateSuitRanking", {action, ...data});
        setShowPickStep(false);
    };

    // Helper function to determine suit following message
    const getSuitFollowingMessage = () => {
        if (!leadSuit || !isMyTurn) return "";

        const hasLeadSuit = playerHand.some(c => c.suit === leadSuit);

        if (hasLeadSuit) {
            return `You must follow suit (${leadSuit}) or play a joker`;
        } else {
            return `You don't have ${leadSuit} cards - you can play any card`;
        }
    };

    // Helper function to determine winning card - CORRECTED with joker timing
    const getWinningCard = () => {
        if (cardsPlayedThisRound.length === 0) return null;

        // Helper function to compare cards (matching server logic)
        const compareCards = (card1, card2, suitRanking, leadSuit, card1Index, card2Index) => {
            // Handle jokers - latest joker wins
            if (card1.suit === 'joker' && card2.suit === 'joker') {
                // Later played joker wins (higher index = played later)
                if (card2Index > card1Index) return -1; // card2 (later) wins
                if (card1Index > card2Index) return 1;  // card1 (later) wins
                return 0; // Same timing (shouldn't happen)
            }
            if (card1.suit === 'joker') return 1;
            if (card2.suit === 'joker') return -1;

            if (!leadSuit) {
                return compareCardsByRankingAndValue(card1, card2, suitRanking);
            }

            const card1FollowsLead = card1.suit === leadSuit;
            const card2FollowsLead = card2.suit === leadSuit;

            if (card1FollowsLead && card2FollowsLead) {
                if (card1.value > card2.value) return 1;
                if (card1.value < card2.value) return -1;
                return 0;
            }

            if (card1FollowsLead && !card2FollowsLead) {
                return canBeatLeadSuit(card2.suit, leadSuit, suitRanking) ? -1 : 1;
            }

            if (!card1FollowsLead && card2FollowsLead) {
                return canBeatLeadSuit(card1.suit, leadSuit, suitRanking) ? 1 : -1;
            }

            return compareCardsByRankingAndValue(card1, card2, suitRanking);
        };

        const canBeatLeadSuit = (suit, leadSuit, suitRanking) => {
            if (suitRanking.length === 0) return false;

            const suitIndex = suitRanking.indexOf(suit);
            const leadSuitIndex = suitRanking.indexOf(leadSuit);

            if (suitIndex === -1) return false;
            if (leadSuitIndex === -1) return true;

            return suitIndex < leadSuitIndex;
        };

        const compareCardsByRankingAndValue = (card1, card2, suitRanking) => {
            const suit1Index = suitRanking.indexOf(card1.suit);
            const suit2Index = suitRanking.indexOf(card2.suit);

            if (suit1Index !== -1 && suit2Index !== -1) {
                if (suit1Index < suit2Index) return 1;
                if (suit1Index > suit2Index) return -1;
                if (card1.value > card2.value) return 1;
                if (card1.value < card2.value) return -1;
                return 0;
            }

            if (suit1Index !== -1 && suit2Index === -1) return 1;
            if (suit1Index === -1 && suit2Index !== -1) return -1;

            if (card1.value > card2.value) return 1;
            if (card1.value < card2.value) return -1;
            return 0;
        };

        let winningCard = cardsPlayedThisRound[0];
        let winnerIndex = 0;

        for (let i = 1; i < cardsPlayedThisRound.length; i++) {
            const currentCard = cardsPlayedThisRound[i];
            // Pass indices for joker timing comparison
            if (compareCards(currentCard.card, winningCard.card, suitRanking, leadSuit, i, winnerIndex) > 0) {
                winningCard = currentCard;
                winnerIndex = i;
            }
        }

        return winningCard;
    };
    // Card Component
    const CardComponent = ({card, isFirst, isWinning, playerName, order}) => {
        const suitSymbols = {
            'spades': '♠',
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'stars': '⭐',
            'crowns': '👑',
            'joker': '🃏'
        };

        const suitColors = {
            'spades': '#000000',
            'hearts': '#FF0000',
            'diamonds': '#FF0000',
            'clubs': '#000000',
            'stars': '#FFD700',
            'crowns': '#800080',
            'joker': '#FF6B6B'
        };

        let borderColor = '#333';
        let backgroundColor = '#ffffff';
        let borderWidth = '2px';

        if (isFirst) {
            borderColor = '#007bff';
            backgroundColor = '#e3f2fd';
            borderWidth = '3px';
        }

        if (isWinning) {
            borderColor = '#28a745';
            backgroundColor = '#d4edda';
            borderWidth = '3px';
        }

        return (
            <div style={{
                width: '80px',
                height: '110px',
                border: `${borderWidth} solid ${borderColor}`,
                borderRadius: '8px',
                backgroundColor: backgroundColor,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '5px',
                position: 'relative',
                boxShadow: isWinning ? '0 0 10px rgba(40, 167, 69, 0.5)' :
                    isFirst ? '0 0 10px rgba(0, 123, 255, 0.5)' :
                        '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                {/* Order indicator */}
                <div style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '-8px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: isFirst ? '#007bff' : isWinning ? '#28a745' : '#6c757d',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold'
                }}>
                    {order}
                </div>

                {/* Suit symbol */}
                <div style={{
                    fontSize: '24px',
                    color: suitColors[card.suit],
                    marginBottom: '5px'
                }}>
                    {suitSymbols[card.suit]}
                </div>

                {/* Card value */}
                <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: suitColors[card.suit]
                }}>
                    {card.suit === 'joker' ? 'JOKER' : card.value}
                </div>

                {/* Player name */}
                <div style={{
                    position: 'absolute',
                    bottom: '-25px',
                    fontSize: '10px',
                    color: '#666',
                    textAlign: 'center',
                    width: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {playerName}
                </div>
            </div>
        );
    };

    // Cards Played This Round Component
    const CardsPlayedDisplay = () => {
        const winningCard = getWinningCard();

        return (
            <div style={{marginBottom: '20px'}}>
                <h3>Cards Played This Round</h3>
                <div style={{
                    border: '2px solid #333',
                    padding: '15px',
                    minHeight: '160px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px'
                }}>
                    {cardsPlayedThisRound.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            color: '#666',
                            fontStyle: 'italic',
                            paddingTop: '50px'
                        }}>
                            No cards played yet this round
                        </div>
                    ) : (
                        <div>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                alignItems: 'flex-start',
                                gap: '10px',
                                marginBottom: '30px'
                            }}>
                                {cardsPlayedThisRound.map((cardData, index) => (
                                    <CardComponent
                                        key={index}
                                        card={cardData.card}
                                        isFirst={index === 0}
                                        isWinning={winningCard && winningCard.playerId === cardData.playerId && winningCard.order === cardData.order}
                                        playerName={cardData.playerName}
                                        order={cardData.order}
                                    />
                                ))}
                            </div>

                            {/* Legend */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: '20px',
                                fontSize: '12px',
                                color: '#666'
                            }}>
                                <div style={{display: 'flex', alignItems: 'center'}}>
                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        border: '2px solid #007bff',
                                        marginRight: '5px',
                                        backgroundColor: '#e3f2fd'
                                    }}></div>
                                    First Card (Lead)
                                </div>
                                <div style={{display: 'flex', alignItems: 'center'}}>
                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        border: '2px solid #28a745',
                                        marginRight: '5px',
                                        backgroundColor: '#d4edda'
                                    }}></div>
                                    Currently Winning
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Game Board Component
    const GameBoard = () => {
        const boardSize = 24;
        const pickSteps = [3, 6, 9, 14, 19, 22];

        const renderBoardSquare = (position) => {
            const playersOnSquare = players.filter(p => p.position === position);
            const isPickStep = pickSteps.includes(position);

            return (
                <div
                    key={position}
                    style={{
                        width: '40px',
                        height: '40px',
                        border: '2px solid #333',
                        backgroundColor: isPickStep ? '#FFD700' : '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}
                >
                    {position}
                    {playersOnSquare.map((player, index) => (
                        <div
                            key={player.id}
                            style={{
                                position: 'absolute',
                                top: `${-5 + index * 8}px`,
                                right: `${-5 + index * 8}px`,
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: player.color,
                                border: '1px solid #000',
                                fontSize: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold'
                            }}
                            title={player.name}
                        >
                            {player.name.charAt(0)}
                        </div>
                    ))}
                </div>
            );
        };

        return (
            <div style={{marginBottom: '20px'}}>
                <h3>Game Board</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    gap: '2px',
                    maxWidth: '400px',
                    margin: '0 auto'
                }}>
                    {Array.from({length: boardSize}, (_, i) => renderBoardSquare(i + 1))}
                </div>
                <div style={{marginTop: '10px', fontSize: '12px'}}>
                    <span style={{color: '#FFD700'}}>■</span> Pick Steps (3, 6, 9, 14, 19, 22)
                    <br/>
                    <em>Players skip over occupied spaces when moving forward</em>
                </div>
            </div>
        );
    };

    // Suit Ranking Component
    const SuitRankingDisplay = () => {
        const allSuits = ['spades', 'hearts', 'diamonds', 'clubs', 'stars', 'crowns'];
        const suitSymbols = {
            'spades': '♠',
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'stars': '⭐',
            'crowns': '👑'
        };

        return (
            <div style={{marginBottom: '20px'}}>
                <h3>Suit Ranking (Highest to Lowest)</h3>
                <div style={{
                    border: '2px solid #333',
                    padding: '10px',
                    minHeight: '100px',
                    backgroundColor: '#f9f9f9'
                }}>
                    {suitRanking.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            color: '#666',
                            fontStyle: 'italic',
                            paddingTop: '30px'
                        }}>
                            No suit ranking yet - all suits are equal
                        </div>
                    ) : (
                        <ol style={{margin: 0, paddingLeft: '20px'}}>
                            {suitRanking.map((suit, index) => (
                                <li key={index} style={{
                                    fontSize: '18px',
                                    marginBottom: '5px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    <span style={{marginRight: '10px'}}>
                                        {suitSymbols[suit]} {suit}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>
        );
    };

    // Menu Screen
    if (gameState === 'menu') {
        return (
            <div style={{padding: '20px', textAlign: 'center'}}>
                <h1>VUMPETTI</h1>

                <div style={{marginBottom: '20px'}}>
                    <h3>Your Username:</h3>
                    <input
                        type="text"
                        value={tempUsername}
                        onChange={(e) => setTempUsername(e.target.value)}
                        style={{padding: '5px', marginRight: '10px'}}
                    />
                    <button onClick={saveUsername}>Save Username</button>
                </div>

                <div style={{marginBottom: '20px'}}>
                    <button onClick={createLobby} style={{padding: '10px 20px', margin: '10px'}}>
                        Create Lobby
                    </button>
                </div>

                <div>
                    <h3>Join Lobby:</h3>
                    <input
                        type="text"
                        placeholder="Enter 6-digit lobby ID"
                        value={joinLobbyId}
                        onChange={(e) => setJoinLobbyId(e.target.value)}
                        maxLength={6}
                        style={{padding: '5px', marginRight: '10px'}}
                    />
                    <button onClick={joinLobby}>Join Lobby</button>
                </div>
            </div>
        );
    }

    // Lobby Screen
    if (gameState === 'lobby') {
        return (
            <div style={{padding: '20px'}}>
                <h1>VUMPETTI - Lobby {lobbyId}</h1>

                <div style={{marginBottom: '20px'}}>
                    <h2>Players in Lobby:</h2>
                    <ul>
                        {players.map((player, index) => (
                            <li key={index} style={{display: 'flex', alignItems: 'center', marginBottom: '5px'}}>
                                <div
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        backgroundColor: player.color,
                                        marginRight: '10px',
                                        border: '1px solid #000'
                                    }}
                                ></div>
                                {player.name} {player.id === playerId && "(You)"}
                            </li>
                        ))}
                    </ul>
                </div>

                <button onClick={startGame} disabled={players.length < 2}>
                    Start Game {players.length < 2 && "(Need at least 2 players)"}
                </button>
            </div>
        );
    }

    // Game Screen
    return (
        <div style={{padding: '20px'}}>
            <h1>VUMPETTI - Game in Progress</h1>

            {/* Turn Status */}
            <div style={{
                marginBottom: '20px',
                padding: '15px',
                backgroundColor: isMyTurn ? '#d4edda' : '#f8d7da',
                border: '2px solid #333',
                borderRadius: '5px',
                textAlign: 'center'
            }}>
                <strong>
                    {isMyTurn ? "🎯 YOUR TURN - Play a card!" :
                        `⏳ Waiting for ${players.find(p => p.id === currentPlayer)?.name || 'player'}'s turn`}
                </strong>
                {leadSuit && (
                    <div style={{marginTop: '5px', fontSize: '14px'}}>
                        Lead suit: <strong>{leadSuit}</strong>
                        <br/>
                        <em>{getSuitFollowingMessage()}</em>
                    </div>
                )}
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                <div style={{width: '48%', minWidth: '300px'}}>
                    <GameBoard/>

                    <div style={{marginTop: '20px'}}>
                        <h3>Players & Positions:</h3>
                        <ul>
                            {players.map((player, index) => (
                                <li key={index} style={{display: 'flex', alignItems: 'center', marginBottom: '5px'}}>
                                    <div
                                        style={{
                                            width: '15px',
                                            height: '15px',
                                            borderRadius: '50%',
                                            backgroundColor: player.color,
                                            marginRight: '8px',
                                            border: '1px solid #000'
                                        }}
                                    ></div>
                                    {player.name}: Position {player.position}
                                    {player.id === playerId && " (You)"}
                                    {player.id === currentPlayer && " 🎯"}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* NEW: Cards Played This Round Section */}
                    <CardsPlayedDisplay/>
                </div>

                <div style={{width: '48%', minWidth: '300px'}}>
                    <SuitRankingDisplay/>

                    <div>
                        <h3>Your Hand ({playerHand.length} cards):</h3>
                        <div>
                            {playerHand.map((card, index) => {
                                const isValidCard = validCards.some(c =>
                                    c.suit === card.suit && c.value === card.value
                                );
                                const canPlay = isMyTurn && isValidCard;

                                return (
                                    <button
                                        key={index}
                                        onClick={() => playCard(card)}
                                        disabled={!canPlay}
                                        style={{
                                            display: 'block',
                                            margin: '5px 0',
                                            padding: '8px 12px',
                                            width: '100%',
                                            backgroundColor: canPlay ? '#28a745' :
                                                isMyTurn ? '#ffc107' : '#6c757d',
                                            color: canPlay ? 'white' :
                                                isMyTurn ? 'black' : 'white',
                                            border: canPlay ? '2px solid #1e7e34' :
                                                isMyTurn ? '2px solid #e0a800' : 'none',
                                            cursor: canPlay ? 'pointer' : 'not-allowed',
                                            borderRadius: '4px',
                                            fontWeight: canPlay ? 'bold' : 'normal'
                                        }}
                                    >
                                        {card.suit === 'joker' ? '🃏 Joker' :
                                            `${card.suit} ${card.value}`}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{marginTop: '20px'}}>
                <h3>Game Log:</h3>
                <div style={{
                    height: '200px',
                    overflowY: 'scroll',
                    border: '1px solid #ccc',
                    padding: '10px',
                    backgroundColor: '#f9f9f9'
                }}>
                    {gameLog.map((entry, index) => (
                        <div key={index} style={{marginBottom: '2px'}}>{entry}</div>
                    ))}
                </div>
            </div>

            {/* Pick Step Modal */}
            {showPickStep && pickStepData && (
                <div style={{
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        border: '3px solid #333',
                        borderRadius: '10px',
                        padding: '30px',
                        maxWidth: '500px',
                        textAlign: 'center'
                    }}>
                        <h2>🎯 Pick Step - Position {pickStepData.position}</h2>

                        {pickStepData.canAddSuit ? (
                            <div>
                                <p><strong>Choose a suit to add to the TOP of the ranking:</strong></p>
                                <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px'}}>
                                    {['spades', 'hearts', 'diamonds', 'clubs', 'stars', 'crowns']
                                        .filter(suit => !suitRanking.includes(suit))
                                        .map(suit => (
                                            <button
                                                key={suit}
                                                onClick={() => handleSuitRankingUpdate('add', {suit})}
                                                style={{
                                                    margin: '5px',
                                                    padding: '15px 20px',
                                                    fontSize: '16px',
                                                    backgroundColor: '#007bff',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '5px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {suit}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p><strong>Choose two suits to swap positions:</strong></p>
                                <div style={{marginBottom: '20px'}}>
                                    <select id="suit1" style={{padding: '10px', margin: '5px', fontSize: '16px'}}>
                                        {suitRanking.map(suit => (
                                            <option key={suit} value={suit}>{suit}</option>
                                        ))}
                                    </select>
                                    <span style={{margin: '0 10px'}}>↔</span>
                                    <select id="suit2" style={{padding: '10px', margin: '5px', fontSize: '16px'}}>
                                        {suitRanking.map(suit => (
                                            <option key={suit} value={suit}>{suit}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={() => {
                                        const suit1 = document.getElementById('suit1').value;
                                        const suit2 = document.getElementById('suit2').value;
                                        handleSuitRankingUpdate('swap', {suit1, suit2});
                                    }}
                                    style={{
                                        padding: '15px 30px',
                                        fontSize: '16px',
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Swap Suits
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
