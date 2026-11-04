/**
 * WebRTC Internet Multiplayer Service (PeerJS Host & Client Room Sync)
 */

import { app } from '../state/store.js';
import { saveSessionToStorage, clearSessionStorage } from '../state/session.js';
import {
  disambiguatePlayerName,
  setLoadingOverlay,
  showToast,
  sanitizeAvatar,
  getPlayerMetaMod
} from '../ui/utils.js';
import { sfx } from './audio.js';
import { clearCharacterCanvas } from '../features/canvas.js';
import { renderState } from '../ui/render.js';
import { stopTypewriter } from '../ui/screens/reveal.js';

export const PEER_PREFIX = 'plot-engineering-';

export const PEER_OPTIONS = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ],
    iceCandidatePoolSize: 10
  }
};

let hooks = {
  checkAllCharactersReady: () => {},
  checkAllActionsSubmitted: () => {},
  updateTimerDisplay: () => {},
  stopTimer: () => {}
};

export function setNetworkHooks(customHooks) {
  hooks = { ...hooks, ...customHooks };
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function hostCreateRoom(retryCount = 0) {
  const hostNameInput = document.getElementById('host-player-name')?.value.trim();
  const hostName = hostNameInput || 'Host Player';
  const code = generateRoomCode();

  app.isHost = true;
  app.myName = hostName;
  app.roomCode = code;
  app.myId = 'host-' + Math.random().toString(36).slice(2, 8);

  setLoadingOverlay(true, 'Creating multiplayer room ' + code + '...');

  let opened = false;

  try {
    const peerId = PEER_PREFIX + code;
    const peer = new window.Peer(peerId, PEER_OPTIONS);
    app.peer = peer;

    peer.on('open', () => {
      opened = true;
      setLoadingOverlay(false);
      initHostGameState(code, hostName);
      sfx.join();
    });

    peer.on('connection', (conn) => {
      setupHostClientConnection(conn);
    });

    peer.on('disconnected', () => {
      try {
        peer.reconnect();
      } catch (e) {
        console.warn('Peer reconnect failed:', e);
      }
    });

    peer.on('error', (err) => {
      console.error('PeerJS Host error:', err);
      setLoadingOverlay(false);

      if (opened) {
        if (err.type === 'network' || err.type === 'disconnected') {
          showToast('Connection lost, reconnecting...', 'warn');
          try {
            peer.reconnect();
          } catch (e) {
            console.warn('Peer reconnect failed:', e);
          }
        } else {
          showToast('Network notice: ' + (err.message || err.type), 'warn');
        }
        return;
      }

      if (err.type === 'unavailable-id') {
        if (retryCount < 5) {
          hostCreateRoom(retryCount + 1);
        } else {
          showToast('Room code collision. Please try again.', 'error');
          leaveRoomToHome();
        }
      } else {
        showToast('Could not reach the matchmaking server. Check your connection.', 'error');
        leaveRoomToHome();
      }
    });
  } catch (e) {
    setLoadingOverlay(false);
    showToast('Could not reach the matchmaking server. Check your connection.', 'error');
    leaveRoomToHome();
  }
}

export function initHostGameState(code, hostName) {
  app.state.phase = 'LOBBY';
  app.lobbyView = 'cast';
  app.state.roomCode = code;
  app.state.campaignSetupStarted = false;
  app.state.players = [
    {
      id: app.myId,
      name: hostName,
      isHost: true,
      isBot: false,
      score: 0,
      character: null,
      modifiers: []
    }
  ];
  app.state.submissions = {};
  app.state.hiddenSubmissions = {};
  app.state.roundHistory = [];
  app.state.currentRound = 0;
  app.state.storySoFar = '';
  app.state.isJudging = false;
  saveSessionToStorage();
  renderState();
}

export function setupHostClientConnection(conn) {
  conn.on('data', (msg) => {
    handleClientMessageOnHost(conn, msg);
  });

  const handleClose = () => {
    if (!conn.playerId) return;
    if (app.state.phase === 'LOBBY') {
      app.state.players = app.state.players.filter(p => p.id !== conn.playerId);
      delete app.clientConns[conn.playerId];
      broadcastState();
    } else {
      const p = app.state.players.find(pl => pl.id === conn.playerId);
      if (p) {
        p.disconnected = true;
        broadcastState();
        if (app.state.phase === 'CHAR_CREATE') hooks.checkAllCharactersReady();
        if (app.state.phase === 'SCENARIO') hooks.checkAllActionsSubmitted();
      }
    }
  };

  conn.on('close', handleClose);
  conn.on('error', (err) => {
    console.warn('Host client connection error:', err);
  });
}

export function handleClientMessageOnHost(conn, msg) {
  if (!msg || !msg.type) return;

  if (msg.type === 'JOIN_REQUEST') {
    const rawId = typeof msg.playerId === 'string' ? msg.playerId.trim() : '';
    const safeProvidedId = /^[a-z0-9-]{3,24}$/i.test(rawId) ? rawId : null;
    const providedToken = typeof msg.token === 'string' ? msg.token.trim() : '';

    if (!app.playerTokens) app.playerTokens = {};

    let existing = safeProvidedId ? app.state.players.find(p => p.id === safeProvidedId) : null;
    if (existing) {
      if (existing.isHost || existing.isBot) {
        try {
          conn.send({
            type: 'JOIN_REJECTED',
            reason: 'Cannot claim host or bot seat.'
          });
        } catch (e) {}
        setTimeout(() => { try { conn.close(); } catch (e) {} }, 80);
        return;
      }

      const recordedToken = app.playerTokens[existing.id];
      if (recordedToken) {
        if (recordedToken !== providedToken) {
          try {
            conn.send({
              type: 'JOIN_REJECTED',
              reason: 'Seat authentication failed. Please rejoin with a new name.'
            });
          } catch (e) {}
          setTimeout(() => { try { conn.close(); } catch (e) {} }, 80);
          return;
        }
      } else {
        const isCurrentlyConnected = Boolean(app.clientConns[existing.id] && app.clientConns[existing.id].open);
        if (isCurrentlyConnected) {
          try {
            conn.send({
              type: 'JOIN_REJECTED',
              reason: 'Seat is currently occupied.'
            });
          } catch (e) {}
          setTimeout(() => { try { conn.close(); } catch (e) {} }, 80);
          return;
        }
        if (providedToken) {
          app.playerTokens[existing.id] = providedToken;
        }
      }

      const playerId = existing.id;
      conn.playerId = playerId;
      app.clientConns[playerId] = conn;
      existing.disconnected = false;

      conn.send({
        type: 'JOIN_ACCEPTED',
        playerId,
        state: getPublicState(playerId)
      });
      broadcastState();
      showToast(`${existing.name} reconnected!`, 'info');
      return;
    }

    if (app.state.players.length >= 8) {
      try {
        conn.send({
          type: 'JOIN_REJECTED',
          reason: 'Cannot join: The room is full (maximum 8 players).'
        });
      } catch (e) {}
      setTimeout(() => {
        try { conn.close(); } catch (e) {}
      }, 80);
      return;
    }

    if (app.state.phase !== 'LOBBY') {
      try {
        conn.send({
          type: 'JOIN_REJECTED',
          reason: 'Cannot join: The Host has already started the game!'
        });
      } catch (e) {}
      setTimeout(() => {
        try { conn.close(); } catch (e) {}
      }, 80);
      return;
    }

    const playerId = safeProvidedId || ('p-' + Math.random().toString(36).slice(2, 9));
    conn.playerId = playerId;
    app.clientConns[playerId] = conn;
    if (providedToken) {
      app.playerTokens[playerId] = providedToken;
    }

    const rawPlayerName = typeof msg.playerName === 'string' ? msg.playerName.trim() : '';
    const finalName = disambiguatePlayerName(rawPlayerName || 'Player', app.state.players);

    const newPlayer = {
      id: playerId,
      name: finalName,
      isHost: false,
      isBot: false,
      score: 0,
      character: null,
      modifiers: [],
      disconnected: false
    };
    app.state.players.push(newPlayer);
    sfx.join();
    showToast(`${newPlayer.name} joined the room!`, 'info');

    conn.send({
      type: 'JOIN_ACCEPTED',
      playerId,
      state: getPublicState(playerId)
    });
    broadcastState();
    return;
  }

  if (msg.type === 'SUBMIT_CHARACTER') {
    if (app.state.phase !== 'CHAR_CREATE') return;
    const senderId = conn.playerId;
    if (!senderId) return;
    const p = app.state.players.find(pl => pl.id === senderId);
    if (p && msg.character) {
      let safeStartMod = null;
      if (msg.character.startMod && app.state.settings.allowStartingQuirk) {
        safeStartMod = {
          name: String(msg.character.startMod.name || 'Quirk').slice(0, 32),
          description: String(msg.character.startMod.description || '').slice(0, 80),
          type: 'neutral',
          metaEffect: 'NONE'
        };
      }
      p.character = {
        name: String(msg.character.name || p.name).slice(0, 30),
        role: String(msg.character.role || 'Adventurer').slice(0, 80),
        avatar: sanitizeAvatar(msg.character.avatar || ''),
        ready: true
      };
      p.modifiers = safeStartMod ? [safeStartMod] : [];
      sfx.lockIn();
      hooks.checkAllCharactersReady();
      broadcastState();
    }
  }

  if (msg.type === 'UNLOCK_CHARACTER') {
    if (app.state.phase !== 'CHAR_CREATE') return;
    const senderId = conn.playerId;
    if (!senderId) return;
    const p = app.state.players.find(pl => pl.id === senderId);
    if (p && p.character) {
      p.character.ready = false;
      broadcastState();
    }
  }

  if (msg.type === 'SUBMIT_ACTION') {
    const senderId = conn.playerId;
    if (!senderId) return;
    if (app.state.phase === 'SCENARIO') {
      app.state.submissions[senderId] = String(msg.action || '').slice(0, 400).trim();
      app.state.hiddenSubmissions[senderId] = true;
      sfx.lockIn();
      broadcastState();
      hooks.checkAllActionsSubmitted();
    }
  }

  if (msg.type === 'UNLOCK_ACTION') {
    const senderId = conn.playerId;
    if (!senderId) return;
    if (app.state.phase === 'SCENARIO') {
      delete app.state.submissions[senderId];
      delete app.state.hiddenSubmissions[senderId];
      broadcastState();
    }
  }
}

export function clientJoinRoom() {
  const code = document.getElementById('join-room-code')?.value.trim().toUpperCase() || '';
  const name = document.getElementById('join-player-name')?.value.trim() || '';

  if (code.length !== 4) {
    showToast('Please enter a valid 4-letter Room Code!', 'error');
    return;
  }
  if (!name) {
    showToast('Please enter your nickname!', 'error');
    return;
  }

  app.isHost = false;
  app.roomCode = code;
  app.myName = name;
  app.myId = sessionStorage.getItem('plot_engineering_player_id') || ('p-' + Math.random().toString(36).slice(2, 9));
  sessionStorage.setItem('plot_engineering_player_id', app.myId);
  sessionStorage.setItem('plot_engineering_room_code', code);
  sessionStorage.setItem('plot_engineering_player_name', name);
  const roomTokenKey = `plot_engineering_player_token_${code}`;
  let playerToken = sessionStorage.getItem(roomTokenKey) || sessionStorage.getItem('plot_engineering_player_token');
  if (!playerToken) {
    playerToken = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Math.random().toString(36).slice(2) + Date.now().toString(36));
  }
  sessionStorage.setItem(roomTokenKey, playerToken);

  setLoadingOverlay(true, `Connecting to Room ${code}...`);

  // Teardown any lingering previous connection and peer before creating a new one
  if (app.hostConn) {
    try {
      if (typeof app.hostConn.removeAllListeners === 'function') {
        app.hostConn.removeAllListeners();
      }
      app.hostConn.close();
    } catch (e) {}
    app.hostConn = null;
  }
  if (app.peer) {
    try {
      if (typeof app.peer.removeAllListeners === 'function') {
        app.peer.removeAllListeners();
      }
      app.peer.destroy();
    } catch (e) {}
    app.peer = null;
  }

  const peer = new window.Peer(PEER_OPTIONS);
  app.peer = peer;

  peer.on('open', () => {
    const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
    app.hostConn = conn;

    let joinAccepted = false;
    const timeout = setTimeout(() => {
      if (!joinAccepted) {
        setLoadingOverlay(false);
        showToast(`Could not connect to Room ${code}. Check the code with the Host!`, 'error');
      }
    }, 15000);

    const sendJoinReq = () => {
      if (joinAccepted) return;
      try {
        conn.send({
          type: 'JOIN_REQUEST',
          playerId: app.myId,
          playerName: app.myName,
          token: playerToken
        });
      } catch (e) {}
    };

    if (conn.open) {
      sendJoinReq();
    }
    conn.on('open', () => {
      sendJoinReq();
    });

    conn.on('data', (msg) => {
      if (msg.type === 'JOIN_ACCEPTED') {
        joinAccepted = true;
        clearTimeout(timeout);
        setLoadingOverlay(false);
        app.myId = msg.playerId;
        app.state = msg.state;
        if (msg.state.remainingMs > 0) {
          app.timerDeadline = Date.now() + msg.state.remainingMs;
          if (!app.timerInterval) app.timerInterval = setInterval(hooks.updateTimerDisplay, 250);
        } else {
          hooks.stopTimer();
        }
        sfx.join();
        saveSessionToStorage();
        renderState();
      } else if (msg.type === 'STATE_UPDATE') {
        const prevPhase = app.state.phase;
        const prevRound = app.state.currentRound;
        const prevReveal = app.state.revealStep;
        app.state = msg.state;
        if (msg.state.remainingMs > 0) {
          app.timerDeadline = Date.now() + msg.state.remainingMs;
          if (!app.timerInterval) app.timerInterval = setInterval(hooks.updateTimerDisplay, 250);
        } else {
          hooks.stopTimer();
        }
        if (prevPhase !== 'CHAR_CREATE' && app.state.phase === 'CHAR_CREATE') {
          app.charCreateStep = 1;
          clearCharacterCanvas(false);
        }
        if ((prevPhase !== 'SCENARIO' && app.state.phase === 'SCENARIO') || prevRound !== app.state.currentRound) {
          const actionInput = document.getElementById('scenario-action-input');
          if (actionInput && !app.state.submissions[app.myId]) {
            actionInput.value = '';
          }
        }
        if (prevPhase !== app.state.phase || prevReveal !== app.state.revealStep) {
          sfx.stepReveal();
        }
        saveSessionToStorage();
        renderState();
      } else if (msg.type === 'JOIN_REJECTED') {
        joinAccepted = true;
        clearTimeout(timeout);
        setLoadingOverlay(false);
        showToast(msg.reason || 'Cannot join: The Host has already started the game!', 'error');
        leaveRoomToHome();
      } else if (msg.type === 'ROOM_CLOSED') {
        setLoadingOverlay(false);
        showToast(msg.reason || 'The Host closed the room.', 'warn');
        leaveRoomToHome();
      }
    });

    conn.on('close', () => {
      if (app.state.phase !== 'HOME') {
        setLoadingOverlay(false);
        showToast('The Host closed the room.', 'warn');
        leaveRoomToHome();
      }
    });
  });

  peer.on('error', (err) => {
    setLoadingOverlay(false);
    showToast('Could not connect to Room ' + code + '. Make sure the code is correct!', 'error');
    console.error(err);
  });
}

export function stripCampaignSecrets(campaign) {
  if (!campaign) return null;
  return {
    ...campaign,
    rounds: Array.isArray(campaign.rounds)
      ? campaign.rounds.map(r => ({
          title: r.title,
          scenario: r.scenario
        }))
      : []
  };
}

export function getPublicState(forPlayerId = null) {
  const maskedSubmissions = {};
  const submissionKinds = {};

  const canRevealMoves = Boolean(
    app.state.settings?.revealMovesAfterStory && (
      (app.state.phase === 'REVEAL' && app.state.revealStep >= 2 && !app.state.isJudging) ||
      app.state.phase === 'GAME_OVER'
    )
  );

  for (const p of app.state.players) {
    const pid = p.id;
    const deadMod = getPlayerMetaMod(p, 'DEAD');
    const skipMod = getPlayerMetaMod(p, 'SKIP_TURN');
    const charName = p.character?.name || p.name;

    if (deadMod) {
      submissionKinds[pid] = 'dead';
      maskedSubmissions[pid] = `${charName} did nothing, they are dead`;
    } else if (skipMod) {
      submissionKinds[pid] = 'locked';
      maskedSubmissions[pid] = `${charName} did nothing, they are locked out`;
    } else if (p.disconnected) {
      submissionKinds[pid] = 'away';
      maskedSubmissions[pid] = '(Was away)';
    } else if (pid === forPlayerId || canRevealMoves) {
      submissionKinds[pid] = 'text';
      maskedSubmissions[pid] = app.state.submissions[pid] || '';
    } else {
      submissionKinds[pid] = 'secret';
      maskedSubmissions[pid] = app.state.phase === 'SCENARIO' ? '__LOCKED_IN__' : '__SECRET_ACTION__';
    }
  }

  const sanitizedHistory = (app.state.roundHistory || []).map(h => {
    if (app.state.settings?.revealMovesAfterStory) {
      return h;
    }
    const safeSubmissions = {};
    if (h.submissions && forPlayerId && h.submissions[forPlayerId]) {
      safeSubmissions[forPlayerId] = h.submissions[forPlayerId];
    }
    return {
      ...h,
      submissions: safeSubmissions
    };
  });

  const isEarlyReveal = app.state.phase === 'REVEAL' && app.state.revealStep < 2;

  let publicPlayers = app.state.players;
  let publicStorySoFar = app.state.storySoFar;
  let publicJudgment = app.state.currentJudgment;
  let publicRoundHistory = sanitizedHistory;

  if (isEarlyReveal) {
    if (app.state.currentJudgment) {
      publicJudgment = { pending: true };
    }
    if (app.state._preRoundSnapshot) {
      const snap = app.state._preRoundSnapshot;
      if (typeof snap.storySoFar === 'string') {
        publicStorySoFar = snap.storySoFar;
      }
      if (Array.isArray(snap.players)) {
        publicPlayers = app.state.players.map(p => {
          const snapP = snap.players.find(sp => sp.id === p.id);
          return snapP ? { ...p, score: snapP.score, modifiers: snapP.modifiers } : p;
        });
      }
      publicRoundHistory = publicRoundHistory.filter(h => h.roundIndex !== app.state.currentRound);
    }
  }

  const { _preRoundSnapshot, ...safeState } = app.state;

  return {
    ...safeState,
    players: publicPlayers,
    storySoFar: publicStorySoFar,
    currentJudgment: publicJudgment,
    activeCampaign: stripCampaignSecrets(app.state.activeCampaign),
    customCampaign: stripCampaignSecrets(app.state.customCampaign),
    roundHistory: publicRoundHistory,
    submissions: maskedSubmissions,
    submissionKinds
  };
}

export function broadcastState() {
  if (!app.isHost) return;
  for (const pid of Object.keys(app.clientConns)) {
    const conn = app.clientConns[pid];
    if (conn && conn.open) {
      try {
        conn.send({ type: 'STATE_UPDATE', state: getPublicState(pid) });
      } catch (e) {
        console.warn('Error broadcasting to client:', e);
      }
    }
  }
  saveSessionToStorage();
  renderState();
}

export function sendToHost(msg) {
  if (app.isHost) return true;
  if (app.hostConn && app.hostConn.open) {
    try {
      app.hostConn.send(msg);
      return true;
    } catch (e) {
      console.warn('sendToHost failed:', e);
    }
  }
  showToast('Lost connection to the host. Trying to reconnect...', 'warn');
  rejoinStoredRoom();
  return false;
}

export function rejoinStoredRoom() {
  const code = sessionStorage.getItem('plot_engineering_room_code');
  const name = sessionStorage.getItem('plot_engineering_player_name') || 'Player';
  if (!code) return;
  const codeInput = document.getElementById('join-room-code');
  const nameInput = document.getElementById('join-player-name');
  if (codeInput) codeInput.value = code;
  if (nameInput) nameInput.value = name;
  clientJoinRoom();
}

export function leaveRoomToHome() {
  clearSessionStorage();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('plot_engineering_room_code');
  }
  clearInterval(app.timerInterval);
  stopTypewriter();

  const wasHost = app.isHost;
  const connsToClose = app.clientConns || {};
  const peerToDestroy = app.peer;
  const hostConnToClose = app.hostConn;

  app.clientConns = {};
  app.playerTokens = {};
  app.hostConn = null;
  app.peer = null;
  app.isHost = false;
  app.roomCode = '';
  app.state.phase = 'HOME';
  app.state.roomCode = '';
  app.state.campaignSetupStarted = false;
  app.state.players = [];
  renderState();

  if (wasHost) {
    for (const pid of Object.keys(connsToClose)) {
      const c = connsToClose[pid];
      if (c && c.open) {
        try {
          c.send({ type: 'ROOM_CLOSED', reason: 'The Host closed the room.' });
        } catch (e) {}
      }
    }
    setTimeout(() => {
      for (const pid of Object.keys(connsToClose)) {
        try { connsToClose[pid].close(); } catch (e) {}
      }
      if (peerToDestroy) {
        try { peerToDestroy.destroy(); } catch (e) {}
      }
    }, 100);
  } else {
    if (hostConnToClose) {
      try { hostConnToClose.close(); } catch (e) {}
    }
    if (peerToDestroy) {
      try { peerToDestroy.destroy(); } catch (e) {}
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (app.isHost && app.clientConns) {
      for (const pid of Object.keys(app.clientConns)) {
        const c = app.clientConns[pid];
        if (c && c.open) {
          try { c.send({ type: 'ROOM_CLOSED', reason: 'The Host closed the room.' }); } catch (e) {}
        }
      }
    }
  });
}
