const createBoard = () => {
    return {
        totalSteps: 24,
        pickSteps: [3, 6, 9, 14, 19, 22],
        greenZone: [19, 20, 21, 22, 23, 24, 25],
    };
};

module.exports = {createBoard};
  