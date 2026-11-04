/**
 * Screen Renderer & Controller: LOBBY
 * Handles player roster, room code / QR display, bot controls, and campaign selection.
 */

import { PREMADE_CAMPAIGNS } from '../../data/campaigns.js';
import { app } from '../../state/store.js';
import {
  isLocalhost,
  disambiguatePlayerName,
  getRoomInviteUrl,
  getShortDisplayJoinUrl,
  escapeHtml,
  openAccessibleModal,
  closeAccessibleModal,
  showToast,
  fallbackCopyText
} from '../utils.js';
import { sfx } from '../../services/audio.js';
import { broadcastState } from '../../services/network.js';

export function renderLobbyScreen() {
  const roomCodeDisplay = document.getElementById('lobby-room-code-display');
  if (roomCodeDisplay) roomCodeDisplay.textContent = app.state.roomCode;

  const isCampaignSetup = Boolean(app.isHost && app.lobbyView === 'campaign');
  const castView = document.getElementById('lobby-view-cast');
  const campView = document.getElementById('lobby-view-campaign');
  if (castView) castView.classList.toggle('hidden', isCampaignSetup);
  if (campView) campView.classList.toggle('hidden', !isCampaignSetup);

  const joinUrlPill = document.getElementById('lobby-join-url-pill');
  if (joinUrlPill) {
    joinUrlPill.innerHTML = `Join at: <strong>${escapeHtml(getShortDisplayJoinUrl())}</strong>`;
  }

  const qrImg = document.getElementById('lobby-qr-img');
  if (qrImg && app.state.roomCode) {
    const inviteUrl = getRoomInviteUrl(app.state.roomCode);
    const targetSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(inviteUrl)}`;
    if (qrImg.getAttribute('data-room') !== app.state.roomCode) {
      qrImg.setAttribute('data-room', app.state.roomCode);
      qrImg.src = targetSrc;
    }
  }

  const qrHint = document.getElementById('lobby-qr-hint');
  if (qrHint) {
    qrHint.textContent = isLocalhost()
      ? 'Friends cannot reach localhost; share your deployed URL or your LAN address.'
      : 'Point your phone camera here to open the room link!';
  }

  const listEl = document.getElementById('lobby-player-list');
  if (listEl) {
    listEl.innerHTML = app.state.players.map(p => {
      const isMe = p.id === app.myId;
      return `
        <div class="player-pill ${isMe ? 'is-me-pill' : ''}">
          <div class="row-gap" style="gap:0.5rem; min-width:0; flex:1;">
            ${p.isBot ? '<span class="badge">Bot</span>' : (p.isHost ? '<span class="badge">Host</span>' : '')}
            <span class="player-pill-name" title="${escapeHtml(p.name)}">
              ${escapeHtml(p.name)} ${isMe ? '<small>(You)</small>' : ''} ${p.disconnected ? '<small style="color:var(--accent-red);">(offline)</small>' : ''}
            </span>
          </div>
          ${app.isHost && !isMe ? `<button type="button" class="btn-icon-remove btn-remove-player" title="Remove" data-action="remove-player" data-player-id="${escapeHtml(p.id)}">✕</button>` : ''}
        </div>
      `;
    }).join('');
  }

  const addBotBtn = document.getElementById('btn-lobby-add-bot');
  if (addBotBtn) {
    addBotBtn.classList.toggle('hidden', !app.isHost || app.state.players.length >= 8);
  }

  // Toggle "Set up campaign" vs "Waiting for host..." buttons
  const setupBtn = document.getElementById('btn-host-setup-campaign');
  const waitBanner = document.getElementById('client-lobby-waiting');
  if (setupBtn) setupBtn.classList.toggle('hidden', !app.isHost);
  if (waitBanner) waitBanner.classList.toggle('hidden', app.isHost);

  const hasSetupStarted = Boolean(app.state.campaignSetupStarted);

  // Toggle "Up next on stage" preview vs pre-setup boxes (only other players see "Wait for host...")
  const hostPreSetupBox = document.getElementById('lobby-stage-host-pre-setup');
  const clientPreSetupBox = document.getElementById('lobby-stage-pre-setup');
  const postSetupBox = document.getElementById('lobby-stage-post-setup');
  if (hostPreSetupBox) hostPreSetupBox.classList.toggle('hidden', hasSetupStarted || !app.isHost);
  if (clientPreSetupBox) clientPreSetupBox.classList.toggle('hidden', hasSetupStarted || app.isHost);
  if (postSetupBox) postSetupBox.classList.toggle('hidden', !hasSetupStarted);

  const waitTxt = document.getElementById('client-lobby-waiting-text');
  const waitMsg = hasSetupStarted
    ? 'Waiting for the host to start.'
    : 'Waiting for the host to choose a campaign...';
  if (waitTxt) waitTxt.textContent = waitMsg;

  if (isCampaignSetup) {
    renderCampaignSelector();
  }

  // Populate preview box
  const mode = app.state.campaignMode || 'premade';
  if (mode === 'premade') {
    const camp = PREMADE_CAMPAIGNS.find(c => c.id === app.state.selectedPremadeId) || PREMADE_CAMPAIGNS[0];
    const previewEl = document.getElementById('client-campaign-preview');
    if (previewEl) {
      previewEl.innerHTML = `
        <div class="campaign-card-header">
          <div>
            <h3>${escapeHtml(camp.title)}</h3>
            <span class="badge badge-genre">${escapeHtml(camp.genre)} • ${camp.rounds.length} Rounds</span>
          </div>
        </div>
        <p class="mt-1">${escapeHtml(camp.description)}</p>
      `;
    }
  } else if (mode === 'ai') {
    const rounds = app.state.aiRoundCount || 4;
    const promptSnippet = (app.state.aiPrompt || '').trim();
    const previewEl = document.getElementById('client-campaign-preview');
    if (previewEl) {
      previewEl.innerHTML = `
        <div class="campaign-card-header">
          <div>
            <h3>AI-Generated Custom Campaign</h3>
            <span class="badge badge-warn">AI-generated • ${rounds} rounds</span>
          </div>
        </div>
        <p class="mt-1">${promptSnippet ? `"${escapeHtml(promptSnippet)}"` : 'The Host is cooking up a custom AI movie plot for the crew!'}</p>
      `;
    }
  } else {
    const custom = app.state.customCampaign || {};
    const roundCount = Array.isArray(custom.rounds) ? custom.rounds.length : 3;
    const previewEl = document.getElementById('client-campaign-preview');
    if (previewEl) {
      previewEl.innerHTML = `
        <div class="campaign-card-header">
          <div>
            <h3>${escapeHtml(custom.title || 'Custom campaign')}</h3>
            <span class="badge badge-genre">Director's Cut • ${roundCount} Rounds</span>
          </div>
        </div>
        <p class="mt-1">${escapeHtml(custom.description || 'A custom multi-round scenario written by the Host!')}</p>
      `;
    }
  }

  const s = app.state.settings;
  const summaryEl = document.getElementById('client-settings-summary');
  if (summaryEl && s) {
    const timerTxt = s.roundTimer > 0 ? (s.roundTimer >= 60 ? `${Math.round(s.roundTimer / 60)} min` : `${s.roundTimer}s`) : 'Unlimited';
    const strictnessLabels = {
      forgiving: 'Forgiving',
      balanced: 'Balanced',
      brutal: 'Tough Critic'
    };
    const judgeLabel = strictnessLabels[s.strictness] || 'Balanced';
    summaryEl.innerHTML = `Round timer: <strong>${timerTxt}</strong> &bull; Judge: <strong>${judgeLabel}</strong> &bull; Points: <strong>${s.pointsMultiplier}x</strong>`;
  }
}

export function renderCampaignSelector() {
  const mode = app.state.campaignMode;
  document.querySelectorAll('.campaign-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const panelPremade = document.getElementById('panel-premade');
  const panelAi = document.getElementById('panel-ai');
  const panelCustom = document.getElementById('panel-custom');

  if (panelPremade) panelPremade.classList.toggle('hidden', mode !== 'premade');
  if (panelAi) panelAi.classList.toggle('hidden', mode !== 'ai');
  if (panelCustom) panelCustom.classList.toggle('hidden', mode !== 'custom');

  if (mode === 'premade') {
    const grid = document.getElementById('premade-campaign-grid');
    if (!grid) return;
    grid.innerHTML = PREMADE_CAMPAIGNS.map(c => {
      const selected = c.id === app.state.selectedPremadeId;
      return `
        <button type="button" class="campaign-card ${selected ? 'selected' : ''}" data-action="select-premade-campaign" data-campaign-id="${escapeHtml(c.id)}">
          <div class="campaign-card-header">
            <div>
              <h4>${escapeHtml(c.title)}</h4>
              <span class="badge badge-genre">${escapeHtml(c.genre)} • ${c.rounds.length} Rounds</span>
            </div>
          </div>
          <p class="small text-muted">${escapeHtml(c.description)}</p>
        </button>
      `;
    }).join('');
  } else if (mode === 'custom') {
    const container = document.getElementById('custom-rounds-list');
    if (!container) return;
    const titleEl = document.getElementById('custom-camp-title');
    const descEl = document.getElementById('custom-camp-desc');
    if (titleEl) titleEl.value = app.state.customCampaign.title;
    if (descEl) descEl.value = app.state.customCampaign.description;

    container.innerHTML = app.state.customCampaign.rounds.map((r, i) => `
      <div class="custom-round-box">
        <div class="row-between">
          <strong>Round ${i + 1}</strong>
          ${app.state.customCampaign.rounds.length > 1 ? `<button type="button" class="btn-small btn-danger" data-action="remove-custom-round" data-round-index="${i}">Remove</button>` : ''}
        </div>
        <label for="custom-round-title-${i}" class="tiny text-muted">Round Title:</label>
        <input id="custom-round-title-${i}" type="text" class="input-field" value="${escapeHtml(r.title)}" placeholder="Round Title"
          data-bind="custom-round-title" data-round-index="${i}" />
        <label for="custom-round-scenario-${i}" class="tiny text-muted" style="margin-top:0.15rem;">1. Scene Setup (Shown to Players — set the stage without spoiling!):</label>
        <textarea id="custom-round-scenario-${i}" class="input-field" rows="2" placeholder="e.g., A massive troll in a clip-on tie blocks the bridge and glares at the party."
          data-bind="custom-round-scenario" data-round-index="${i}">${escapeHtml(r.scenario || '')}</textarea>
        <label for="custom-round-secrets-${i}" class="tiny text-muted" style="margin-top:0.15rem;">2. Comedic Hooks &amp; Quirks (Shown to AI Judge — fun personalities &amp; improv fuel!):</label>
        <textarea id="custom-round-secrets-${i}" class="input-field" rows="2" placeholder="e.g., The troll is super insecure about his tie and loves dramatic flattery or slapstick combos!"
          data-bind="custom-round-secrets" data-round-index="${i}">${escapeHtml(r.secrets || '')}</textarea>
      </div>
    `).join('');
  }
}

export function copyInviteLink() {
  const inviteUrl = getRoomInviteUrl(app.state.roomCode);

  const onCopySuccess = () => {
    if (isLocalhost()) {
      showToast('Invite link copied. Note: Friends cannot reach localhost; share your deployed URL or your LAN address.', 'info');
    } else {
      showToast('Invite link copied', 'success');
    }
  };

  const onCopyError = () => {
    showToast(`Invite Link: ${inviteUrl}`, 'info');
  };

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(inviteUrl)
      .then(onCopySuccess)
      .catch(() => fallbackCopyText(inviteUrl, onCopySuccess, onCopyError));
  } else {
    fallbackCopyText(inviteUrl, onCopySuccess, onCopyError);
  }
}

export function toggleLobbyQrCode() {
  const modal = document.getElementById('qr-popup-modal');
  if (!modal) return;
  if (modal.classList.contains('hidden')) {
    openAccessibleModal('qr-popup-modal');
  } else {
    closeAccessibleModal('qr-popup-modal');
  }
}

export function closeQrPopup() {
  closeAccessibleModal('qr-popup-modal');
}

export function openLobbyCampaignSetup() {
  if (!app.isHost) return;
  app.lobbyView = 'campaign';
  app.state.campaignSetupStarted = true;
  broadcastState();
  renderLobbyScreen();
}

export function closeLobbyCampaignSetup() {
  app.lobbyView = 'cast';
  renderLobbyScreen();
}

export function addBotPlayer() {
  if (!app.isHost) return;
  if (app.state.players.length >= 8) {
    showToast('The room is full (maximum 8 players).', 'warn');
    return;
  }
  const botCount = app.state.players.filter(p => p.isBot).length;
  const botId = 'bot-' + Math.random().toString(36).slice(2, 7);
  const botName = disambiguatePlayerName(`Bot ${botCount + 1}`, app.state.players);

  app.state.players.push({
    id: botId,
    name: botName,
    isHost: false,
    isBot: true,
    score: 0,
    character: null,
    modifiers: []
  });
  sfx.join();
  broadcastState();
}

export function removePlayer(playerId) {
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

export function setCampaignMode(mode) {
  if (!app.isHost) return;
  app.state.campaignMode = mode;
  renderCampaignSelector();
  broadcastState();
}

export function selectPremadeCampaign(id) {
  if (!app.isHost) return;
  app.state.selectedPremadeId = id;
  renderCampaignSelector();
  broadcastState();
}

export function addCustomRound() {
  app.state.customCampaign.rounds.push({
    title: `Round ${app.state.customCampaign.rounds.length + 1}: New Challenge`,
    scenario: '',
    secrets: ''
  });
  renderCampaignSelector();
  broadcastState();
}

export function removeCustomRound(idx) {
  if (app.state.customCampaign.rounds.length <= 1) return;
  app.state.customCampaign.rounds.splice(idx, 1);
  renderCampaignSelector();
  broadcastState();
}
