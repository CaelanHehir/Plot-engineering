import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const createDummyElement = () => ({
  textContent: '',
  innerHTML: '',
  className: '',
  value: '',
  classList: {
    add: () => {},
    remove: () => {},
    toggle: () => {},
    contains: () => false
  },
  setAttribute: () => {},
  getAttribute: () => null,
  addEventListener: () => {},
  appendChild: () => {},
  remove: () => {},
  style: {}
});

// Ensure browser globals needed by modules do not throw
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    getElementById: () => createDummyElement(),
    querySelector: () => createDummyElement(),
    querySelectorAll: () => [],
    createElement: () => createDummyElement(),
    body: createDummyElement()
  };
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
}

import { app } from '../assets/js/state/store.js';
import { getPublicState, handleClientMessageOnHost } from '../assets/js/services/network.js';

function resetTestApp() {
  app.isHost = true;
  app.myId = 'host-123';
  app.myName = 'Host User';
  app.roomCode = 'TEST';
  app.playerTokens = {};
  app.clientConns = {};
  app.state = {
    phase: 'LOBBY',
    roomCode: 'TEST',
    settings: {
      revealMovesAfterStory: true
    },
    players: [
      { id: 'host-123', name: 'Host User', isHost: true, isBot: false, score: 100, modifiers: [] },
      { id: 'p-1', name: 'Alice', isHost: false, isBot: false, score: 200, modifiers: [] },
      { id: 'p-2', name: 'Bob', isHost: false, isBot: false, score: 150, modifiers: [] },
      { id: 'bot-1', name: 'Bot Bravo', isHost: false, isBot: true, score: 50, modifiers: [] }
    ],
    submissions: {
      'host-123': 'Host casts lightning',
      'p-1': 'Alice sets a tripwire',
      'p-2': 'Bob covers the exit'
    },
    hiddenSubmissions: {
      'host-123': true,
      'p-1': true,
      'p-2': true
    },
    roundHistory: [
      {
        roundNumber: 1,
        headline: 'Past Round',
        submissions: {
          'host-123': 'Past move 1',
          'p-1': 'Past move 2',
          'p-2': 'Past move 3'
        }
      }
    ],
    currentJudgment: null
  };
}

describe('getPublicState security and data masking', () => {
  beforeEach(() => {
    resetTestApp();
  });

  it('masks other players actions during SCENARIO or unrevealed phase', () => {
    app.state.phase = 'SCENARIO';
    const publicState = getPublicState('p-1');

    // Alice should see her own action
    assert.equal(publicState.submissionKinds['p-1'], 'text');
    assert.equal(publicState.submissions['p-1'], 'Alice sets a tripwire');

    // Alice should NOT see Bob or Host actions
    assert.equal(publicState.submissionKinds['p-2'], 'secret');
    assert.equal(publicState.submissions['p-2'], '__LOCKED_IN__');
    assert.equal(publicState.submissionKinds['host-123'], 'secret');
    assert.equal(publicState.submissions['host-123'], '__LOCKED_IN__');
  });

  it('correctly marks DEAD and SKIP_TURN players', () => {
    app.state.phase = 'SCENARIO';
    app.state.players[1].modifiers = [{ name: 'Fallen', type: 'debuff', metaEffect: 'DEAD' }];
    app.state.players[2].modifiers = [{ name: 'Stunned', type: 'debuff', metaEffect: 'SKIP_TURN' }];

    const publicState = getPublicState('p-1');
    assert.equal(publicState.submissionKinds['p-1'], 'dead');
    assert.match(publicState.submissions['p-1'], /dead/i);

    assert.equal(publicState.submissionKinds['p-2'], 'locked');
    assert.match(publicState.submissions['p-2'], /locked out/i);
  });

  it('shields early judgment and score updates during REVEAL step 1', () => {
    app.state.phase = 'REVEAL';
    app.state.revealStep = 1;
    app.state.currentJudgment = {
      headline: 'Secret Winner!',
      storyParagraphs: ['Spoilers galore'],
      rankings: [{ playerId: 'p-1', rank: 1 }]
    };
    app.state._preRoundSnapshot = {
      players: [
        { id: 'host-123', score: 100, modifiers: [] },
        { id: 'p-1', score: 100, modifiers: [] }, // pre-round score was 100, current is 200
        { id: 'p-2', score: 150, modifiers: [] },
        { id: 'bot-1', score: 50, modifiers: [] }
      ],
      storySoFar: 'Pre-round story.'
    };

    const publicState = getPublicState('p-1');

    // Judgment must be stubbed
    assert.deepEqual(publicState.currentJudgment, { pending: true });
    // Scores must be the pre-round scores
    const alice = publicState.players.find(p => p.id === 'p-1');
    assert.equal(alice.score, 100);
    // _preRoundSnapshot must NOT be leaked
    assert.equal(publicState._preRoundSnapshot, undefined);
  });

  it('never exposes playerTokens in public state', () => {
    app.playerTokens = { 'p-1': 'secret-token-alice', 'p-2': 'secret-token-bob' };
    const publicState = getPublicState('p-1');
    assert.equal(publicState.playerTokens, undefined);
  });

  it('does not drop past completed round history when judging or before round is pushed', () => {
    app.state.currentRound = 1; // Round 2 (0-indexed)
    app.state.roundHistory = [
      { roundIndex: 0, headline: 'Round 1 Victory', storyParagraphs: ['Survived'] }
    ];
    app.state.phase = 'REVEAL';
    app.state.revealStep = 1;

    const publicState = getPublicState('p-1');
    assert.equal(publicState.roundHistory.length, 1);
    assert.equal(publicState.roundHistory[0].roundIndex, 0);
  });
});

describe('handleClientMessageOnHost seat protection and phase gating', () => {
  beforeEach(() => {
    resetTestApp();
  });

  function makeMockConn() {
    const messages = [];
    return {
      playerId: null,
      open: true,
      messages,
      send(data) {
        messages.push(data);
      },
      close() {
        this.open = false;
      }
    };
  }

  it('rejects claims on host and bot seats', () => {
    const conn1 = makeMockConn();
    handleClientMessageOnHost(conn1, {
      type: 'JOIN_REQUEST',
      playerId: 'host-123',
      token: 'some-token'
    });
    assert.equal(conn1.messages[0]?.type, 'JOIN_REJECTED');
    assert.match(conn1.messages[0]?.reason, /cannot claim host or bot/i);

    const conn2 = makeMockConn();
    handleClientMessageOnHost(conn2, {
      type: 'JOIN_REQUEST',
      playerId: 'bot-1',
      token: 'some-token'
    });
    assert.equal(conn2.messages[0]?.type, 'JOIN_REJECTED');
  });

  it('requires matching token for rejoins and rejects invalid tokens', () => {
    app.playerTokens['p-1'] = 'valid-token-alice';

    const badConn = makeMockConn();
    handleClientMessageOnHost(badConn, {
      type: 'JOIN_REQUEST',
      playerId: 'p-1',
      token: 'imposter-token'
    });
    assert.equal(badConn.messages[0]?.type, 'JOIN_REJECTED');
    assert.match(badConn.messages[0]?.reason, /seat authentication failed/i);

    const goodConn = makeMockConn();
    handleClientMessageOnHost(goodConn, {
      type: 'JOIN_REQUEST',
      playerId: 'p-1',
      token: 'valid-token-alice'
    });
    assert.equal(goodConn.messages[0]?.type, 'JOIN_ACCEPTED');
  });

  it('blocks claiming an active occupied tokenless seat', () => {
    // p-2 has no recorded token yet, but an active connection is open
    app.clientConns['p-2'] = { open: true };

    const conn = makeMockConn();
    handleClientMessageOnHost(conn, {
      type: 'JOIN_REQUEST',
      playerId: 'p-2',
      token: 'any-token'
    });
    assert.equal(conn.messages[0]?.type, 'JOIN_REJECTED');
    assert.match(conn.messages[0]?.reason, /occupied/i);
  });

  it('records token on fresh join and accepts non-string names safely', () => {
    const conn = makeMockConn();
    handleClientMessageOnHost(conn, {
      type: 'JOIN_REQUEST',
      playerId: 'p-new',
      playerName: null,
      token: 'token-new-player'
    });
    assert.equal(conn.messages[0]?.type, 'JOIN_ACCEPTED');
    assert.equal(app.playerTokens['p-new'], 'token-new-player');
    const newPlayer = app.state.players.find(p => p.id === 'p-new');
    assert.equal(newPlayer.name, 'Player');
  });

  it('ignores SUBMIT_CHARACTER outside CHAR_CREATE phase to protect modifiers', () => {
    app.state.phase = 'SCENARIO';
    const playerAlice = app.state.players.find(p => p.id === 'p-1');
    playerAlice.modifiers = [{ name: 'Dead', type: 'debuff', metaEffect: 'DEAD' }];

    const conn = makeMockConn();
    conn.playerId = 'p-1';
    handleClientMessageOnHost(conn, {
      type: 'SUBMIT_CHARACTER',
      character: { name: 'Exploiter', role: 'Cheater' }
    });

    // Modifiers must NOT have been wiped to empty
    assert.equal(playerAlice.modifiers.length, 1);
    assert.equal(playerAlice.modifiers[0].metaEffect, 'DEAD');
  });
});
