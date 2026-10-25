/**
 * WebRTC Internet Multiplayer Service (PeerJS Host & Client Room Sync)
 * 
 * Architecture:
 * - Star topology: The host is the authoritative central node with Peer ID "chaos-coop-v1-{ROOM_CODE}".
 * - Free PeerJS Cloud Broker is used strictly for initial WebRTC signaling (SDP handshake).
 * - After connection, all state synchronization, action submissions, and judging broadcasts
 *   flow directly peer-to-peer via DataChannels without central server costs or limits.
 * - Host Authority: Clients send intent messages (JOIN_REQUEST, SUBMIT_CHARACTER, SUBMIT_ACTION)
 *   and the Host validates them, updates state, and broadcasts STATE_UPDATE.
 * - Game Integrity: Mid-game connections are rejected with JOIN_REJECTED so players cannot
 *   drop in midway through an active campaign. Secrets and unrevealed actions are masked in
 *   public state so clients cannot inspect hidden judge lore or other players' locked moves.
 */

/** Shared PeerJS ID namespace prefix */
const PEER_PREFIX = 'chaos-coop-v1-';

/**
 * Generates an uppercase 4-letter alphanumeric room code, excluding ambiguous characters (I, O, 1, 0).
 * @returns {string} 4-letter room code (e.g. "KY7B")
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Initializes a new multiplayer room as the Host.
 * Connects to the PeerJS signaling broker using the deterministic ID "chaos-coop-v1-{CODE}".
 */
function hostCreateRoom() {
  const hostNameInput = document.getElementById('host-player-name').value.trim();
  const hostName = hostNameInput || 'Host Player';
  const code = generateRoomCode();

  app.isHost = true;
  app.myName = hostName;
  app.roomCode = code;
  app.myId = 'host-' + Math.random().toString(36).slice(2, 8);

  setLoadingOverlay(true, 'Creating multiplayer room ' + code + '...');

  try {
    const peerId = PEER_PREFIX + code;
    const peer = new Peer(peerId);
    app.peer = peer;

    peer.on('open', () => {
      setLoadingOverlay(false);
      initHostGameState(code, hostName);
      sfx.join();
    });

    peer.on('connection', (conn) => {
      setupHostClientConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('PeerJS Host error:', err);
      setLoadingOverlay(false);
      if (err.type === 'unavailable-id') {
        // Code collision: try again with fresh code
        hostCreateRoom();
      } else {
        showToast('Running in local room mode.', 'warn');
        initHostGameState(code, hostName);
      }
    });
  } catch (e) {
    setLoadingOverlay(false);
    initHostGameState(code, hostName);
  }
}

/**
 * Seeds the initial authoritative game state on the Host machine.
 * 
 * @param {string} code - Room code
 * @param {string} hostName - Host display name
 */
function initHostGameState(code, hostName) {
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
  renderState();
}

/**
 * Sets up incoming DataChannel message handlers for a connected client peer.
 * @param {DataConnection} conn - PeerJS connection object
 */
function setupHostClientConnection(conn) {
  conn.on('open', () => {
    conn.on('data', (msg) => {
      handleClientMessageOnHost(conn, msg);
    });
    conn.on('close', () => {
      if (app.state.phase === 'LOBBY' && conn.playerId) {
        app.state.players = app.state.players.filter(p => p.id !== conn.playerId);
        delete app.clientConns[conn.playerId];
        broadcastState();
      }
    });
  });
}

/**
 * Authoritative message router running exclusively on the Host.
 * Validates player permissions, enforces lobby-only joining, and updates state.
 * 
 * @param {DataConnection} conn
 * @param {object} msg
 */
function handleClientMessageOnHost(conn, msg) {
  if (!msg || !msg.type) return;

  // New player joining the room
  if (msg.type === 'JOIN_REQUEST') {
    // Reject mid-game joins: players can only join while host is in LOBBY
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

    const playerId = msg.playerId || ('p-' + Math.random().toString(36).slice(2, 9));
    conn.playerId = playerId;
    app.clientConns[playerId] = conn;

    let existing = app.state.players.find(p => p.id === playerId);
    if (!existing) {
      existing = {
        id: playerId,
        name: (msg.playerName || 'Player').slice(0, 24),
        isHost: false,
        isBot: false,
        score: 0,
        character: null,
        modifiers: []
      };
      app.state.players.push(existing);
      sfx.join();
      showToast(`${existing.name} joined the room!`, 'info');
    } else {
      existing.name = (msg.playerName || existing.name).slice(0, 24);
    }

    conn.send({
      type: 'JOIN_ACCEPTED',
      playerId,
      state: getPublicState()
    });
    broadcastState();
  }

  // Character submitted during Character Creation stage
  if (msg.type === 'SUBMIT_CHARACTER') {
    const p = app.state.players.find(pl => pl.id === msg.playerId);
    if (p) {
      p.character = {
        name: (msg.character.name || p.name).slice(0, 30),
        role: (msg.character.role || 'Adventurer').slice(0, 80),
        avatar: msg.character.avatar || '',
        ready: true
      };
      if (msg.character.startMod && app.state.settings.allowStartingQuirk) {
        p.modifiers = [msg.character.startMod];
      } else {
        p.modifiers = [];
      }
      sfx.lockIn();
      checkAllCharactersReady();
      broadcastState();
    }
  }

  // Character unlocked to edit
  if (msg.type === 'UNLOCK_CHARACTER') {
    const p = app.state.players.find(pl => pl.id === msg.playerId);
    if (p && p.character) {
      p.character.ready = false;
      broadcastState();
    }
  }

  // Round move submitted during Scenario stage
  if (msg.type === 'SUBMIT_ACTION') {
    if (app.state.phase === 'SCENARIO') {
      app.state.submissions[msg.playerId] = (msg.action || '').trim();
      app.state.hiddenSubmissions[msg.playerId] = true;
      sfx.lockIn();
      broadcastState();
      checkAllActionsSubmitted();
    }
  }

  // Round move unlocked to edit
  if (msg.type === 'UNLOCK_ACTION') {
    if (app.state.phase === 'SCENARIO') {
      delete app.state.submissions[msg.playerId];
      delete app.state.hiddenSubmissions[msg.playerId];
      broadcastState();
    }
  }
}

/**
 * Connects a client browser to the host's room code via PeerJS.
 */
function clientJoinRoom() {
  const code = document.getElementById('join-room-code').value.trim().toUpperCase();
  const name = document.getElementById('join-player-name').value.trim();

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
  app.myId = sessionStorage.getItem('chaos_coop_player_id') || ('p-' + Math.random().toString(36).slice(2, 9));
  sessionStorage.setItem('chaos_coop_player_id', app.myId);

  setLoadingOverlay(true, `Connecting to Room ${code}...`);

  const peer = new Peer();
  app.peer = peer;

  peer.on('open', () => {
    const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
    app.hostConn = conn;

    const timeout = setTimeout(() => {
      setLoadingOverlay(false);
      showToast(`Could not find Room ${code}. Check the code with the Host!`, 'error');
    }, 9000);

    conn.on('open', () => {
      clearTimeout(timeout);
      conn.send({
        type: 'JOIN_REQUEST',
        playerId: app.myId,
        playerName: app.myName
      });
    });

    conn.on('data', (msg) => {
      if (msg.type === 'JOIN_ACCEPTED') {
        setLoadingOverlay(false);
        app.myId = msg.playerId;
        app.state = msg.state;
        sfx.join();
        renderState();
      } else if (msg.type === 'STATE_UPDATE') {
        const prevPhase = app.state.phase;
        const prevRound = app.state.currentRound;
        const prevReveal = app.state.revealStep;
        app.state = msg.state;
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
        renderState();
      } else if (msg.type === 'JOIN_REJECTED') {
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

/**
 * Strips secret judge lore from campaign data so clients cannot read hidden clues in DevTools.
 * 
 * @param {object|null} campaign
 * @returns {object|null}
 */
function stripCampaignSecrets(campaign) {
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

/**
 * Returns a sanitized copy of the authoritative game state safe for client broadcast.
 * Masks in-progress action submissions as '__LOCKED_IN__' so teammates cannot peek,
 * and ensures actions remain hidden from other players during reveal.
 * 
 * @param {string|null} [forPlayerId] - ID of the recipient peer
 * @returns {object} Public game state payload
 */
function getPublicState(forPlayerId = null) {
  const maskedSubmissions = {};
  for (const pid of Object.keys(app.state.submissions)) {
    if (app.state.phase === 'SCENARIO') {
      maskedSubmissions[pid] = (pid === forPlayerId) ? app.state.submissions[pid] : '__LOCKED_IN__';
    } else {
      // Actions are always hidden from other players
      if (pid === forPlayerId) {
        maskedSubmissions[pid] = app.state.submissions[pid];
      } else {
        maskedSubmissions[pid] = '__SECRET_ACTION__';
      }
    }
  }

  return {
    ...app.state,
    activeCampaign: stripCampaignSecrets(app.state.activeCampaign),
    customCampaign: stripCampaignSecrets(app.state.customCampaign),
    submissions: maskedSubmissions
  };
}

/**
 * Broadcasts the current public state to all connected client peers.
 */
function broadcastState() {
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
  renderState();
}

/**
 * Gracefully leaves the active room and returns to the HOME screen.
 * Closes WebRTC connections, notifies peers with ROOM_CLOSED, and destroys Peer instance.
 */
function leaveRoomToHome() {
  clearInterval(app.timerInterval);
  stopTypewriter();

  const wasHost = app.isHost;
  const connsToClose = app.clientConns || {};
  const peerToDestroy = app.peer;
  const hostConnToClose = app.hostConn;

  app.clientConns = {};
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

// Ensure peers are notified if the tab is closed or navigated away from
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
