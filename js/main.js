// Central Application State & Core Gameplay Controllers

const app = {
  isHost: false,
  myId: '',
  myName: '',
  roomCode: '',
  peer: null,
  hostConn: null,
  clientConns: {},
  lobbyTab: 'campaign',
  homeWindow: 'host',
  lobbyWindow: 'cast',
  charCreateStep: 1,
  scenarioWindow: 'action',
  scenarioPopupOpen: false,
  scenarioPopupKey: '',
  revealWindow: 'story',
  gameOverWindow: 'podium',

  // Authoritative State (managed by Host, synced to Clients)
  state: {
    phase: 'HOME',       // HOME | LOBBY | CHAR_CREATE | SCENARIO | REVEAL | GAME_OVER
    roomCode: '',
    campaignMode: 'premade',
    selectedPremadeId: PREMADE_CAMPAIGNS[0].id,
    aiPrompt: '',
    aiRoundCount: 4,
    customCampaign: {
      id: 'custom-1',
      title: 'My Custom Adventure',
      icon: '🎭',
      genre: 'Custom Story',
      description: 'A custom multi-round scenario created by the Host.',
      rounds: [
        {
          title: 'Act I: The Setup',
          scenario: 'A troll in a clip-on tie blocks the stone bridge. He crosses his arms and refuses to let anyone pass.',
          secrets: 'The troll is secretly insecure about his fashion sense and loves dramatic flattery, absurd bribes, or coordinated slapstick distractions!'
        },
        {
          title: 'Act II: The Escalation',
          scenario: 'Describe what the players see in Round 2 (set up fun moving parts)...',
          secrets: 'Describe the comedic quirks of the NPCs/props for the AI Judge...'
        },
        {
          title: 'Act III: The Climax',
          scenario: 'Describe what the players see in the finale...',
          secrets: 'Describe the comedic hooks and moving parts for the AI Judge...'
        }
      ]
    },
    activeCampaign: null,

    // Configurable Host Settings (Default 120s / 2 minutes)
    settings: {
      roundTimer: 120,
      charCreateTimer: 0,
      strictness: 'balanced',
      allowStartingQuirk: true,
      maxModifiers: 4,
      pointsMultiplier: 1
    },

    timeLeft: 0,
    currentRound: 0,
    storySoFar: '',
    roundHistory: [],
    isJudging: false,
    revealStep: 1,
    players: [],
    submissions: {},
    hiddenSubmissions: {},
    currentJudgment: null
  },

  timerInterval: null,

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
  document.addEventListener('click', (e) => {
    const drawer = document.getElementById('top-menu-drawer');
    const toggleBtn = document.getElementById('btn-top-menu');
    if (drawer && !drawer.classList.contains('hidden')) {
      if (!drawer.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
        closeTopMenu();
      }
    }
  });
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

function closeTopMenu() {
  const drawer = document.getElementById('top-menu-drawer');
  const btn = document.getElementById('btn-top-menu');
  if (drawer) drawer.classList.add('hidden');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '☰ Menu';
  }
}

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
      inviteBanner.innerHTML = `🎟️ Invite to Room <strong>${escapeHtml(cleanCode)}</strong>! Enter your nickname below!`;
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

  const savedKey = getStoredApiKey();
  const keyInput = document.getElementById('api-key-input');
  if (savedKey) {
    try {
      await validateAndDiscoverModels(savedKey);
      if (keyInput) keyInput.value = savedKey;
      updateApiKeyBadge(true);
    } catch (e) {
      setStoredApiKey('');
      if (keyInput) keyInput.value = '';
      updateApiKeyBadge(false);
    }
  } else {
    if (keyInput) keyInput.value = '';
    updateApiKeyBadge(false);
  }
}

// --- Navigation & Timer Helpers ---
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

function hostBackToLobby() {
  if (!app.isHost) return;
  clearInterval(app.timerInterval);
  stopTypewriter();
  app.state.isJudging = false;
  app.state.phase = 'LOBBY';
  broadcastState();
}

function hostAddExtraTime(seconds = 30) {
  if (!app.isHost || app.state.phase !== 'SCENARIO') return;
  if (app.state.settings.roundTimer <= 0) {
    app.state.settings.roundTimer = 120;
  }
  app.state.timeLeft += seconds;
  showToast(`Added +${seconds} seconds to the round timer!`, 'info');
  broadcastState();
}

function copyInviteLink() {
  const inviteUrl = getRoomInviteUrl(app.state.roomCode);
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showToast(`Copied GitHub Pages Invite Link (${app.state.roomCode})!`, 'success');
  }).catch(() => {
    showToast(`Invite Link: ${inviteUrl}`, 'info');
  });
}

function toggleLobbyQrCode() {
  const modal = document.getElementById('qr-popup-modal');
  if (!modal) return;
  modal.classList.toggle('hidden');
}

function closeQrPopup() {
  const modal = document.getElementById('qr-popup-modal');
  if (modal) modal.classList.add('hidden');
}

// --- Multi-Window Switcher Controllers ---
function setHomeWindow(win) {
  app.homeWindow = win === 'join' ? 'join' : 'host';
  renderHomeWindow();
}

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

function setLobbyWindow(win) {
  app.lobbyWindow = win === 'stage' ? 'stage' : 'cast';
  renderLobbyScreen();
}

function setRevealWindow(win) {
  app.revealWindow = win === 'rankings' ? 'rankings' : 'story';
  if (app.state.currentJudgment && app.typewriter.finished) {
    showPostStoryVerdictAndLeaderboard(app.state.currentJudgment);
  }
}

function setGameOverWindow(win) {
  app.gameOverWindow = win === 'recap' ? 'recap' : 'podium';
  renderGameOverScreen();
}

// --- Lobby Roster & Campaign Configuration ---
function addBotPlayer() {
  if (!app.isHost) return;
  const botCount = app.state.players.filter(p => p.isBot).length;
  const template = RANDOM_CHARACTERS[(botCount + Math.floor(Math.random() * RANDOM_CHARACTERS.length)) % RANDOM_CHARACTERS.length];
  const botId = 'bot-' + Math.random().toString(36).slice(2, 7);
  const botPortrait = generateProceduralPortraitDataUrl();

  app.state.players.push({
    id: botId,
    name: `${template.name.split(' ')[0]} (AI Bot)`,
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

function setCampaignMode(mode) {
  if (!app.isHost) return;
  app.state.campaignMode = mode;
  renderCampaignSelector();
  broadcastState();
}

function selectPremadeCampaign(id) {
  if (!app.isHost) return;
  app.state.selectedPremadeId = id;
  renderCampaignSelector();
  broadcastState();
}

function addCustomRound() {
  app.state.customCampaign.rounds.push({
    title: `Act ${app.state.customCampaign.rounds.length + 1}: New Challenge`,
    scenario: '',
    secrets: ''
  });
  renderCampaignSelector();
  broadcastState();
}

function removeCustomRound(idx) {
  if (app.state.customCampaign.rounds.length <= 1) return;
  app.state.customCampaign.rounds.splice(idx, 1);
  renderCampaignSelector();
  broadcastState();
}

async function hostStartCampaign() {
  if (!app.isHost) return;

  let chosenCampaign = null;

  if (app.state.campaignMode === 'premade') {
    const found = PREMADE_CAMPAIGNS.find(c => c.id === app.state.selectedPremadeId) || PREMADE_CAMPAIGNS[0];
    chosenCampaign = JSON.parse(JSON.stringify(found));
  } else if (app.state.campaignMode === 'custom') {
    app.state.customCampaign.title = document.getElementById('custom-camp-title').value.trim() || 'Custom Campaign';
    app.state.customCampaign.description = document.getElementById('custom-camp-desc').value.trim() || 'Survive each act together!';
    chosenCampaign = JSON.parse(JSON.stringify(app.state.customCampaign));
  } else if (app.state.campaignMode === 'ai') {
    const promptInput = document.getElementById('ai-campaign-prompt').value.trim();
    const roundCount = parseInt(document.getElementById('ai-round-count').value, 10) || 4;
    if (!promptInput) {
      showToast('Please enter a theme or idea for the AI Campaign!', 'error');
      return;
    }
    if (!getStoredApiKey() || !isApiKeyVerified) {
      showToast('Please set a valid Gemini API Key first to generate an AI Campaign!', 'error');
      openApiKeyModal();
      return;
    }

    setLoadingOverlay(true, '✨ Gemini is crafting your custom multi-round campaign...');
    try {
      chosenCampaign = await generateCampaignWithAI(promptInput, roundCount);
      updateApiKeyBadge(true);
      setLoadingOverlay(false);
    } catch (err) {
      setLoadingOverlay(false);
      showToast('AI Generation Error: ' + err.message, 'error');
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

  clearInterval(app.timerInterval);
  if (app.state.settings.charCreateTimer > 0) {
    app.state.timeLeft = app.state.settings.charCreateTimer;
    app.timerInterval = setInterval(() => {
      if (app.state.phase !== 'CHAR_CREATE') {
        clearInterval(app.timerInterval);
        return;
      }
      app.state.timeLeft = Math.max(0, app.state.timeLeft - 1);
      broadcastState();
      if (app.state.timeLeft <= 0) {
        clearInterval(app.timerInterval);
        hostForceStartFirstRound();
      }
    }, 1000);
  } else {
    app.state.timeLeft = 0;
  }

  sfx.stepReveal();
  broadcastState();
}

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
function setCharCreateStep(step) {
  app.charCreateStep = step === 2 ? 2 : 1;
  renderCharCreateScreen();
}

function goToCharPortraitStage() {
  const name = (document.getElementById('char-name-input')?.value || '').trim();
  const role = (document.getElementById('char-role-input')?.value || '').trim();
  if (!name) {
    showToast('Give your character a name first!', 'error');
    document.getElementById('char-name-input')?.focus();
    return;
  }
  if (!role) {
    showToast("Describe your character's role or vibe first!", 'error');
    document.getElementById('char-role-input')?.focus();
    return;
  }
  app.charCreateStep = 2;
  sfx.stepReveal();
  renderCharCreateScreen();
}

function submitMyCharacter() {
  const name = document.getElementById('char-name-input').value.trim();
  const role = document.getElementById('char-role-input').value.trim();
  const quirkRaw = (document.getElementById('char-quirk-input')?.value || '').trim();

  if (!name) {
    showToast('Give your character a name!', 'error');
    return;
  }
  if (!role) {
    showToast("Describe your character's role, class, or vibe!", 'error');
    return;
  }

  const avatarDataUrl = drawState.canvas ? exportCompactAvatar(drawState.canvas) : '';

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
  } else if (app.hostConn && app.hostConn.open) {
    const me = app.state.players.find(p => p.id === app.myId);
    if (me) {
      me.character = { name, role, avatar: avatarDataUrl, ready: true };
    }
    renderState();
    app.hostConn.send({
      type: 'SUBMIT_CHARACTER',
      playerId: app.myId,
      character: charData
    });
  }
}

function unlockMyCharacterToEdit() {
  const me = app.state.players.find(p => p.id === app.myId);
  if (me && me.character) {
    me.character.ready = false;
  }
  if (app.isHost) {
    broadcastState();
  } else if (app.hostConn && app.hostConn.open) {
    app.hostConn.send({
      type: 'UNLOCK_CHARACTER',
      playerId: app.myId
    });
    renderState();
  }
}

function checkAllCharactersReady() {
  if (!app.isHost) return;
  const allReady = app.state.players.length > 0 && app.state.players.every(p => p.character && p.character.ready);
  if (allReady) {
    clearInterval(app.timerInterval);
    startScenarioRound(0);
  }
}

// --- Scenario Round & Action Submission Controllers ---
function setScenarioWindow(winName) {
  app.scenarioWindow = winName === 'crew' ? 'crew' : 'action';
  renderScenarioScreen();
}

function openScenarioPopup() {
  app.scenarioPopupOpen = true;
  const modal = document.getElementById('scenario-popup-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeScenarioPopup() {
  app.scenarioPopupOpen = false;
  const modal = document.getElementById('scenario-popup-modal');
  if (modal) modal.classList.add('hidden');
}

function startScenarioRound(roundIndex) {
  if (!app.isHost) return;
  stopTypewriter();
  app.state.currentRound = roundIndex;
  app.state.submissions = {};
  app.state.hiddenSubmissions = {};
  app.state.currentJudgment = null;
  app.state.isJudging = false;
  app.state.phase = 'SCENARIO';
  app.scenarioWindow = 'action';
  app.scenarioPopupKey = '';
  app.scenarioPopupOpen = true;

  const actionInput = document.getElementById('scenario-action-input');
  if (actionInput) actionInput.value = '';
  const hideCheck = document.getElementById('scenario-hide-action');
  if (hideCheck) hideCheck.checked = false;

  app.state.players.forEach(p => {
    const deadMod = getPlayerMetaMod(p, 'DEAD');
    const skipMod = getPlayerMetaMod(p, 'SKIP_TURN');
    if (deadMod) {
      app.state.submissions[p.id] = '(💀 DEAD — Eliminated from the campaign)';
    } else if (skipMod) {
      app.state.submissions[p.id] = `(⛓️ LOCKED OUT THIS TURN [${skipMod.name}] — Cannot act unless rescued by a teammate!)`;
    } else if (p.isBot) {
      app.state.submissions[p.id] = generateBotAction(p);
    }
  });

  clearInterval(app.timerInterval);
  const duration = Number(app.state.settings.roundTimer) || 0;
  if (duration > 0) {
    app.state.timeLeft = duration;
    app.timerInterval = setInterval(() => {
      if (app.state.phase !== 'SCENARIO') {
        clearInterval(app.timerInterval);
        return;
      }
      app.state.timeLeft = Math.max(0, app.state.timeLeft - 1);
      broadcastState();
      if (app.state.timeLeft <= 0) {
        clearInterval(app.timerInterval);
        hostForceEvaluateRound();
      }
    }, 1000);
  } else {
    app.state.timeLeft = 0;
  }

  sfx.stepReveal();
  broadcastState();
  checkAllActionsSubmitted();
}

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

function submitMyAction() {
  const me = app.state.players.find(p => p.id === app.myId);
  if (getPlayerMetaMod(me, 'DEAD') || getPlayerMetaMod(me, 'SKIP_TURN')) {
    return;
  }

  const input = document.getElementById('scenario-action-input');
  const hideCheck = document.getElementById('scenario-hide-action');
  const action = (input ? input.value : '').trim();
  const hideAction = Boolean(hideCheck && hideCheck.checked);

  if (!action) {
    showToast('Write what your character does first!', 'error');
    return;
  }

  const wordLimitMod = getPlayerMetaMod(me, 'WORD_LIMIT');
  if (wordLimitMod) {
    const wordCount = action.split(/\s+/).filter(Boolean).length;
    if (wordCount > 5) {
      showToast(`😶 "${wordLimitMod.name}" active! You can only use up to 5 words (you wrote ${wordCount})!`, 'error');
      return;
    }
  }

  if (app.isHost) {
    app.state.submissions[app.myId] = action;
    if (hideAction) {
      app.state.hiddenSubmissions[app.myId] = true;
    } else {
      delete app.state.hiddenSubmissions[app.myId];
    }
    sfx.lockIn();
    broadcastState();
    checkAllActionsSubmitted();
  } else if (app.hostConn && app.hostConn.open) {
    app.state.submissions[app.myId] = '__LOCKED_IN__';
    if (hideAction) {
      app.state.hiddenSubmissions[app.myId] = true;
    }
    renderState();
    app.hostConn.send({
      type: 'SUBMIT_ACTION',
      playerId: app.myId,
      action,
      hideAction
    });
  }
}

function unlockMyActionToEdit() {
  const me = app.state.players.find(p => p.id === app.myId);
  if (getPlayerMetaMod(me, 'DEAD') || getPlayerMetaMod(me, 'SKIP_TURN')) {
    showToast('You cannot act this turn due to your active status effect!', 'warn');
    return;
  }
  delete app.state.submissions[app.myId];
  delete app.state.hiddenSubmissions[app.myId];
  if (app.isHost) {
    broadcastState();
  } else if (app.hostConn && app.hostConn.open) {
    app.hostConn.send({
      type: 'UNLOCK_ACTION',
      playerId: app.myId
    });
    renderState();
  }
}

function checkAllActionsSubmitted() {
  if (!app.isHost) return;
  const allSubmitted = app.state.players.every(p => Boolean(app.state.submissions[p.id]));
  if (allSubmitted) {
    clearInterval(app.timerInterval);
    evaluateCurrentRound();
  }
}

function hostForceEvaluateRound() {
  if (!app.isHost) return;
  clearInterval(app.timerInterval);
  evaluateCurrentRound();
}

// --- Round Judging & Reveal Flow ---
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
      showToast('Gemini API Error (' + err.message + '). Falling back to Demo Judge.', 'warn');
      judgment = mockJudgeRound({
        players: app.state.players,
        submissions: app.state.submissions,
        settings: app.state.settings
      });
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
  const summaryLine = `Act ${roundIndex + 1} (${outcomeLabel}): ${judgment.headline} ${judgment.continuityBridge || ''}`;
  app.state.storySoFar = app.state.storySoFar
    ? `${app.state.storySoFar}\n${summaryLine}`
    : summaryLine;

  app.state.currentJudgment = judgment;
  app.state.isJudging = false;
  app.state.roundHistory.push({
    roundIndex,
    roundTitle: roundObj.title,
    judgment
  });

  broadcastState();
}

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
