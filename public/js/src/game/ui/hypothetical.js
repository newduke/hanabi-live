/*
    In shared replays, players can enter a hypotheticals where can perform arbitrary actions
    in order to see what will happen
*/

// Imports
const constants = require('../../constants');
const convert = require('./convert');
const globals = require('./globals');
const replay = require('./replay');

exports.enter = () => {
    if (globals.hypothetical) {
        return;
    }

    if (globals.amSharedReplayLeader) {
        globals.lobby.conn.send('replayAction', {
            type: constants.REPLAY_ACTION_TYPE.HYPO_START,
        });

        setActivePlayerCardsDraggable();
    } else {
        globals.elements.replayArea.setVisible(false);
        globals.elements.hypoCircle.setVisible(true);
        globals.layers.UI.batchDraw();
    }
};

exports.exit = () => {
    if (!globals.hypothetical) {
        return;
    }

    if (globals.amSharedReplayLeader) {
        globals.lobby.conn.send('replayAction', {
            type: constants.REPLAY_ACTION_TYPE.HYPO_END,
        });
    } else {
        globals.elements.hypoCircle.setVisible(false);
        globals.elements.replayArea.setVisible(true);
        globals.layers.UI.batchDraw();
    }

    globals.hypoActions = [];

    // The "replay.goto()" function will do nothing if we are already at the target turn,
    // so set the current replay turn to the end of the game to force it to draw/compute the
    // game from the beginning
    globals.replayTurn = globals.replayMax;
    replay.goto(globals.sharedReplayTurn, true);
};

const setActivePlayerCardsDraggable = () => {
    const hand = globals.elements.playerHands[globals.currentPlayerIndex];
    for (const layoutChild of hand.children) {
        layoutChild.checkSetDraggable();
    }
};

exports.send = (action) => {
    let type = '';
    if (action.data.type === constants.ACT.CLUE) {
        type = 'clue';
    } else if (action.data.type === constants.ACT.PLAY) {
        type = 'play';
    } else if (action.data.type === constants.ACT.DISCARD) {
        type = 'discard';
    } else if (action.data.type === constants.ACT.DECKPLAY) {
        type = 'play';
    }

    if (type === 'clue') {
        // Clue
        hypoAction({
            type,
            clue: null,
            giver: globals.currentPlayerIndex,
            // list: ?,
            // target: ?,
            turn: globals.turn,
        });
        globals.clues -= 1;

        // Text
        let text = `${globals.playerNames[globals.currentPlayerIndex]} tells `;
        text += `${globals.playerNames[action.target]} about ?`;
        hypoAction({
            type: 'text',
            text,
        });
    } else if (type === 'play' || type === 'discard') {
        const card = globals.deck[action.data.target];

        // Play / Discard
        hypoAction({
            type,
            which: {
                index: globals.currentPlayerIndex,
                order: action.data.target,
                rank: card.rank,
                suit: convert.suitToMsgSuit(card.suit, globals.variant),
            },
        });
        globals.score += 1;

        // Text
        let text = `${globals.playerNames[globals.currentPlayerIndex]} ${type}s `;
        text += `${card.suit.name} ${card.rank} from slot #${card.getSlotNum()}`;
        hypoAction({
            type: 'text',
            text,
        });

        // Draw
        const nextCardOrder = globals.indexOfLastDrawnCard + 1;
        const nextCard = globals.deckOrder[nextCardOrder];
        if (nextCard) { // All the cards might have already been drawn
            hypoAction({
                type: 'draw',
                order: nextCardOrder,
                rank: nextCard.rank,
                suit: nextCard.suit,
                who: globals.currentPlayerIndex,
            });
        }
    }

    // Status
    hypoAction({
        type: 'status',
        clues: globals.clues,
        doubleDiscard: false,
        score: globals.score,
        maxScore: globals.maxScore,
    });

    // Turn
    globals.turn += 1;
    globals.currentPlayerIndex += 1;
    if (globals.currentPlayerIndex === globals.playerNames.length) {
        globals.currentPlayerIndex = 0;
    }
    hypoAction({
        type: 'turn',
        num: globals.turn,
        who: globals.currentPlayerIndex,
    });
};

const hypoAction = (action) => {
    globals.lobby.conn.send('replayAction', {
        type: constants.REPLAY_ACTION_TYPE.HYPO_ACTION,
        actionJSON: JSON.stringify(action),
    });
};
