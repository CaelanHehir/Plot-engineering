// WebRTC Internet Multiplayer Service (PeerJS Host & Client Room Sync)

const PEER_PREFIX = 'chaos-coop-v1-';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

function initHostGameState(code, hostName) {
  app.state.phase = 'LOBBY';
  app.lobbyView = 'cast';
  app.state.roomCode = code;
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

function handleClientMessageOnHost(conn, msg) {
  if (!msg || !msg.type) return;

  if (msg.type === 'JOIN_REQUEST') {
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

  if (msg.type === 'UNLOCK_CHARACTER') {
    const p = app.state.players.find(pl => pl.id === msg.playerId);
    if (p && p.character) {
      p.character.ready = false;
      broadcastState();
    }
  }

  if (msg.type === 'SUBMIT_ACTION') {
    if (app.state.phase === 'SCENARIO') {
      app.state.submissions[msg.playerId] = (msg.action || '').trim();
      if (msg.hideAction) {
        app.state.hiddenSubmissions[msg.playerId] = true;
      } else {
        delete app.state.hiddenSubmissions[msg.playerId];
      }
      sfx.lockIn();
      broadcastState();
      checkAllActionsSubmitted();
    }
  }

  if (msg.type === 'UNLOCK_ACTION') {
    if (app.state.phase === 'SCENARIO') {
      delete app.state.submissions[msg.playerId];
      delete app.state.hiddenSubmissions[msg.playerId];
      broadcastState();
    }
  }
}

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
        const prevReveal = app.state.revealStep;
        app.state = msg.state;
        if (prevPhase !== 'CHAR_CREATE' && app.state.phase === 'CHAR_CREATE') {
          app.charCreateStep = 1;
          clearCharacterCanvas(false);
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

function getPublicState() {
  const maskedSubmissions = {};
  for (const pid of Object.keys(app.state.submissions)) {
    if (app.state.phase === 'SCENARIO') {
      maskedSubmissions[pid] = '__LOCKED_IN__';
    } else if (app.state.hiddenSubmissions && app.state.hiddenSubmissions[pid]) {
      maskedSubmissions[pid] = '__SECRET_ACTION__';
    } else {
      maskedSubmissions[pid] = app.state.submissions[pid];
    }
  }

  return {
    ...app.state,
    activeCampaign: stripCampaignSecrets(app.state.activeCampaign),
    customCampaign: stripCampaignSecrets(app.state.customCampaign),
    submissions: maskedSubmissions
  };
}

function broadcastState() {
  if (!app.isHost) return;
  const pubState = getPublicState();
  for (const pid of Object.keys(app.clientConns)) {
    const conn = app.clientConns[pid];
    if (conn && conn.open) {
      try {
        conn.send({ type: 'STATE_UPDATE', state: pubState });
      } catch (e) {
        console.warn('Error broadcasting to client:', e);
      }
    }
  }
  renderState();
}

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
