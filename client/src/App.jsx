import React, {useEffect, useState} from "react";
import socket from "./socket";

function App() {
    const [gameState, setGameState] = useState('menu');
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
    const [showMovementChoice, setShowMovementChoice] = useState(false);
    const [movementChoiceData, setMovementChoiceData] = useState(null);
    const [availableColors] = useState(['#000000', '#FF0000', '#0000FF', '#FFFF00', '#FFFFFF', '#008000']);
    const [showColorSelection, setShowColorSelection] = useState(false);
    const [selectedColor, setSelectedColor] = useState(null);
    const [gameWinner, setGameWinner] = useState(null);

    useEffect(() => {
        socket.on("connect", () => {
            setPlayerId(socket.id);
            console.log("Connected with ID:", socket.id);
        });

        socket.on("initialUsername", (name) => {
            setUsername(name);
            setTempUsername(name);
        });

        socket.on("lobbyCreated", ({lobbyId, players}) => {
            setLobbyId(lobbyId);
            setPlayers(players);
            setGameState('lobby');
            const currentPlayer = players.find(p => p.id === socket.id);
            if (currentPlayer && !currentPlayer.colorSelected) {
                setShowColorSelection(true);
            }
        });

        socket.on("lobbyJoined", ({lobbyId, players}) => {
            setLobbyId(lobbyId);
            setPlayers(players);
            setGameState('lobby');
            const currentPlayer = players.find(p => p.id === socket.id);
            if (currentPlayer && !currentPlayer.colorSelected) {
                setShowColorSelection(true);
            }
        });

        socket.on("lobbyError", (message) => {
            alert(message);
        });

        socket.on("updatePlayerList", (playersWithData) => {
            console.log("Received updated player list:", playersWithData);
            setPlayers(playersWithData);
            const currentPlayer = playersWithData.find(p => p.id === socket.id);
            console.log("Current player after update:", currentPlayer);
            if (currentPlayer && !currentPlayer.colorSelected && gameState === 'lobby') {
                console.log("Player still needs to select color, keeping modal open");
                setShowColorSelection(true);
            } else if (currentPlayer && currentPlayer.colorSelected) {
                console.log("Player has selected color, closing modal");
                setShowColorSelection(false);
            }
        });

        socket.on("gameStart", (data) => {
            setGameState('game');
            setSuitRanking(data.suitRanking);
            setPlayers(data.players);
            setGameLog(prev => [...prev, "Game started!"]);
        });

        socket.on("roundStart", (data) => {
            setIsMyTurn(data.isYourTurn);
            setCurrentPlayer(data.currentPlayer);
            setValidCards(data.validCards || []);
            setTurnOrder(data.turnOrder || []);
            setLeadSuit(null);
            setCardsPlayedThisRound([]);
            setGameLog(prev => [...prev, data.message]);
        });

        socket.on("turnUpdate", (data) => {
            console.log("Turn update received:", data); // Debug
            console.log("Current players:", players); // Debug
            setIsMyTurn(data.isYourTurn);
            setCurrentPlayer(data.currentPlayer);
            setValidCards(data.validCards || []);
            setLeadSuit(data.leadSuit);
        });

        socket.on("updateHand", (hand) => {
            const sortedHand = sortHandBySuit(hand);
            setPlayerHand(hand);
            console.log("Hand updated:", hand);
        });

        socket.on("pickStep", (data) => {
            setPickStepData(data);
            setShowPickStep(true);
        });

        socket.on("movementChoice", (data) => {
            setMovementChoiceData(data);
            setShowMovementChoice(true);
        });

        socket.on("suitRankingUpdated", (ranking) => {
            setSuitRanking(ranking);
        });

        socket.on("newHandsDealt", () => {
            setGameLog(prev => [...prev, "New hands dealt!"]);
        });

        socket.on("gameWon", ({winnerId, winnerName}) => {
            setGameLog(prev => [...prev, `🎉 ${winnerName} wins the game! 🎉`]);
            setIsMyTurn(false);
            setGameWinner(winnerName);
        });

        socket.on("colorSelected", (color) => {
            console.log("🎉 [CLIENT] colorSelected event received:", color);
            setSelectedColor(color);
            setShowColorSelection(false);
        });

        socket.on("colorError", (message) => {
            console.log("❌ [CLIENT] colorError event received:", message);
            alert(message);
        });

        socket.onAny((eventName, ...args) => {
            console.log(`[CLIENT] Received event: ${eventName}`, args);
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
            socket.off("movementChoice");
            socket.off("suitRankingUpdated");
            socket.off("connect");
            socket.off("newHandsDealt");
            socket.off("gameWon");
            socket.off("colorSelected");
            socket.off("colorError");
        };
    }, []);

    useEffect(() => {
        socket.on("cardPlayed", ({playerId, card, leadSuit}) => {
            const player = players.find(p => p.id === playerId);
            const playerName = player ? player.name : playerId;

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
            setTimeout(() => {
                setCardsPlayedThisRound([]);
            }, 3000);
        });

        return () => {
            socket.off("cardPlayed");
            socket.off("roundResult");
        };
    }, [gameLog, players]);

    const selectColor = (color) => {
        console.log("Selecting color:", color);
        socket.emit("selectColor", color);
    };

    const ColorSelectionModal = () => {
        if (!showColorSelection) return null;
        const takenColors = players.map(p => p.color).filter(Boolean);
        const availableColorsFiltered = availableColors.filter(color => !takenColors.includes(color));

        return (
            <div style={{
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}>
                <div style={{
                    background: 'white',
                    border: '3px solid #333',
                    borderRadius: '15px',
                    padding: '30px',
                    maxWidth: '500px',
                    textAlign: 'center',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }}>
                    <h2 style={{marginBottom: '20px', color: '#333'}}>🎨 Choose Your Color</h2>
                    <p style={{marginBottom: '25px', color: '#666'}}>
                        Select a color to represent you in the game.
                    </p>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '15px',
                        marginBottom: '20px'
                    }}>
                        {availableColorsFiltered.map(color => (
                            <button
                                key={color}
                                onClick={() => selectColor(color)}
                                style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    backgroundColor: color,
                                    border: '3px solid #333',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.transform = 'scale(1)';
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    };

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
        if (!isMyTurn) {
            alert("It's not your turn!");
            return;
        }
        const isValidCard = validCards.some(c =>
            c.suit === card.suit && c.value === card.value
        );
        if (!isValidCard) {
            alert("You cannot play this card!");
            return;
        }
        socket.emit("playCard", {card});
    };


    const sortHandBySuit = (hand) => {
        const suitOrder = ['spades', 'hearts', 'diamonds', 'clubs', 'stars', 'crowns', 'joker'];

        return [...hand].sort((a, b) => {
            // First sort by suit
            const suitCompare = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
            if (suitCompare !== 0) return suitCompare;

            // Then by value within same suit
            if (a.value === null) return 1; // Jokers last
            if (b.value === null) return -1;
            return a.value - b.value;
        });
    };

    const handleSuitRankingUpdate = (action, data) => {
        socket.emit("updateSuitRanking", {action, ...data});
        setShowPickStep(false);
    };

    const handleMovementChoice = (choice, targetPlayerId = null) => {
        socket.emit("movementChoice", {choice, targetPlayerId});
        setShowMovementChoice(false);
    };

    // Helper function to get relative player positions for game screen
    const getRelativePlayerPositions = () => {
        if (!playerId || players.length === 0) return [];
        const myIndex = players.findIndex(p => p.id === playerId);
        if (myIndex === -1) return [];

        const positions = [];
        const totalPlayers = players.length;

        // Position layouts - all in corners, away from game board
        const positionLayouts = {
            2: [
                {top: '20px', left: '20px'}, // Top left
            ],
            3: [
                {top: '20px', left: '20px'}, // Top left
                {top: '20px', right: '20px'}, // Top right
            ],
            4: [
                {top: '20px', left: '20px'}, // Top left
                {top: '20px', right: '20px'}, // Top right
                {bottom: '220px', left: '20px'}, // Bottom left
            ],
            5: [
                {top: '20px', left: '20px'}, // Top left
                {top: '20px', right: '20px'}, // Top right
                {bottom: '220px', left: '20px'}, // Bottom left
                {bottom: '220px', right: '20px'}, // Bottom right
            ]
        };

        const layout = positionLayouts[totalPlayers] || positionLayouts[5];

        for (let i = 1; i < totalPlayers; i++) {
            const playerIndex = (myIndex + i) % totalPlayers;
            positions.push({
                player: players[playerIndex],
                position: layout[i - 1]
            });
        }

        return positions;
    };

    // Card Component for game screen
    const CardComponent = ({card, size = 'large', isClickable = false, onClick, isInHand = false}) => {
        const suitSymbols = {
            'spades': '♠', 'hearts': '♥', 'diamonds': '♦', 'clubs': '♣',
            'stars': '⭐', 'crowns': '👑', 'joker': '🃏'
        };
        const suitColors = {
            'spades': '#000000', 'hearts': '#FF0000', 'diamonds': '#FF0000',
            'clubs': '#000000', 'stars': '#FFD700', 'crowns': '#800080', 'joker': '#FF6B6B'
        };
        const sizes = {
            small: {width: '60px', height: '85px', fontSize: '14px'},
            medium: {width: '100px', height: '140px', fontSize: '18px'},
            large: {width: '120px', height: '170px', fontSize: '22px'}
        };

        const isValidCard = isClickable && validCards.some(c =>
            c.suit === card.suit && c.value === card.value
        );

        return (
            <div
                style={{
                    ...sizes[size],
                    border: '3px solid #333',
                    borderRadius: '12px',
                    backgroundColor: isValidCard ? '#ffffff' : '#f0f0f0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: isInHand ? '0 -15px' : '5px',
                    position: 'relative',
                    cursor: isValidCard ? 'pointer' : 'default',
                    boxShadow: isValidCard ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 6px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s ease',
                    opacity: isValidCard || !isClickable ? 1 : 0.5,
                    zIndex: isInHand ? 1 : 'auto'
                }}
                onClick={isValidCard ? onClick : undefined}
                onMouseEnter={isValidCard ? (e) => {
                    e.currentTarget.style.transform = 'translateY(-20px) scale(1.05)';
                    e.currentTarget.style.zIndex = '10';
                } : undefined}
                onMouseLeave={isValidCard ? (e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.zIndex = isInHand ? '1' : 'auto';
                } : undefined}
            >
                <div style={{
                    fontSize: size === 'large' ? '48px' : size === 'medium' ? '36px' : '24px',
                    color: suitColors[card.suit],
                    marginBottom: '8px'
                }}>
                    {suitSymbols[card.suit]}
                </div>
                <div style={{
                    fontSize: sizes[size].fontSize,
                    fontWeight: 'bold',
                    color: suitColors[card.suit]
                }}>
                    {card.suit === 'joker' ? 'JOKER' : card.value}
                </div>
            </div>
        );
    };

    // Game Board Component - NEW RECTANGULAR DESIGN
    const GameBoardWithPath = () => {
        const suitSymbols = {
            'spades': '♠', 'hearts': '♥', 'diamonds': '♦',
            'clubs': '♣', 'stars': '⭐', 'crowns': '👑'
        };
        const suitColors = {
            'spades': '#000000', 'hearts': '#FF0000', 'diamonds': '#FF0000',
            'clubs': '#000000', 'stars': '#FFD700', 'crowns': '#800080'
        };

        const getPathPositions = () => {
            const positions = [];
            const slotWidth = 80;
            const slotHeight = 60;

            // START position (position 0)
            positions.push({
                x: 0,
                y: 620,
                position: 0,
                width: slotWidth,
                height: slotHeight,
                isStart: true
            });

            // Left side going up (positions 1-9)
            for (let i = 0; i < 9; i++) {
                positions.push({
                    x: 0,
                    y: 560 - (i * slotHeight),
                    position: i + 1,
                    width: slotWidth,
                    height: slotHeight
                });
            }

            // Top side going right (positions 10-15)
            for (let i = 0; i < 6; i++) {
                positions.push({
                    x: slotWidth + (i * slotWidth),
                    y: 80,
                    position: i + 10,
                    width: slotWidth,
                    height: slotHeight
                });
            }

            // Right side going down (positions 16-24)
            for (let i = 0; i < 9; i++) {
                positions.push({
                    x: slotWidth * 6,
                    y: 80 + slotHeight + (i * slotHeight),
                    position: i + 16,
                    width: slotWidth,
                    height: slotHeight
                });
            }

            // FINISH position (position 25)
            positions.push({
                x: slotWidth * 6,
                y: 680,
                position: 25,
                width: slotWidth,
                height: slotHeight,
                isFinish: true
            });

            return positions;
        };

        const pathPositions = getPathPositions();
        const pickSteps = [3, 6, 9, 14, 19, 22];
        const greenZone = [19, 20, 21, 22, 23, 24, 25];

        // Calculate zig-zag positions for suits
        const getSuitZigZagPosition = (index) => {
            const baseY = 100;
            const verticalSpacing = 90;
            const horizontalOffset = 60;

            // Zig-zag pattern: left, right, left, right, left, right
            const isLeft = index % 2 === 0;
            const row = index;

            return {
                x: isLeft ? horizontalOffset : 380 - horizontalOffset - 100,
                y: baseY + (row * verticalSpacing)
            };
        };

        return (
            <div style={{
                position: 'relative',
                width: '560px',
                height: '880px',
                margin: '0 auto'
            }}>
                {/* Central rectangle for suit ranking - UPDATED STYLE */}
                <div style={{
                    position: 'absolute',
                    left: '90px',
                    top: '150px',
                    width: '380px',
                    height: '600px',
                    border: '4px solid #333',
                    backgroundColor: '#D2B48C', // Light brown
                    padding: '30px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
                }}>
                    {/* Game Title */}
                    <h1 style={{
                        margin: '0 0 40px 0',
                        textAlign: 'center',
                        fontSize: '48px',
                        fontWeight: 'bold',
                        color: '#333',
                        fontFamily: 'Georgia, serif',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
                    }}>
                        VUMPETTI
                    </h1>

                    {/* Suit Ranking in Zig-Zag */}
                    <div style={{position: 'relative', height: '450px'}}>
                        {suitRanking.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                color: '#666',
                                fontStyle: 'italic',
                                paddingTop: '150px',
                                fontSize: '18px'
                            }}>
                                No ranking yet<br/>All suits equal
                            </div>
                        ) : (
                            suitRanking.map((suit, index) => {
                                const pos = getSuitZigZagPosition(index);
                                return (
                                    <div
                                        key={index}
                                        style={{
                                            position: 'absolute',
                                            left: `${pos.x}px`,
                                            top: `${pos.y}px`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '15px'
                                        }}
                                    >
                                        {/* Rank number */}
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            backgroundColor: '#333',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '20px',
                                            fontWeight: 'bold',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                        }}>
                                            {index + 1}
                                        </div>

                                        {/* Suit symbol and name */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                            padding: '8px 15px',
                                            borderRadius: '8px',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }}>
                                        <span style={{
                                            fontSize: '32px',
                                            color: suitColors[suit]
                                        }}>
                                            {suitSymbols[suit]}
                                        </span>
                                            <span style={{
                                                fontSize: '20px',
                                                fontWeight: 'bold',
                                                color: suitColors[suit],
                                                textTransform: 'capitalize'
                                            }}>
                                            {suit}
                                        </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Path positions - rectangular slots */}
                {pathPositions.map((pos) => {
                    const playersOnSquare = players.filter(p => p.position === pos.position);
                    const isPickStep = pickSteps.includes(pos.position);
                    const isGreenZone = greenZone.includes(pos.position);

                    let backgroundColor = '#fff';
                    let label = pos.position.toString();

                    if (pos.isStart) {
                        backgroundColor = '#4CAF50';
                        label = 'START';
                    } else if (pos.isFinish) {
                        backgroundColor = '#007fff';
                        label = 'FINISH';
                    } else if (isGreenZone) {
                        backgroundColor = isPickStep ? '#FFD700' : '#90EE90';
                    } else if (isPickStep) {
                        backgroundColor = '#FFD700';
                    }

                    return (
                        <div
                            key={pos.position}
                            style={{
                                position: 'absolute',
                                left: `${pos.x}px`,
                                top: `${pos.y}px`,
                                width: `${pos.width}px`,
                                height: `${pos.height}px`,
                                border: '3px solid #333',
                                backgroundColor: backgroundColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: pos.isStart || pos.isFinish ? '12px' : '18px',
                                fontWeight: 'bold',
                                boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
                                color: (pos.isStart || pos.isFinish) ? 'white' : '#333'
                            }}
                        >
                            {label}
                            {playersOnSquare.map((player, index) => (
                                <div
                                    key={player.id}
                                    style={{
                                        position: 'absolute',
                                        top: `${5 + index * 15}px`,
                                        right: `${5 + index * 15}px`,
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '50%',
                                        backgroundColor: player.color,
                                        border: '2px solid #000',
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                                    }}
                                    title={player.name}
                                >
                                    {player.name.charAt(0)}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        );
    };

    const MovementChoiceModal = () => {
        if (!showMovementChoice || !movementChoiceData) return null;

        return (
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
                    <h2>🎯 Green Zone Choice</h2>
                    <p>You landed in the green zone! Choose your action:</p>

                    <button
                        onClick={() => handleMovementChoice('forward')}
                        style={{
                            padding: '15px 30px',
                            fontSize: '16px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            margin: '10px',
                            display: 'block',
                            width: '100%'
                        }}
                    >
                        Move Forward Yourself
                    </button>

                    {movementChoiceData.greenZonePlayers && movementChoiceData.greenZonePlayers.length > 0 && (
                        <div>
                            <p style={{margin: '20px 0 10px 0', fontSize: '14px', color: '#666'}}>
                                Or pull someone back one space:
                            </p>
                            {movementChoiceData.greenZonePlayers.map(player => (
                                <button
                                    key={player.id}
                                    onClick={() => handleMovementChoice('pullback', player.id)}
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '14px',
                                        backgroundColor: '#dc3545',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        margin: '5px',
                                        display: 'block',
                                        width: '100%'
                                    }}
                                >
                                    Pull {player.name} back (from position {player.position})
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // MENU SCREEN - UNCHANGED
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

    // LOBBY SCREEN - UNCHANGED
    if (gameState === 'lobby') {
        return (
            <div style={{padding: '20px'}}>
                <h1>VUMPETTI - Lobby {lobbyId}</h1>
                <div style={{marginBottom: '20px'}}>
                    <h2>Players in Lobby:</h2>
                    <ul style={{listStyle: 'none', padding: 0}}>
                        {players.map((player) => (
                            <li key={player.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                                padding: '10px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '8px',
                                border: '1px solid #dee2e6'
                            }}>
                                <div style={{
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '50%',
                                    backgroundColor: player.color || '#ccc',
                                    marginRight: '15px',
                                    border: '2px solid #000',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    color: player.color ? 'white' : '#666'
                                }}>
                                    {!player.color && '?'}
                                </div>
                                <div style={{flex: 1}}>
                                    <div style={{fontWeight: 'bold'}}>
                                        {player.name} {player.id === socket.id && "(You)"}
                                    </div>
                                    <div style={{fontSize: '12px', color: '#666'}}>
                                        {player.colorSelected ? 'Color selected' : 'Selecting color...'}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {!players.find(p => p.id === socket.id)?.colorSelected && (
                    <div style={{marginBottom: '20px'}}>
                        <button
                            onClick={() => setShowColorSelection(true)}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            Select Your Color
                        </button>
                    </div>
                )}

                <button
                    onClick={startGame}
                    disabled={players.length < 2 || players.some(p => !p.colorSelected)}
                    style={{
                        padding: '15px 30px',
                        fontSize: '16px',
                        backgroundColor: (players.length >= 2 && players.every(p => p.colorSelected)) ? '#28a745' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: (players.length >= 2 && players.every(p => p.colorSelected)) ? 'pointer' : 'not-allowed'
                    }}
                >
                    {players.length < 2 ? "Need at least 2 players" :
                        players.some(p => !p.colorSelected) ? "Waiting for color selection" :
                            "Start Game"}
                </button>

                <ColorSelectionModal/>
            </div>
        );
    }
    // Game Over Modal
    const GameOverModal = () => {
        if (!gameWinner) return null;

        return (
            <div style={{
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3000
            }}>
                <div style={{
                    background: 'white',
                    border: '5px solid gold',
                    borderRadius: '20px',
                    padding: '50px',
                    textAlign: 'center',
                    maxWidth: '500px'
                }}>
                    <h1 style={{fontSize: '48px', marginBottom: '20px'}}>🎉 GAME OVER! 🎉</h1>
                    <h2 style={{fontSize: '36px', marginBottom: '30px', color: '#FFD700'}}>
                        {gameWinner} WINS!
                    </h2>

                    <button
                        onClick={() => {
                            setGameWinner(null);
                            setGameState('menu');
                            window.location.reload(); // Reload to reset everything
                        }}
                        style={{
                            padding: '20px 40px',
                            fontSize: '20px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            marginRight: '10px'
                        }}
                    >
                        Back to Menu
                    </button>

                    <button
                        onClick={() => {
                            window.location.reload(); // Quick restart
                        }}
                        style={{
                            padding: '20px 40px',
                            fontSize: '20px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        Play Again
                    </button>
                </div>
            </div>
        );
    };

    // GAME SCREEN - UPDATED WITH NEW PLAYER CARD DISPLAY
    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(135deg, #1e7e34 0%, #155724 100%)',
            margin: 0,
            padding: 0,
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Turn indicator - LEFT SIDE */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '20px',
                transform: 'translateY(-50%)',
                padding: '20px',
                backgroundColor: isMyTurn ? 'rgba(40, 167, 69, 0.95)' : 'rgba(220, 53, 69, 0.95)',
                border: '3px solid #fff',
                borderRadius: '15px',
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold',
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                maxWidth: '200px',
                textAlign: 'center'
            }}>
                {isMyTurn ? "🎯 YOUR TURN" : `⏳ ${players.find(p => p.id === currentPlayer)?.name || 'Player'}'s turn`}
                {leadSuit && (
                    <div
                        style={{marginTop: '10px', fontSize: '14px', borderTop: '1px solid white', paddingTop: '10px'}}>
                        Lead: {leadSuit}
                    </div>
                )}
            </div>

            {/* Game Board - centered */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -55%)',
                zIndex: 1
            }}>
                <GameBoardWithPath/>
            </div>

            {/* Other players positioned in corners WITH THEIR PLAYED CARDS */}
            {getRelativePlayerPositions().map(({player, position}) => {
                const playedCard = cardsPlayedThisRound.find(cp => cp.playerId === player.id);

                return (
                    <div key={player.id} style={{position: 'absolute', ...position, zIndex: 50}}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}>
                            {/* Player info box */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '15px',
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: '15px',
                                border: currentPlayer === player.id ? '3px solid #FFD700' : '2px solid #333',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                marginBottom: '10px'
                            }}>
                                <div style={{
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '50%',
                                    backgroundColor: player.color,
                                    border: '3px solid #000',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    fontWeight: 'bold',
                                    color: 'white'
                                }}>
                                    {player.name.charAt(0)}
                                </div>
                                <div style={{fontWeight: 'bold', fontSize: '16px'}}>
                                    {player.name}
                                </div>
                            </div>

                            {/* Show played card as separate element below player info */}
                            {playedCard && (
                                <CardComponent
                                    card={playedCard.card}
                                    size="large"
                                    isClickable={false}
                                />
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Current player's played card - shown in center */}
            {cardsPlayedThisRound.find(cp => cp.playerId === playerId) && (
                <div style={{
                    position: 'absolute',
                    bottom: '200px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 150
                }}>
                    <CardComponent
                        card={cardsPlayedThisRound.find(cp => cp.playerId === playerId).card}
                        size="large"
                        isClickable={false}
                    />
                </div>
            )}

            {/* Player's hand at bottom - partially hidden */}
            <div style={{
                position: 'absolute',
                bottom: '-50px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'flex-end',
                zIndex: 200,
                paddingBottom: '20px'
            }}>
                {playerHand.map((card, index) => (
                    <div key={index} style={{
                        transition: 'transform 0.2s ease',
                        zIndex: playerHand.length - index
                    }}>
                        <CardComponent
                            card={card}
                            size="large"
                            isClickable={isMyTurn}
                            onClick={() => playCard(card)}
                            isInHand={true}
                        />
                    </div>
                ))}
            </div>

            <ColorSelectionModal/>
            <MovementChoiceModal/>
            <GameOverModal/>

            {/* Pick Step Modal */}
            {showPickStep && pickStepData && (
                <div style={{
                    position: 'fixed',
                    top: '',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        background: 'white',
                        border: '3px solid #333',
                        borderRadius: '15px',
                        padding: '40px',
                        maxWidth: '600px',
                        textAlign: 'center'
                    }}>
                        <h2>🎯 Pick Step - Position {pickStepData.position}</h2>

                        {pickStepData.canAddSuit ? (
                            <div>
                                <p style={{fontSize: '18px', marginBottom: '20px'}}>
                                    <strong>Choose a suit to add to the TOP of the ranking:</strong>
                                </p>
                                <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px'}}>
                                    {['spades', 'hearts', 'diamonds', 'clubs', 'stars', 'crowns']
                                        .filter(suit => !suitRanking.includes(suit))
                                        .map(suit => {
                                            const suitSymbols = {
                                                'spades': '♠', 'hearts': '♥', 'diamonds': '♦',
                                                'clubs': '♣', 'stars': '⭐', 'crowns': '👑'
                                            };
                                            const suitColors = {
                                                'spades': '#000000', 'hearts': '#FF0000', 'diamonds': '#FF0000',
                                                'clubs': '#000000', 'stars': '#FFD700', 'crowns': '#800080'
                                            };

                                            return (
                                                <button
                                                    key={suit}
                                                    onClick={() => handleSuitRankingUpdate('add', {suit})}
                                                    style={{
                                                        padding: '20px 30px',
                                                        fontSize: '20px',
                                                        backgroundColor: '#007bff',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        cursor: 'pointer',
                                                        textTransform: 'capitalize',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        minWidth: '120px'
                                                    }}
                                                >
                                        <span style={{fontSize: '40px'}}>
                                            {suitSymbols[suit]}
                                        </span>
                                                    <span>{suit}</span>
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p style={{fontSize: '18px', marginBottom: '20px'}}>
                                    <strong>Choose two suits to swap positions:</strong>
                                </p>
                                <div style={{
                                    marginBottom: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '20px'
                                }}>
                                    <select id="suit1" style={{
                                        padding: '15px',
                                        fontSize: '18px',
                                        borderRadius: '5px',
                                        border: '2px solid #333'
                                    }}>
                                        {suitRanking.map((suit, index) => {
                                            const suitSymbols = {
                                                'spades': '♠', 'hearts': '♥', 'diamonds': '♦',
                                                'clubs': '♣', 'stars': '⭐', 'crowns': '👑'
                                            };
                                            return (
                                                <option key={suit} value={suit}>
                                                    {index + 1}. {suitSymbols[suit]} {suit}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <span style={{fontSize: '32px', fontWeight: 'bold'}}>↔</span>
                                    <select id="suit1" style={{
                                        padding: '15px',
                                        fontSize: '18px',
                                        borderRadius: '5px',
                                        border: '2px solid #333'
                                    }}>
                                        {suitRanking.map((suit, index) => {
                                            const suitSymbols = {
                                                'spades': '♠', 'hearts': '♥', 'diamonds': '♦',
                                                'clubs': '♣', 'stars': '⭐', 'crowns': '👑'
                                            };
                                            return (
                                                <option key={suit} value={suit}>
                                                    {index + 1}. {suitSymbols[suit]} {suit}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <span style={{fontSize: '32px', fontWeight: 'bold'}}>↔</span>
                                    <select id="suit2" style={{
                                        padding: '15px',
                                        fontSize: '18px',
                                        borderRadius: '5px',
                                        border: '2px solid #333'
                                    }}>
                                        {suitRanking.map((suit, index) => {
                                            const suitSymbols = {
                                                'spades': '♠', 'hearts': '♥', 'diamonds': '♦',
                                                'clubs': '♣', 'stars': '⭐', 'crowns': '👑'
                                            };
                                            return (
                                                <option key={suit} value={suit}>
                                                    {index + 1}. {suitSymbols[suit]} {suit}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <button
                                    onClick={() => {
                                        const suit1 = document.getElementById('suit1').value;
                                        const suit2 = document.getElementById('suit2').value;
                                        handleSuitRankingUpdate('swap', {suit1, suit2});
                                    }}
                                    style={{
                                        padding: '20px 40px',
                                        fontSize: '20px',
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
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
            <div style={{
                position: 'absolute',
                top: '50%',
                right: '20px',
                transform: 'translateY(-50%)',
                width: '250px',
                maxHeight: '80vh',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '3px solid #333',
                borderRadius: '15px',
                padding: '15px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column'
            }}>
                <h3 style={{
                    margin: '0 0 15px 0',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    borderBottom: '2px solid #333',
                    paddingBottom: '10px'
                }}>
                    Game Log
                </h3>
                <div style={{
                    overflowY: 'auto',
                    flex: 1,
                    fontSize: '14px'
                }}>
                    {gameLog.map((entry, index) => (
                        <div key={index} style={{
                            marginBottom: '8px',
                            padding: '5px',
                            backgroundColor: entry.includes('🏆') ? '#d4edda' :
                                entry.includes('🎉') ? '#fff3cd' :
                                    entry.includes('New deck') ? '#d1ecf1' :
                                        entry.includes('Swapped') || entry.includes('Added') ? '#f8d7da' :
                                            'transparent',
                            borderRadius: '5px',
                            borderLeft: entry.includes('🏆') ? '3px solid #28a745' :
                                entry.includes('🎉') ? '3px solid #ffc107' :
                                    entry.includes('New deck') ? '3px solid #17a2b8' :
                                        entry.includes('Swapped') || entry.includes('Added') ? '3px solid #dc3545' :
                                            'none',
                            paddingLeft: '8px'
                        }}>
                            {entry}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default App;
