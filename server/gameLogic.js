const suits = ['spades', 'hearts', 'diamonds', 'clubs', 'stars', 'crowns'];

const createDeck = () => {
  const deck = [];

  // Create cards for each suit (1-11)
  suits.forEach(suit => {
    for (let i = 1; i <= 11; i++) {
      deck.push({ suit, value: i });
    }
  });

  // Add joker cards
  for (let i = 0; i < 3; i++) {
    deck.push({ suit: 'joker', value: null });
  }

  return deck;
};

const shuffleDeck = (deck) => {
  return deck.sort(() => Math.random() - 0.5);
};

module.exports = { createDeck, shuffleDeck };
