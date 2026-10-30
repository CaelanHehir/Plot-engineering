/**
 * WebRTC Internet Multiplayer Service (PeerJS Host & Client Room Sync)
 * 
 * Architecture:
 * - Star topology: The host is the authoritative central node with Peer ID "plot-engineering-{ROOM_CODE}".
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
const PEER_PREFIX = 'plot-engineering-';

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
 * Connects to the PeerJS signaling broker using the deterministic ID "plot-engineering-{CODE}".
 * @param {number} [retryCount=0] - Collision retry counter (max 5)
 */
function hostCreateRoom(retryCount = 0) {
  const hostNameInput = document.getElementById('host-player-name').value.trim();
  const hostName = hostNameInput || 'Host Player';
  const code = generateRoomCode();

  app.isHost = true;
  app.myName = hostName;
  app.roomCode = code;
  app.myId = 'host-' + Math.random().toString(36).slice(2, 8);

  setLoadingOverlay(true, 'Creating multiplayer room ' + code + '...');

  let opened = false; // B1: Track whether peer signaling has established

  try {
    const peerId = PEER_PREFIX + code;
    const peer = new Peer(peerId);
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
      // B1: Attempt seamless reconnect when signaling socket drops
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
        // B1: Never wipe live game state after room has successfully opened
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

      // Error occurred before open: handle collision with cap or report server failure
      if (err.type === 'unavailable-id') {
        if (retryCount < 5) {
          hostCreateRoom(retryCount + 1);
        } else {
          showToast('Room code collision. Please try again.', 'error');
          showScreen('HOME');
        }
      } else {
        showToast('Could not reach the matchmaking server. Check your connection.', 'error');
        showScreen('HOME');
      }
    });
  } catch (e) {
    setLoadingOverlay(false);
    showToast('Could not reach the matchmaking server. Check your connection.', 'error');
    showScreen('HOME');
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
      if (!conn.playerId) return;
      if (app.state.phase === 'LOBBY') {
        app.state.players = app.state.players.filter(p => p.id !== conn.playerId);
        delete app.clientConns[conn.playerId];
        broadcastState();
      } else {
        // B3: Outside LOBBY, mark disconnected so round flow is not stalled
        const p = app.state.players.find(pl => pl.id === conn.playerId);
        if (p) {
          p.disconnected = true;
          broadcastState();
          if (app.state.phase === 'CHAR_CREATE') checkAllCharactersReady();
          if (app.state.phase === 'SCENARIO') checkAllActionsSubmitted();
        }
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

  // New or rejoining player connecting to the room
  if (msg.type === 'JOIN_REQUEST') {
    // B2: Host assigns IDs: accept client ID only if it matches safe regex, else generate
    const rawId = typeof msg.playerId === 'string' ? msg.playerId.trim() : '';
    const safeProvidedId = /^[a-z0-9-]{3,24}$/i.test(rawId) ? rawId : null;

    // B3: Check if existing player is rejoining (allowed in any phase)
    let existing = safeProvidedId ? app.state.players.find(p => p.id === safeProvidedId) : null;
    if (existing) {
      const playerId = existing.id;
      conn.playerId = playerId;
      app.clientConns[playerId] = conn;
      existing.disconnected = false;
      if (msg.playerName) existing.name = msg.playerName.slice(0, 24);

      conn.send({
        type: 'JOIN_ACCEPTED',
        playerId,
        state: getPublicState(playerId)
      });
      broadcastState();
      showToast(`${existing.name} reconnected!`, 'info');
      return;
    }

    // B20: Cap room at 8 players
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

    // Reject mid-game joins for brand new players: new joins only allowed in LOBBY
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

    // B20: Ensure unique player name
    const finalName = disambiguatePlayerName(msg.playerName || 'Player', app.state.players);

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

  // Character submitted during Character Creation stage
  if (msg.type === 'SUBMIT_CHARACTER') {
    const senderId = conn.playerId; // B2: Use conn.playerId as sender identity
    if (!senderId) return;
    const p = app.state.players.find(pl => pl.id === senderId);
    if (p && msg.character) {
      let safeStartMod = null;
      if (msg.character.startMod && app.state.settings.allowStartingQuirk) {
        // B2: Sanitize starting trait fields to prevent self-assignment of meta statuses
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
      checkAllCharactersReady();
      broadcastState();
    }
  }

  // Character unlocked to edit
  if (msg.type === 'UNLOCK_CHARACTER') {
    const senderId = conn.playerId; // B2: Use conn.playerId
    if (!senderId) return;
    const p = app.state.players.find(pl => pl.id === senderId);
    if (p && p.character) {
      p.character.ready = false;
      broadcastState();
    }
  }

  // Round move submitted during Scenario stage
  if (msg.type === 'SUBMIT_ACTION') {
    const senderId = conn.playerId; // B2: Use conn.playerId
    if (!senderId) return;
    if (app.state.phase === 'SCENARIO') {
      // B2: Cap action text to 400 characters on host
      app.state.submissions[senderId] = String(msg.action || '').slice(0, 400).trim();
      app.state.hiddenSubmissions[senderId] = true;
      sfx.lockIn();
      broadcastState();
      checkAllActionsSubmitted();
    }
  }

  // Round move unlocked to edit
  if (msg.type === 'UNLOCK_ACTION') {
    const senderId = conn.playerId; // B2: Use conn.playerId
    if (!senderId) return;
    if (app.state.phase === 'SCENARIO') {
      delete app.state.submissions[senderId];
      delete app.state.hiddenSubmissions[senderId];
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
  app.myId = sessionStorage.getItem('plot_engineering_player_id') || ('p-' + Math.random().toString(36).slice(2, 9));
  sessionStorage.setItem('plot_engineering_player_id', app.myId);
  sessionStorage.setItem('plot_engineering_room_code', code);
  sessionStorage.setItem('plot_engineering_player_name', name);

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
        if (msg.state.remainingMs > 0) {
          app.timerDeadline = Date.now() + msg.state.remainingMs;
          if (!app.timerInterval) app.timerInterval = setInterval(updateTimerDisplay, 250);
        } else {
          stopTimer();
        }
        sfx.join();
        renderState();
      } else if (msg.type === 'STATE_UPDATE') {
        const prevPhase = app.state.phase;
        const prevRound = app.state.currentRound;
        const prevReveal = app.state.revealStep;
        app.state = msg.state;
        if (msg.state.remainingMs > 0) {
          app.timerDeadline = Date.now() + msg.state.remainingMs;
          if (!app.timerInterval) app.timerInterval = setInterval(updateTimerDisplay, 250);
        } else {
          stopTimer();
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
  const submissionKinds = {};

  // D1: Reveal other players' moves after judging / story when the House Rule is enabled
  const canRevealMoves = Boolean(
    app.state.settings?.revealMovesAfterStory && (
      (app.state.phase === 'REVEAL' && app.state.revealStep >= 2 && !app.state.isJudging) ||
      app.state.phase === 'GAME_OVER'
    )
  );

  // B11: Compute explicit submissionKinds map so eliminated/locked players render consistently on host and guests
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
    } else if (pid === forPlayerId || app.isHost || canRevealMoves) {
      submissionKinds[pid] = 'text';
      maskedSubmissions[pid] = app.state.submissions[pid] || '';
    } else {
      submissionKinds[pid] = 'secret';
      maskedSubmissions[pid] = app.state.phase === 'SCENARIO' ? '__LOCKED_IN__' : '__SECRET_ACTION__';
    }
  }

  const sanitizedHistory = (app.state.roundHistory || []).map(h => {
    if (app.isHost || app.state.settings?.revealMovesAfterStory) {
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

  return {
    ...app.state,
    activeCampaign: stripCampaignSecrets(app.state.activeCampaign),
    customCampaign: stripCampaignSecrets(app.state.customCampaign),
    roundHistory: sanitizedHistory,
    submissions: maskedSubmissions,
    submissionKinds
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
 * Sends a message payload to the Host via the active WebRTC DataChannel (B7).
 * Returns true if message was successfully dispatched, or false if disconnected.
 * 
 * @param {object} msg
 * @returns {boolean}
 */
function sendToHost(msg) {
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

/**
 * Reconnects a guest to a previously active room session (B3).
 */
function rejoinStoredRoom() {
  const code = sessionStorage.getItem('plot_engineering_room_code');
  const name = sessionStorage.getItem('plot_engineering_player_name') || 'Player';
  if (!code) return;
  const codeInput = document.getElementById('join-room-code');
  const nameInput = document.getElementById('join-player-name');
  if (codeInput) codeInput.value = code;
  if (nameInput) nameInput.value = name;
  clientJoinRoom();
}

/**
 * Gracefully leaves the active room and returns to the HOME screen.
 * Closes WebRTC connections, notifies peers with ROOM_CLOSED, and destroys Peer instance.
 */
function leaveRoomToHome() {
  sessionStorage.removeItem('plot_engineering_room_code');
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
