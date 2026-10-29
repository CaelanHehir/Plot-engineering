/**
 * Plot Engineering — Central Application State & Core Gameplay Controllers
 * 
 * Manages:
 * - Authoritative state container (app.state)
 * - Round countdown timers & intervals
 * - Character creation progression
 * - Action submissions & hidden action toggling
 * - AI evaluation triggering & score awards
 * - Room navigation, bot creation, and UI window switcher tabs
 */

/**
 * Global application singleton
 */
const app = {
  /** Whether the local client is the authoritative room Host */
  isHost: false,
  /** Local peer's unique identifier */
  myId: '',
  /** Local player's chosen display name */
  myName: '',
  /** 4-letter room code (uppercase) */
  roomCode: '',
  /** PeerJS peer instance */
  peer: null,
  /** Host connection for client peers */
  hostConn: null,
  /** Client connections dictionary for Host { [playerId]: DataConnection } */
  clientConns: {},
  /** Active tab in Host campaign setup: 'campaign' | 'settings' */
  lobbyTab: 'campaign',
  /** Active mobile sub-window on HOME screen: 'host' | 'join' */
  homeWindow: 'host',
  /** Active sub-view in LOBBY: 'cast' | 'campaign' */
  lobbyView: 'cast',
  /** Character creation stage: 1 (Name & Bio) | 2 (Portrait Sketchpad) */
  charCreateStep: 1,
  /** Whether the opening scenario popup modal is currently visible */
  scenarioPopupOpen: false,
  /** Deduplication key tracking which scenario popup has already opened */
  scenarioPopupKey: '',
  /** Active sub-window on REVEAL screen: 'story' | 'rankings' */
  revealWindow: 'story',
  /** Active sub-window on GAME_OVER screen: 'results' | 'recap' (U10) */
  gameOverWindow: 'results',

  // Authoritative State (managed by Host, synchronized to Clients)
  state: {
    /** Current game phase: HOME | LOBBY | CHAR_CREATE | SCENARIO | REVEAL | GAME_OVER */
    phase: 'HOME',
    roomCode: '',
    /** Tracks whether the host has clicked 'Set up campaign' in the lobby */
    campaignSetupStarted: false,
    /** Active campaign source: 'premade' | 'ai' | 'custom' */
    campaignMode: 'premade',
    selectedPremadeId: PREMADE_CAMPAIGNS[0].id,
    aiPrompt: '',
    aiRoundCount: 4,
    customCampaign: {
      id: 'custom-1',
      title: 'Custom campaign',
      genre: 'Custom Story',
      description: 'A custom multi-round campaign created by the Host.',
      rounds: [
        {
          title: 'The Setup',
          scenario: 'A troll in a clip-on tie blocks the stone bridge. He crosses his arms and refuses to let anyone pass.',
          secrets: 'The troll is secretly insecure about his fashion sense and loves dramatic flattery, absurd bribes, or coordinated slapstick distractions!'
        },
        {
          title: 'The Escalation',
          scenario: '',
          secrets: ''
        },
        {
          title: 'The Climax',
          scenario: '',
          secrets: ''
        }
      ]
    },
    /** Active campaign payload for the current playthrough */
    activeCampaign: null,

    // Configurable Host Settings (Default 120s / 2 minutes)
    settings: {
      roundTimer: 120,
      charCreateTimer: 0,
      strictness: 'balanced',
      allowStartingQuirk: false,
      maxModifiers: 4,
      pointsMultiplier: 1,
      revealMovesAfterStory: true
    },

    timeLeft: 0,
    remainingMs: 0,
    currentRound: 0,
    storySoFar: '',
    roundHistory: [],
    isJudging: false,
    revealStep: 1,
    players: [],
    submissions: {},
    hiddenSubmissions: {},
    submissionKinds: {},
    currentJudgment: null
  },

  /** Active setInterval reference for timers */
  timerInterval: null,
  timerDeadline: 0,

  /** Typewriter narration playback tracker */
  typewriter: {
    activeKey: '',
    timer: null,
    finished: false
  }
};

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
  initUI();
  initDrawingCanvas();
  setupDelegatedEventListeners();

  // Close top menu drawer on outside click
  document.addEventListener('click', (e) => {
    const drawer = document.getElementById('top-menu-drawer');
    const toggleBtn = document.getElementById('btn-top-menu');
    if (drawer && !drawer.classList.contains('hidden')) {
      if (!drawer.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
        closeTopMenu();
      }
    }
  });

  // Global Escape key listener to dismiss popovers and modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTopMenu();
      closeSettingsModal();
      closeApiKeyModal();
      closeQrPopup();
      if (app.scenarioPopupOpen) closeScenarioPopup();
    }
  });
});

/**
 * Sets up centralized delegated event listeners for data-action, data-bind, and data-on-enter.
 */
function setupDelegatedEventListeners() {
  // Delegated Click Dispatcher
  document.addEventListener('click', (e) => {
    // Backdrop click dismissals
    if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
      const modalId = e.target.id;
      if (modalId === 'qr-popup-modal') closeQrPopup();
      else if (modalId === 'scenario-popup-modal') closeScenarioPopup();
      else if (modalId === 'settings-modal') closeSettingsModal();
      else if (modalId === 'api-key-modal') closeApiKeyModal();
      return;
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    switch (action) {
      case 'global-back':
        handleGlobalBack();
        break;
      case 'copy-invite':
        copyInviteLink();
        break;
      case 'toggle-top-menu':
        toggleTopMenu(e);
        break;
      case 'toggle-sound':
        toggleSound();
        break;
      case 'open-api-key-modal':
        closeTopMenu();
        openApiKeyModal();
        break;
      case 'open-settings-modal':
        closeTopMenu();
        openSettingsModal();
        break;
      case 'set-home-window':
        if (actionEl.dataset.window) setHomeWindow(actionEl.dataset.window);
        break;
      case 'host-create-room':
        hostCreateRoom();
        break;
      case 'rejoin-stored-room':
        rejoinStoredRoom();
        break;
      case 'client-join-room':
        clientJoinRoom();
        break;
      case 'toggle-lobby-qr':
        toggleLobbyQrCode();
        break;
      case 'close-qr-popup':
        closeQrPopup();
        break;
      case 'add-bot-player':
        addBotPlayer();
        break;
      case 'remove-player':
        if (actionEl.dataset.playerId) removePlayer(actionEl.dataset.playerId);
        break;
      case 'open-campaign-setup':
        openLobbyCampaignSetup();
        break;
      case 'close-campaign-setup':
        closeLobbyCampaignSetup();
        break;
      case 'set-campaign-mode':
        if (actionEl.dataset.mode) setCampaignMode(actionEl.dataset.mode);
        break;
      case 'select-premade-campaign':
        if (actionEl.dataset.campaignId) selectPremadeCampaign(actionEl.dataset.campaignId);
        break;
      case 'add-custom-round':
        addCustomRound();
        break;
      case 'remove-custom-round':
        if (actionEl.dataset.roundIndex !== undefined) {
          removeCustomRound(parseInt(actionEl.dataset.roundIndex, 10));
        }
        break;
      case 'host-start-campaign':
        hostStartCampaign();
        break;
      case 'host-force-start-first-round':
        hostForceStartFirstRound();
        break;
      case 'set-char-create-step':
        if (actionEl.dataset.step) setCharCreateStep(parseInt(actionEl.dataset.step, 10));
        break;
      case 'go-to-char-portrait':
        goToCharPortraitStage();
        break;
      case 'select-brush-size':
        if (actionEl.dataset.size) selectBrushSize(parseInt(actionEl.dataset.size, 10));
        break;
      case 'toggle-eraser':
        setEraserMode(!drawState.isEraser);
        break;
      case 'undo-canvas':
        undoCanvasStroke();
        break;
      case 'clear-canvas':
        clearCharacterCanvas(true);
        break;
      case 'select-draw-color':
        if (actionEl.dataset.color) selectDrawColor(actionEl.dataset.color);
        break;
      case 'submit-character':
        submitMyCharacter();
        break;
      case 'unlock-character-edit':
        unlockMyCharacterToEdit();
        break;
      case 'host-start-first-round':
        hostStartFirstRound();
        break;
      case 'open-scenario-popup':
        openScenarioPopup();
        break;
      case 'close-scenario-popup':
        closeScenarioPopup();
        break;
      case 'host-add-extra-time':
        hostAddExtraTime(30);
        break;
      case 'host-force-evaluate-round':
        hostForceEvaluateRound();
        break;
      case 'submit-action':
        submitMyAction();
        break;
      case 'unlock-action-edit':
        unlockMyActionToEdit();
        break;
      case 'skip-story':
        skipStoryTypewriter();
        break;
      case 'host-next-reveal-step':
        hostNextRevealStep();
        break;
      case 'set-reveal-window':
        if (actionEl.dataset.window) setRevealWindow(actionEl.dataset.window);
        break;
      case 'host-back-lobby':
        hostBackToLobby();
        break;
      case 'set-gameover-window':
        if (actionEl.dataset.window) setGameOverWindow(actionEl.dataset.window);
        break;
      case 'close-settings-modal':
        closeSettingsModal();
        break;
      case 'close-api-key-modal':
        closeApiKeyModal();
        break;
      case 'toggle-api-key-visibility':
        toggleApiKeyVisibility();
        break;
      case 'save-api-key':
        saveApiKeyFromModal();
        break;
      default:
        break;
    }
  });

  // Delegated Input Dispatcher
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'scenario-action-input') {
      if (typeof updateScenarioWordCount === 'function') {
        updateScenarioWordCount();
      }
    }
    const bindEl = e.target.closest('[data-bind]');
    if (!bindEl) return;
    const bind = bindEl.dataset.bind;
    if (bind === 'ai-prompt') {
      if (app.isHost) app.state.aiPrompt = bindEl.value;
    } else if (bind === 'custom-campaign-title') {
      if (app.isHost) app.state.customCampaign.title = bindEl.value;
    } else if (bind === 'custom-campaign-description') {
      if (app.isHost) app.state.customCampaign.description = bindEl.value;
    } else if (bind === 'custom-round-title') {
      if (app.isHost) {
        const idx = parseInt(bindEl.dataset.roundIndex, 10);
        if (app.state.customCampaign?.rounds?.[idx]) {
          app.state.customCampaign.rounds[idx].title = bindEl.value;
        }
      }
    } else if (bind === 'custom-round-scenario') {
      if (app.isHost) {
        const idx = parseInt(bindEl.dataset.roundIndex, 10);
        if (app.state.customCampaign?.rounds?.[idx]) {
          app.state.customCampaign.rounds[idx].scenario = bindEl.value;
        }
      }
    } else if (bind === 'custom-round-secrets') {
      if (app.isHost) {
        const idx = parseInt(bindEl.dataset.roundIndex, 10);
        if (app.state.customCampaign?.rounds?.[idx]) {
          app.state.customCampaign.rounds[idx].secrets = bindEl.value;
        }
      }
    }
  });

  // Delegated Change Dispatcher
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'chk-disable-scenario-popup') {
      localStorage.setItem('plot_engineering_disable_scenario_popup', String(e.target.checked));
    }
    const bindEl = e.target.closest('[data-bind]');
    if (!bindEl) return;
    const bind = bindEl.dataset.bind;
    if (bind === 'ai-round-count') {
      if (app.isHost) {
        app.state.aiRoundCount = parseInt(bindEl.value, 10) || 4;
        broadcastState();
      }
    } else if (bind === 'host-setting') {
      const key = bindEl.dataset.settingKey;
      if (key) {
        const val = bindEl.type === 'checkbox' ? bindEl.checked : bindEl.value;
        updateHostSetting(key, val);
      }
    }
  });

  // Delegated Enter Key Dispatcher
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const enterEl = e.target.closest('[data-on-enter]');
    if (!enterEl) return;
    e.preventDefault();
    const action = enterEl.dataset.onEnter;
    if (action === 'host-create-room') {
      hostCreateRoom();
    } else if (action === 'client-join-room') {
      clientJoinRoom();
    }
  });
}

/** Toggles the top menu drawer popover */
function toggleTopMenu(e) {
  if (e) e.stopPropagation();
  const drawer = document.getElementById('top-menu-drawer');
  const btn = document.getElementById('btn-top-menu');
  if (!drawer) return;
  const willOpen = drawer.classList.contains('hidden');
  drawer.classList.toggle('hidden', !willOpen);
  if (btn) {
    btn.setAttribute('aria-expanded', String(willOpen));
    btn.textContent = willOpen ? '✕ Close' : '☰ Menu';
  }
}

/** Closes the top menu drawer popover */
function closeTopMenu() {
  const drawer = document.getElementById('top-menu-drawer');
  const btn = document.getElementById('btn-top-menu');
  if (drawer) drawer.classList.add('hidden');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '☰ Menu';
  }
}

/**
 * Bootstraps the UI on page load:
 * - Checks URL for invite parameters (?room=CODE)
 * - Restores sound settings
 * - Restores and verifies saved Gemini API key
 * - Initializes settings grids and screen window tabs
 */
async function initUI() {
  updateMuteButton();

  const params = new URLSearchParams(window.location.search);
  const roomParam = (params.get('room') || '').trim().toUpperCase();
  if (roomParam) {
    const cleanCode = roomParam.slice(0, 4);
    const joinInput = document.getElementById('join-room-code');
    if (joinInput) joinInput.value = cleanCode;
    const inviteBanner = document.getElementById('invite-room-banner');
    if (inviteBanner) {
      inviteBanner.classList.remove('hidden');
      inviteBanner.innerHTML = `Joining room <strong>${escapeHtml(cleanCode)}</strong>. Enter your nickname below.`;
    }
    const joinCard = document.getElementById('home-join-card');
    if (joinCard) joinCard.classList.add('card-highlight');
    app.homeWindow = 'join';
    const nameInput = document.getElementById('join-player-name');
    if (nameInput) setTimeout(() => nameInput.focus(), 80);
  }

  renderHomeWindow();
  renderCampaignSelector();
  renderSettingsGrids();

  // B3: Display prompt to rejoin previously active room session if stored
  const storedRoom = sessionStorage.getItem('plot_engineering_room_code');
  const storedId = sessionStorage.getItem('plot_engineering_player_id');
  if (storedRoom && storedId) {
    const rejoinBanner = document.getElementById('rejoin-room-banner');
    const rejoinCodeEl = document.getElementById('rejoin-room-code');
    if (rejoinBanner && rejoinCodeEl) {
      rejoinCodeEl.textContent = storedRoom;
      rejoinBanner.classList.remove('hidden');
    }
  }

  // B4: Do not validate over network on page load (flaky offline connections must not wipe keys)
  const savedKey = getStoredApiKey();
  const keyInput = document.getElementById('api-key-input');
  if (savedKey) {
    if (keyInput) keyInput.value = savedKey;
    updateApiKeyBadge(true);
  } else {
    if (keyInput) keyInput.value = '';
    updateApiKeyBadge(false);
  }

  renderState();
}

// --- Navigation & Timer Helpers ---

/**
 * Handles the top-left contextual back button.
 * Prompts confirmation and leaves the room or returns the host to the lobby.
 */
function handleGlobalBack() {
  const phase = app.state.phase;
  if (phase === 'HOME') return;

  if (!app.isHost) {
    if (confirm('Leave this room and return to the Home screen?')) {
      leaveRoomToHome();
    }
    return;
  }

  if (phase === 'LOBBY') {
    if (confirm('Close this room and return to the Home screen?')) {
      leaveRoomToHome();
    }
  } else if (phase === 'CHAR_CREATE') {
    hostBackToLobby();
  } else if (phase === 'SCENARIO' || phase === 'REVEAL' || phase === 'GAME_OVER') {
    if (confirm('Return everyone to the Room Lobby? (Connected players will stay in the room)')) {
      hostBackToLobby();
    }
  }
}

/**
 * Returns all connected players back to the Room Lobby.
 */
function hostBackToLobby() {
  if (!app.isHost) return;
  clearInterval(app.timerInterval);
  stopTypewriter();
  app.state.isJudging = false;
  app.state.phase = 'LOBBY';
  app.lobbyView = 'cast';
  broadcastState();
}

/**
 * Starts or synchronizes a timestamp-based countdown timer (B8).
 * Avoids per-second full state broadcasts and background tab drift.
 * @param {number} seconds
 */
function startTimer(seconds) {
  stopTimer();
  app.charTimerWarned10s = false;
  if (seconds <= 0) {
    app.state.remainingMs = 0;
    app.state.timeLeft = 0;
    app.timerDeadline = 0;
    return;
  }
  app.state.remainingMs = seconds * 1000;
  app.state.timeLeft = seconds;
  app.timerDeadline = Date.now() + app.state.remainingMs;
  app.timerInterval = setInterval(updateTimerDisplay, 250);
}

function stopTimer() {
  if (app.timerInterval) {
    clearInterval(app.timerInterval);
    app.timerInterval = null;
  }
  app.timerDeadline = 0;
}

function updateTimerDisplay() {
  if (!app.timerDeadline) return;
  const msLeft = Math.max(0, app.timerDeadline - Date.now());
  const secondsLeft = Math.ceil(msLeft / 1000);
  app.state.timeLeft = secondsLeft;

  // B8: Update only timer elements directly rather than re-rendering whole screen
  const charTimerEl = document.getElementById('char-create-timer');
  if (charTimerEl && app.state.phase === 'CHAR_CREATE') {
    charTimerEl.textContent = formatSeconds(secondsLeft);
    // B21: Warning toast at 10 seconds for character creation timer
    if (secondsLeft <= 10 && secondsLeft > 0 && !app.charTimerWarned10s) {
      app.charTimerWarned10s = true;
      showToast('10 seconds left! Unfinished characters will be auto-filled.', 'warn');
    }
  }
  const scenTimerEl = document.getElementById('scenario-timer');
  if (scenTimerEl && app.state.phase === 'SCENARIO') {
    scenTimerEl.textContent = formatSeconds(secondsLeft);
    scenTimerEl.classList.toggle('timer-urgent', secondsLeft <= 20);
  }

  // Host checks deadline
  if (app.isHost && msLeft <= 0) {
    stopTimer();
    if (app.state.phase === 'CHAR_CREATE') {
      hostForceStartFirstRound();
    } else if (app.state.phase === 'SCENARIO') {
      hostForceEvaluateRound();
    }
  }
}

/**
 * Host utility to add overtime (default +30 seconds) to the active round countdown.
 * @param {number} seconds
 */
function hostAddExtraTime(seconds = 30) {
  if (!app.isHost || app.state.phase !== 'SCENARIO') return;
  const currentRemaining = Math.max(0, (app.timerDeadline || Date.now()) - Date.now());
  const newRemaining = currentRemaining + (seconds * 1000);
  app.state.remainingMs = newRemaining;
  app.state.timeLeft = Math.ceil(newRemaining / 1000);
  app.timerDeadline = Date.now() + newRemaining;
  showToast(`Added +${seconds} seconds to the round timer!`, 'info');
  broadcastState();
}

/**
 * Copies the full room invite link to the clipboard.
 * B17: Guards against missing navigator.clipboard on insecure HTTP origins.
 */
function copyInviteLink() {
  const inviteUrl = getRoomInviteUrl(app.state.roomCode);

  const onCopySuccess = () => {
    if (isLocalhost()) {
      showToast('Invite link copied. Note: Friends cannot reach localhost; share your deployed URL or your LAN address.', 'info');
    } else {
      showToast('Invite link copied', 'success');
    }
  };

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(inviteUrl)
      .then(onCopySuccess)
      .catch(() => fallbackCopyText(inviteUrl, onCopySuccess));
  } else {
    fallbackCopyText(inviteUrl, onCopySuccess);
  }
}

/**
 * Fallback copy using a temporary input element for non-secure HTTP / LAN origins (B17).
 * @param {string} text
 * @param {Function} [onSuccess]
 */
function fallbackCopyText(text, onSuccess) {
  try {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.setAttribute('readonly', '');
    tempInput.style.position = 'fixed';
    tempInput.style.left = '-9999px';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(tempInput);
    if (copied) {
      if (onSuccess) onSuccess();
      return;
    }
  } catch (err) {
    console.warn('Fallback clipboard copy failed:', err);
  }
  showToast(`Invite Link: ${text}`, 'info');
}

/** Toggles the in-lobby QR code modal for mobile joining */
function toggleLobbyQrCode() {
  const modal = document.getElementById('qr-popup-modal');
  if (!modal) return;
  if (modal.classList.contains('hidden')) {
    openAccessibleModal('qr-popup-modal');
  } else {
    closeAccessibleModal('qr-popup-modal');
  }
}

/** Closes the QR code modal */
function closeQrPopup() {
  closeAccessibleModal('qr-popup-modal');
}

// --- Multi-Window Switcher Controllers ---

/**
 * Switches the active sub-window on the HOME screen on mobile.
 * @param {'host'|'join'} win
 */
function setHomeWindow(win) {
  app.homeWindow = win === 'join' ? 'join' : 'host';
  renderHomeWindow();
}

/** Renders the HOME screen cards based on active mobile tab */
function renderHomeWindow() {
  const win = app.homeWindow === 'join' ? 'join' : 'host';
  const hostCard = document.getElementById('home-host-card');
  const joinCard = document.getElementById('home-join-card');
  const btnHost = document.getElementById('home-win-btn-host');
  const btnJoin = document.getElementById('home-win-btn-join');
  if (hostCard) hostCard.classList.toggle('mobile-window-hidden', win !== 'host');
  if (joinCard) joinCard.classList.toggle('mobile-window-hidden', win !== 'join');
  if (btnHost) btnHost.classList.toggle('active', win === 'host');
  if (btnJoin) btnJoin.classList.toggle('active', win === 'join');
}

/** Host opens the Campaign Setup sub-view in the lobby */
function openLobbyCampaignSetup() {
  if (!app.isHost) return;
  app.lobbyView = 'campaign';
  app.state.campaignSetupStarted = true;
  broadcastState();
  renderLobbyScreen();
}

/** Host returns to the Cast Roster sub-view in the lobby */
function closeLobbyCampaignSetup() {
  app.lobbyView = 'cast';
  renderLobbyScreen();
}

/**
 * Switches the active sub-window on the REVEAL screen on mobile.
 * @param {'story'|'rankings'} win
 */
function setRevealWindow(win) {
  app.revealWindow = win === 'rankings' ? 'rankings' : 'story';
  if (app.state.currentJudgment && app.typewriter.finished) {
    showPostStoryVerdictAndLeaderboard(app.state.currentJudgment);
  }
}

/**
 * Switches the active sub-window on the GAME_OVER screen on mobile.
 * @param {'results'|'recap'} win
 */
function setGameOverWindow(win) {
  app.gameOverWindow = (win === 'recap') ? 'recap' : 'results';
  renderGameOverScreen();
}

// --- Lobby Roster & Campaign Configuration ---

/**
 * Spawns an AI bot player with a random character profile from RANDOM_CHARACTERS
 * and an auto-generated procedural cartoon portrait.
 */
function addBotPlayer() {
  if (!app.isHost) return;
  // B20: Cap room at 8 players
  if (app.state.players.length >= 8) {
    showToast('The room is full (maximum 8 players).', 'warn');
    return;
  }
  const botCount = app.state.players.filter(p => p.isBot).length;
  const template = RANDOM_CHARACTERS[(botCount + Math.floor(Math.random() * RANDOM_CHARACTERS.length)) % RANDOM_CHARACTERS.length];
  const botId = 'bot-' + Math.random().toString(36).slice(2, 7);
  const botPortrait = generateProceduralPortraitDataUrl();
  const botName = disambiguatePlayerName(`${template.name.split(' ')[0]} (Bot)`, app.state.players);

  app.state.players.push({
    id: botId,
    name: botName,
    isHost: false,
    isBot: true,
    score: 0,
    character: {
      name: template.name,
      role: template.role,
      avatar: botPortrait,
      ready: true
    },
    modifiers: (template.startMod && app.state.settings.allowStartingQuirk) ? [{ ...template.startMod }] : []
  });
  sfx.join();
  broadcastState();
}

/**
 * Host kicks/removes a player or bot from the lobby.
 * @param {string} playerId
 */
function removePlayer(playerId) {
  if (!app.isHost) return;
  app.state.players = app.state.players.filter(p => p.id !== playerId);
  if (app.clientConns[playerId]) {
    const conn = app.clientConns[playerId];
    delete app.clientConns[playerId];
    try {
      if (conn.open) {
        conn.send({ type: 'ROOM_CLOSED', reason: 'You were removed from the room by the Host.' });
      }
    } catch (e) {}
    setTimeout(() => {
      try { conn.close(); } catch (e) {}
    }, 80);
  }
  broadcastState();
}

/**
 * Selects campaign origin mode ('premade' | 'ai' | 'custom').
 * @param {'premade'|'ai'|'custom'} mode
 */
function setCampaignMode(mode) {
  if (!app.isHost) return;
  app.state.campaignMode = mode;
  renderCampaignSelector();
  broadcastState();
}

/**
 * Selects a premade campaign ID.
 * @param {string} id
 */
function selectPremadeCampaign(id) {
  if (!app.isHost) return;
  app.state.selectedPremadeId = id;
  renderCampaignSelector();
  broadcastState();
}

/** Adds an empty round block to the custom campaign editor */
function addCustomRound() {
  app.state.customCampaign.rounds.push({
    title: `Round ${app.state.customCampaign.rounds.length + 1}: New Challenge`,
    scenario: '',
    secrets: ''
  });
  renderCampaignSelector();
  broadcastState();
}

/**
 * Removes a round from the custom campaign editor.
 * @param {number} idx
 */
function removeCustomRound(idx) {
  if (app.state.customCampaign.rounds.length <= 1) return;
  app.state.customCampaign.rounds.splice(idx, 1);
  renderCampaignSelector();
  broadcastState();
}

/**
 * Launches the selected campaign and transitions all players to CHAR_CREATE phase.
 */
async function hostStartCampaign() {
  if (!app.isHost) return;

  let chosenCampaign = null;

  if (app.state.campaignMode === 'premade') {
    const found = PREMADE_CAMPAIGNS.find(c => c.id === app.state.selectedPremadeId) || PREMADE_CAMPAIGNS[0];
    chosenCampaign = JSON.parse(JSON.stringify(found));
  } else if (app.state.campaignMode === 'custom') {
    const customTitleInput = document.getElementById('custom-camp-title');
    const customDescInput = document.getElementById('custom-camp-desc');
    app.state.customCampaign.title = (customTitleInput ? customTitleInput.value.trim() : '') || 'Custom campaign';
    app.state.customCampaign.description = (customDescInput ? customDescInput.value.trim() : '') || 'Survive each round together!';

    // B6: Validate that every custom round has at least 15 characters of scene text
    for (let i = 0; i < app.state.customCampaign.rounds.length; i++) {
      const r = app.state.customCampaign.rounds[i];
      const scenarioText = (r.scenario || '').trim();
      if (scenarioText.length < 15) {
        showToast(`Round ${i + 1} needs a scene description (at least 15 characters).`, 'error');
        setCampaignMode('custom');
        const targetTextarea = document.getElementById(`custom-round-scenario-${i}`);
        if (targetTextarea) {
          targetTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetTextarea.focus();
        }
        return;
      }
    }
    chosenCampaign = JSON.parse(JSON.stringify(app.state.customCampaign));
  } else if (app.state.campaignMode === 'ai') {
    const promptInput = document.getElementById('ai-campaign-prompt').value.trim();
    const roundCount = parseInt(document.getElementById('ai-round-count').value, 10) || 4;
    if (!promptInput) {
      showToast('Please enter a theme or idea for the AI Campaign!', 'error');
      return;
    }
    if (!getStoredApiKey() || !isApiKeyVerified) {
      showToast('Add an AI key to generate a campaign (Menu > AI key).', 'error');
      openApiKeyModal();
      return;
    }

    const abortCtrl = new AbortController();
    setLoadingOverlay(true, 'Writing your campaign...', () => {
      abortCtrl.abort();
    });
    try {
      chosenCampaign = await generateCampaignWithAI(promptInput, roundCount, { signal: abortCtrl.signal });
      updateApiKeyBadge(true);
      setLoadingOverlay(false);
    } catch (err) {
      setLoadingOverlay(false);
      showToast(friendlyAiError(err), 'error');
      return;
    }
  }

  app.state.activeCampaign = chosenCampaign;
  app.state.currentRound = 0;
  app.state.storySoFar = '';
  app.state.roundHistory = [];
  app.state.submissions = {};
  app.state.hiddenSubmissions = {};
  app.state.isJudging = false;

  app.state.players.forEach(p => {
    p.score = 0;
    if (!p.isBot) {
      p.character = null;
      p.modifiers = [];
    }
  });

  app.state.phase = 'CHAR_CREATE';
  app.charCreateStep = 1;
  clearCharacterCanvas(false);
  const actionInput = document.getElementById('scenario-action-input');
  if (actionInput) actionInput.value = '';

  // B8: Use timestamp deadline timer rather than broadcasting every second
  startTimer(Number(app.state.settings.charCreateTimer) || 0);

  sfx.stepReveal();
  broadcastState();
}

/**
 * Host force-starts Round 1 immediately, auto-filling any incomplete player characters.
 */
function hostForceStartFirstRound() {
  if (!app.isHost) return;
  clearInterval(app.timerInterval);
  app.state.players.forEach(p => {
    if (!p.character || !p.character.ready) {
      const sample = RANDOM_CHARACTERS[Math.floor(Math.random() * RANDOM_CHARACTERS.length)];
      p.character = {
        name: p.character?.name || p.name,
        role: p.character?.role || sample.role,
        avatar: p.character?.avatar || generateProceduralPortraitDataUrl(),
        ready: true
      };
    }
  });
  startScenarioRound(0);
}

// --- Character Creation Controllers ---

/**
 * Toggles between Stage 1 (Bio) and Stage 2 (Sketchpad) during character creation.
 * @param {1|2} step
 */
function setCharCreateStep(step) {
  app.charCreateStep = step === 2 ? 2 : 1;
  sfx.stepReveal();
  renderCharCreateScreen();
  // B8: Sync canvas container on step transition, not on every render
  if (app.charCreateStep === 2 && typeof syncCanvasToContainer === 'function') {
    requestAnimationFrame(() => syncCanvasToContainer(true));
  }
}

/**
 * Advances to Stage 2 (Portrait sketchpad canvas).
 * Allows transitioning before bio is completed so players can draw first.
 */
function goToCharPortraitStage() {
  app.charCreateStep = 2;
  sfx.stepReveal();
  renderCharCreateScreen();
  if (typeof syncCanvasToContainer === 'function') {
    requestAnimationFrame(() => syncCanvasToContainer(true));
  }
}

/**
 * Submits the local player's character profile and portrait artwork.
 * Broadcasts or transmits SUBMIT_CHARACTER to host.
 */
function submitMyCharacter() {
  const name = document.getElementById('char-name-input').value.trim();
  const role = document.getElementById('char-role-input').value.trim();
  const quirkRaw = (document.getElementById('char-quirk-input')?.value || '').trim();

  if (!name) {
    showToast('Give your character a name!', 'error');
    setCharCreateStep(1);
    document.getElementById('char-name-input')?.focus();
    return;
  }
  if (!role) {
    showToast("Describe your character's role, class, or vibe!", 'error');
    setCharCreateStep(1);
    document.getElementById('char-role-input')?.focus();
    return;
  }

  let avatarDataUrl = '';
  if (drawState.canvas && drawState.hasDrawn) {
    avatarDataUrl = exportCompactAvatar(drawState.canvas);
  } else {
    // B19: Blank portrait auto-generates procedural cartoon portrait
    avatarDataUrl = generateProceduralPortraitDataUrl();
    showToast('No drawing, so we picked a portrait for you', 'info');
  }

  let startMod = null;
  if (quirkRaw && app.state.settings.allowStartingQuirk) {
    const parts = quirkRaw.split(':');
    startMod = {
      name: parts[0].trim().slice(0, 32),
      type: 'neutral',
      metaEffect: 'NONE',
      description: (parts[1] ? parts.slice(1).join(':').trim() : 'Starting character trait/item').slice(0, 80)
    };
  }

  const charData = {
    name,
    role,
    avatar: avatarDataUrl,
    startMod
  };

  if (app.isHost) {
    const me = app.state.players.find(p => p.id === app.myId);
    if (me) {
      me.character = { name, role, avatar: avatarDataUrl, ready: true };
      me.modifiers = startMod ? [startMod] : [];
    }
    sfx.lockIn();
    checkAllCharactersReady();
    broadcastState();
  } else {
    // B7: Disallow optimistic local state update unless sendToHost succeeds
    const sent = sendToHost({
      type: 'SUBMIT_CHARACTER',
      playerId: app.myId,
      character: charData
    });
    if (sent) {
      const me = app.state.players.find(p => p.id === app.myId);
      if (me) {
        me.character = { name, role, avatar: avatarDataUrl, ready: true };
      }
      sfx.lockIn();
      renderState();
    }
  }
}

/**
 * Unlocks the local player's character so they can edit bio or redraw portrait.
 */
function unlockMyCharacterToEdit() {
  if (app.isHost) {
    const me = app.state.players.find(p => p.id === app.myId);
    if (me && me.character) {
      me.character.ready = false;
    }
    broadcastState();
  } else {
    // B7: Guard action unlock with sendToHost
    const sent = sendToHost({
      type: 'UNLOCK_CHARACTER',
      playerId: app.myId
    });
    if (sent) {
      const me = app.state.players.find(p => p.id === app.myId);
      if (me && me.character) {
        me.character.ready = false;
      }
      renderState();
    }
  }
}

/**
 * Checks if all connected players have submitted ready characters.
 * Stops the character creation timer and notifies connected players so the host can start the campaign.
 */
function checkAllCharactersReady() {
  if (!app.isHost) return;
  // B3: Ignore disconnected players so offline guests do not stall character creation
  const activePlayers = app.state.players.filter(p => !p.disconnected);
  const allReady = activePlayers.length > 0 && activePlayers.every(p => p.character && p.character.ready);
  if (allReady) {
    clearInterval(app.timerInterval);
  }
  broadcastState();
}

/**
 * Host manually launches the campaign round 1 once all characters are locked in.
 */
function hostStartFirstRound() {
  if (!app.isHost) return;
  clearInterval(app.timerInterval);
  startScenarioRound(0);
}

// --- Scenario Round & Action Submission Controllers ---

/** Opens the full scenario description popup modal */
function openScenarioPopup() {
  app.scenarioPopupOpen = true;
  const chk = document.getElementById('chk-disable-scenario-popup');
  if (chk) {
    chk.checked = localStorage.getItem('plot_engineering_disable_scenario_popup') === 'true';
  }
  openAccessibleModal('scenario-popup-modal');
}

/** Closes the full scenario description popup modal */
function closeScenarioPopup() {
  const chk = document.getElementById('chk-disable-scenario-popup');
  if (chk) {
    localStorage.setItem('plot_engineering_disable_scenario_popup', String(chk.checked));
  }
  app.scenarioPopupOpen = false;
  closeAccessibleModal('scenario-popup-modal');
}

/**
 * Initiates a new scenario round:
 * - Resets submissions and triggers opening scenario popup
 * - Auto-populates submissions for eliminated or locked-out players
 * - Simulates AI bot actions
 * - Starts the round action countdown timer
 * 
 * @param {number} roundIndex - 0-based act index
 */
function startScenarioRound(roundIndex) {
  if (!app.isHost) return;
  stopTypewriter();
  app.state.currentRound = roundIndex;
  app.state.submissions = {};
  app.state.hiddenSubmissions = {};
  app.state.currentJudgment = null;
  app.state.isJudging = false;
  app.state.phase = 'SCENARIO';
  app.scenarioPopupKey = '';
  app.scenarioPopupOpen = true;

  const actionInput = document.getElementById('scenario-action-input');
  if (actionInput) actionInput.value = '';

  app.state.players.forEach(p => {
    const deadMod = getPlayerMetaMod(p, 'DEAD');
    const skipMod = getPlayerMetaMod(p, 'SKIP_TURN');
    if (deadMod) {
      app.state.submissions[p.id] = '(DEAD — Eliminated from the campaign)';
    } else if (skipMod) {
      app.state.submissions[p.id] = `(LOCKED OUT THIS TURN [${skipMod.name}] — Cannot act unless rescued by a teammate!)`;
    } else if (p.disconnected) {
      // B3: Auto-fill move for disconnected players so the round can proceed
      app.state.submissions[p.id] = '(Was away)';
    } else if (p.isBot) {
      app.state.submissions[p.id] = generateBotAction(p);
    }
  });

  // B8: Use timestamp deadline timer rather than broadcasting every second
  startTimer(Number(app.state.settings.roundTimer) || 0);

  sfx.stepReveal();
  broadcastState();
  checkAllActionsSubmitted();
}

/**
 * Procedurally generates an in-character action for an AI bot player.
 * @param {object} bot - Bot player object
 * @returns {string} Comedic action sentence
 */
function generateBotAction(bot) {
  const mods = bot.modifiers || [];
  const modNote = mods.length > 0 ? ` while dealing with my "${mods[0].name}"` : '';
  const botActions = [
    `As ${bot.character.name}, I create a loud distraction${modNote} so the others can sneak past, then grab the nearest heavy object as a shield!`,
    `I use my background as a ${bot.character.role}${modNote} to improvise a tool from the surroundings and rush straight toward the main objective!`,
    `I try to sweet-talk or bluff our way out of danger${modNote}, while secretly gesturing for someone else to hit the override switch.`,
    `I dive behind cover${modNote} and rig up a makeshift booby trap using whatever props are in the room!`
  ];
  return botActions[Math.floor(Math.random() * botActions.length)];
}

/**
 * Submits the local player's move for the current scenario.
 * Validates word count if WORD_LIMIT restriction is active.
 */
function submitMyAction() {
  const me = app.state.players.find(p => p.id === app.myId);
  if (getPlayerMetaMod(me, 'DEAD') || getPlayerMetaMod(me, 'SKIP_TURN')) {
    return;
  }

  const input = document.getElementById('scenario-action-input');
  const action = (input ? input.value : '').trim();

  if (!action) {
    showToast('Write what your character does first!', 'error');
    return;
  }

  const wordLimitMod = getPlayerMetaMod(me, 'WORD_LIMIT');
  if (wordLimitMod) {
    const wordCount = action.split(/\s+/).filter(Boolean).length;
    if (wordCount > 5) {
      showToast(`"${wordLimitMod.name}" active: you can only use up to 5 words (you wrote ${wordCount}).`, 'error');
      return;
    }
  }

  if (app.isHost) {
    app.state.submissions[app.myId] = action;
    app.state.hiddenSubmissions[app.myId] = true;
    sfx.lockIn();
    broadcastState();
    checkAllActionsSubmitted();
  } else {
    // B7: Guard action submission with sendToHost
    const sent = sendToHost({
      type: 'SUBMIT_ACTION',
      playerId: app.myId,
      action
    });
    if (sent) {
      app.state.submissions[app.myId] = '__LOCKED_IN__';
      app.state.hiddenSubmissions[app.myId] = true;
      sfx.lockIn();
      renderState();
    }
  }
}

/**
 * Unlocks the player's locked-in move to allow editing before the round ends.
 */
function unlockMyActionToEdit() {
  const me = app.state.players.find(p => p.id === app.myId);
  if (getPlayerMetaMod(me, 'DEAD') || getPlayerMetaMod(me, 'SKIP_TURN')) {
    showToast('You cannot act this turn due to your active status effect!', 'warn');
    return;
  }
  if (app.isHost) {
    delete app.state.submissions[app.myId];
    delete app.state.hiddenSubmissions[app.myId];
    broadcastState();
  } else {
    // B7: Guard action unlock with sendToHost
    const sent = sendToHost({
      type: 'UNLOCK_ACTION',
      playerId: app.myId
    });
    if (sent) {
      delete app.state.submissions[app.myId];
      delete app.state.hiddenSubmissions[app.myId];
      renderState();
    }
  }
}

/**
 * Checks whether all connected players have submitted an action.
 * Automatically initiates evaluation if everyone is locked in.
 */
function checkAllActionsSubmitted() {
  if (!app.isHost) return;
  // B3: Ignore disconnected players so offline guests do not stall round evaluation
  const activePlayers = app.state.players.filter(p => !p.disconnected);
  const allSubmitted = activePlayers.length > 0 && activePlayers.every(p => Boolean(app.state.submissions[p.id]));
  if (allSubmitted) {
    clearInterval(app.timerInterval);
    evaluateCurrentRound();
  }
}

/**
 * Host force-evaluates the round immediately when timer expires or button is clicked.
 */
function hostForceEvaluateRound() {
  if (!app.isHost) return;
  clearInterval(app.timerInterval);
  evaluateCurrentRound();
}

// --- Round Judging & Reveal Flow ---

/**
 * Executes round evaluation via Gemini (or fallback demo judge):
 * 1. Switches phase to REVEAL Step 1 (speech bubbles visible).
 * 2. Sends prompt with player profiles, active injuries/perks, and actions.
 * 3. Normalizes outcome, updates player scores, applies/cures modifiers.
 * 4. Appends to story continuity log and broadcasts to clients.
 */
async function evaluateCurrentRound() {
  if (!app.isHost || app.state.isJudging) return;

  stopTypewriter();
  app.state.phase = 'REVEAL';
  app.state.revealStep = 1;
  app.state.isJudging = true;
  app.state.currentJudgment = null;
  sfx.stepReveal();
  broadcastState();

  const roundIndex = app.state.currentRound;
  const campaign = app.state.activeCampaign;
  const roundObj = campaign.rounds[roundIndex];
  const apiKey = getStoredApiKey();

  let judgment = null;
  if (apiKey && isApiKeyVerified) {
    try {
      judgment = await judgeRoundWithAI({
        campaign,
        roundIndex,
        totalRounds: campaign.rounds.length,
        scenarioText: roundObj.scenario,
        scenarioSecrets: roundObj.secrets || '',
        storySoFar: app.state.storySoFar,
        players: app.state.players,
        submissions: app.state.submissions,
        settings: app.state.settings,
        apiKey
      });
      updateApiKeyBadge(true);
    } catch (err) {
      console.warn('Initial AI judging error:', err);
      // B12: Retry once with short delay on rate limit or 503
      const isRetryable = err?.message?.includes('429') || err?.message?.includes('503') || err?.code === 'RATE';
      if (isRetryable) {
        await new Promise(r => setTimeout(r, 1500));
        try {
          judgment = await judgeRoundWithAI({
            campaign,
            roundIndex,
            totalRounds: campaign.rounds.length,
            scenarioText: roundObj.scenario,
            scenarioSecrets: roundObj.secrets || '',
            storySoFar: app.state.storySoFar,
            players: app.state.players,
            submissions: app.state.submissions,
            settings: app.state.settings,
            apiKey
          });
          updateApiKeyBadge(true);
        } catch (retryErr) {
          console.warn('Retry AI judging error:', retryErr);
        }
      }

      if (!judgment) {
        judgment = mockJudgeRound({
          players: app.state.players,
          submissions: app.state.submissions,
          settings: app.state.settings
        });
        judgment.judgeNotice = 'The AI judge was unavailable, so a fallback judge decided this round.';
      }
    }
  } else {
    await new Promise(r => setTimeout(r, 1500));
    judgment = mockJudgeRound({
      players: app.state.players,
      submissions: app.state.submissions,
      settings: app.state.settings
    });
  }

  if (app.state.phase !== 'REVEAL') return;

  const maxMods = Number(app.state.settings.maxModifiers) || 99;
  const roundFailed = judgment.outcome === 'FAILED';

  for (const rankItem of judgment.rankings) {
    const player = app.state.players.find(p => p.id === rankItem.playerId);
    if (!player) continue;

    if (roundFailed) {
      rankItem.teamBonus = 0;
      rankItem.rankBonus = 0;
      rankItem.pointsAwarded = 0;
      rankItem.modifiersAdded = [];
      rankItem.modifiersRemoved = [];
      continue;
    }

    player.score = (player.score || 0) + (rankItem.pointsAwarded || 0);

    // Expire 1-turn meta restrictions that were served this round
    player.modifiers = (player.modifiers || []).filter(m => {
      if (['SKIP_TURN', 'WORD_LIMIT', 'BLINDED_SCENARIO'].includes(m.metaEffect)) {
        return false;
      }
      return true;
    });

    if (Array.isArray(rankItem.modifiersRemoved) && rankItem.modifiersRemoved.length > 0) {
      const removeSet = new Set(rankItem.modifiersRemoved.map(n => n.toLowerCase()));
      player.modifiers = (player.modifiers || []).filter(m => !removeSet.has(m.name.toLowerCase()));
    }

    if (Array.isArray(rankItem.modifiersAdded)) {
      for (const mod of rankItem.modifiersAdded) {
        if (mod && mod.name) {
          const exists = (player.modifiers || []).some(m => m.name.toLowerCase() === mod.name.toLowerCase());
          if (!exists) {
            player.modifiers.push({
              name: mod.name,
              type: mod.type || 'debuff',
              metaEffect: mod.metaEffect || 'NONE',
              description: mod.description || ''
            });
            if (player.modifiers.length > maxMods) {
              const nonDeadIdx = player.modifiers.findIndex(m => m.metaEffect !== 'DEAD');
              if (nonDeadIdx !== -1) player.modifiers.splice(nonDeadIdx, 1);
            }
          }
        }
      }
    }
  }

  const outcomeLabel = judgment.outcome === 'FLYING_COLORS'
    ? 'PASSED WITH FLYING COLORS'
    : (judgment.outcome === 'BARELY_PASSED' ? 'BARELY PASSED' : 'FAILED');
  const summaryLine = `Round ${roundIndex + 1} (${outcomeLabel}): ${judgment.headline} ${judgment.continuityBridge || ''}`;
  app.state.storySoFar = app.state.storySoFar
    ? `${app.state.storySoFar}\n${summaryLine}`
    : summaryLine;

  app.state.currentJudgment = judgment;
  app.state.isJudging = false;
  app.state.roundHistory.push({
    roundIndex,
    roundTitle: roundObj.title,
    judgment,
    submissions: { ...app.state.submissions }
  });

  broadcastState();
}

/**
 * Advances the reveal flow on Host command:
 * - Step 1 -> Step 2: Transitions from speech bubbles to story typewriter playback.
 * - Step 2 -> Next Act: Advances to next round or terminates in GAME_OVER if failed/climax.
 */
function hostNextRevealStep() {
  if (!app.isHost) return;

  if (app.state.revealStep === 1) {
    if (app.state.isJudging || !app.state.currentJudgment) return;
    app.state.revealStep = 2;
    sfx.stepReveal();
    broadcastState();
    return;
  }

  if (!app.typewriter.finished) {
    return;
  }

  stopTypewriter();
  const j = app.state.currentJudgment;
  const nextRound = app.state.currentRound + 1;
  const allDead = app.state.players.length > 0 && app.state.players.every(p => Boolean(getPlayerMetaMod(p, 'DEAD')));

  if ((j && j.outcome === 'FAILED') || allDead) {
    app.state.phase = 'GAME_OVER';
    sfx.verdictFail();
    broadcastState();
    return;
  }

  if (nextRound < app.state.activeCampaign.rounds.length) {
    startScenarioRound(nextRound);
  } else {
    app.state.phase = 'GAME_OVER';
    sfx.verdictFlyingColors();
    broadcastState();
  }
}
