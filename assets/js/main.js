/**
 * Plot Engineering — Main Application Entry Point & Flow Orchestrator
 */

import { PREMADE_CAMPAIGNS } from './data/campaigns.js';
import { app } from './state/store.js';
import { loadSessionFromStorage, clearSessionStorage } from './state/session.js';
import {
  escapeHtml,
  setLoadingOverlay,
  showToast
} from './ui/utils.js';
import { sfx, updateMuteButton, toggleSound } from './services/audio.js';
import {
  getStoredApiKey,
  isKeyVerified,
  friendlyAiError,
  generateCampaignWithAI
} from './services/gemini/index.js';
import {
  drawState,
  initDrawingCanvas,
  selectDrawColor,
  setEraserMode,
  selectBrushSize,
  undoCanvasStroke,
  clearCharacterCanvas
} from './features/canvas.js';
import {
  renderSettingsGrids,
  updateHostSetting,
  openSettingsModal,
  closeSettingsModal,
  updateApiKeyBadge,
  openApiKeyModal,
  toggleApiKeyVisibility,
  closeApiKeyModal,
  saveApiKeyFromModal
} from './features/settings.js';
import {
  PEER_PREFIX,
  PEER_OPTIONS,
  setNetworkHooks,
  hostCreateRoom,
  setupHostClientConnection,
  clientJoinRoom,
  broadcastState,
  rejoinStoredRoom,
  leaveRoomToHome
} from './services/network.js';
import {
  renderHomeWindow,
  setHomeWindow,
  toggleTopMenu,
  closeTopMenu,
  renderState
} from './ui/render.js';
import {
  renderCampaignSelector,
  copyInviteLink,
  toggleLobbyQrCode,
  closeQrPopup,
  openLobbyCampaignSetup,
  closeLobbyCampaignSetup,
  addBotPlayer,
  removePlayer,
  setCampaignMode,
  selectPremadeCampaign,
  addCustomRound,
  removeCustomRound
} from './ui/screens/lobby.js';
import {
  updateCharCreateStepProgress,
  setCharCreateStep,
  goToCharPortraitStage,
  submitMyCharacter,
  unlockMyCharacterToEdit,
  checkAllCharactersReady,
  generateBotCharactersForGame
} from './ui/screens/charCreate.js';
import {
  updateScenarioWordCount,
  startTimer,
  stopTimer,
  updateTimerDisplay,
  hostAddExtraTime,
  openScenarioPopup,
  closeScenarioPopup,
  hostForceStartFirstRound,
  hostStartFirstRound,
  submitMyAction,
  unlockMyActionToEdit,
  checkAllActionsSubmitted,
  hostForceEvaluateRound
} from './ui/screens/scenario.js';
import {
  stopTypewriter,
  skipStoryTypewriter,
  setRevealWindow,
  hostRetryAiJudge,
  hostNextRevealStep
} from './ui/screens/reveal.js';
import {
  setGameOverWindow,
  copyStoryRecap
} from './ui/screens/gameOver.js';

// Wire up network callbacks
setNetworkHooks({
  checkAllCharactersReady,
  checkAllActionsSubmitted,
  updateTimerDisplay,
  stopTimer
});

// Global escape key listener to dismiss modals
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTopMenu();
      closeSettingsModal();
      closeApiKeyModal();
      closeQrPopup();
      if (app.scenarioPopupOpen) closeScenarioPopup();
      const colorMenu = document.getElementById('sketch-color-menu');
      const thickMenu = document.getElementById('sketch-thickness-menu');
      if (colorMenu) colorMenu.classList.add('hidden');
      if (thickMenu) thickMenu.classList.add('hidden');
    }
  });
}

/**
 * Sets up centralized delegated event listeners for data-action, data-bind, and data-on-enter.
 */
function setupDelegatedEventListeners() {
  document.addEventListener('click', (e) => {
    // Close top menu drawer on outside click
    const drawer = document.getElementById('top-menu-drawer');
    const toggleBtn = document.getElementById('btn-top-menu');
    if (drawer && !drawer.classList.contains('hidden')) {
      if (!drawer.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
        closeTopMenu();
      }
    }
    // Dismiss sketchpad tool popups on outside click
    if (!e.target.closest('.sketch-tool-group')) {
      const colorMenu = document.getElementById('sketch-color-menu');
      const thickMenu = document.getElementById('sketch-thickness-menu');
      if (colorMenu) colorMenu.classList.add('hidden');
      if (thickMenu) thickMenu.classList.add('hidden');
    }
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
      case 'toggle-sketch-color-menu': {
        const colorMenu = document.getElementById('sketch-color-menu');
        const thickMenu = document.getElementById('sketch-thickness-menu');
        if (thickMenu) thickMenu.classList.add('hidden');
        if (colorMenu) colorMenu.classList.toggle('hidden');
        break;
      }
      case 'toggle-sketch-thickness-menu': {
        const colorMenu = document.getElementById('sketch-color-menu');
        const thickMenu = document.getElementById('sketch-thickness-menu');
        if (colorMenu) colorMenu.classList.add('hidden');
        if (thickMenu) thickMenu.classList.toggle('hidden');
        break;
      }
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
      case 'retry-ai-judge':
        hostRetryAiJudge();
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
      case 'copy-story-recap':
        copyStoryRecap();
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

  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'scenario-action-input') {
      updateScenarioWordCount();
    }
    if (e.target && (e.target.id === 'char-name-input' || e.target.id === 'char-role-input')) {
      updateCharCreateStepProgress();
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
  stopTimer();
  stopTypewriter();
  app.state.isJudging = false;
  app.state.phase = 'LOBBY';
  app.lobbyView = 'cast';
  broadcastState();
}

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
    if (!getStoredApiKey() || !isKeyVerified()) {
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
    p.character = null;
    p.modifiers = [];
  });

  app.state.phase = 'CHAR_CREATE';
  app.charCreateStep = 1;
  clearCharacterCanvas(false);
  const actionInput = document.getElementById('scenario-action-input');
  if (actionInput) actionInput.value = '';

  startTimer(Number(app.state.settings.charCreateTimer) || 0);

  sfx.stepReveal();
  broadcastState();

  const bots = app.state.players.filter(p => p.isBot);
  if (bots.length > 0) {
    generateBotCharactersForGame(bots);
  }
}

/**
 * Initializes UI and recovers stored session if present.
 */
async function initUI() {
  setupDelegatedEventListeners();
  initDrawingCanvas();
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

  // Check for session recovery via sessionStorage
  const activeSession = loadSessionFromStorage();
  if (activeSession && activeSession.isHost && activeSession.roomCode) {
    // Attempt host room restoration
    try {
      app.isHost = true;
      app.roomCode = activeSession.roomCode;
      app.myName = activeSession.myName || 'Host Player';
      app.myId = activeSession.myId;
      app.state = activeSession.state;
      app.lobbyView = activeSession.lobbyView || 'cast';
      app.charCreateStep = activeSession.charCreateStep || 1;

      const peer = new window.Peer(PEER_PREFIX + activeSession.roomCode, PEER_OPTIONS);
      app.peer = peer;

      peer.on('open', () => {
        showToast(`Resumed room ${activeSession.roomCode}!`, 'success');
        renderState();
      });
      peer.on('connection', (conn) => {
        setupHostClientConnection(conn);
      });
      peer.on('error', (err) => {
        console.warn('Session restoration PeerJS warning:', err);
      });
    } catch (e) {
      console.warn('Could not restore host session:', e);
      clearSessionStorage();
    }
  } else {
    // Guest rejoin prompt
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
  }

  updateApiKeyBadge(false);
  renderState();
}

// Bootstrap on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
}
