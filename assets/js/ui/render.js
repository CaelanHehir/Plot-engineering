/**
 * Reactive Screen Rendering Engine & Typewriter Story Narration for Plot Engineering
 * 
 * Manages view updates for each game phase:
 * - HOME: Host stage and player join inputs
 * - LOBBY: Player cast roster, room invite code/QR, and campaign configuration
 * - CHAR_CREATE: Two-stage character creation (bio inputs and full sketchpad canvas)
 * - SCENARIO: Round countdown timer, scene popups, action submission, and crew status
 * - REVEAL: Cartoon speech bubbles, word-by-word typewriter story playback, and awards
 * - GAME_OVER: Winner podium, runner-up rankings, and multi-act campaign story recap
 * 
 * Performance:
 * Uses DOM caching attributes (data-roster-sig, data-locked-state) to prevent
 * DOM thrashing, flickering, or re-triggering animations on identical state updates.
 */

/**
 * Halts active typewriter intervals and resets narration playback state.
 */
function stopTypewriter() {
  if (app.typewriter.timer) {
    clearInterval(app.typewriter.timer);
    app.typewriter.timer = null;
  }
  app.typewriter.activeKey = '';
  app.typewriter.finished = false;
}

/**
 * Main reactive render dispatcher.
 * Toggles visibility for the active phase section and calls the appropriate screen renderer.
 */
function renderState() {
  const phase = app.state.phase;
  const screens = ['HOME', 'LOBBY', 'CHAR_CREATE', 'SCENARIO', 'REVEAL', 'GAME_OVER'];
  screens.forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.toggle('hidden', s !== phase);
  });

  // Top header Back button text and visibility
  const backBtn = document.getElementById('btn-global-back');
  if (backBtn) {
    if (phase === 'HOME') {
      backBtn.classList.add('hidden');
    } else {
      backBtn.classList.remove('hidden');
      if (!app.isHost) {
        backBtn.textContent = 'Leave room';
      } else if (phase === 'LOBBY') {
        backBtn.textContent = 'Exit to home';
      } else {
        backBtn.textContent = 'Back to lobby';
      }
    }
  }

  // House Rules button visibility (available on HOME, and in-game for host)
  const settingsBtn = document.getElementById('btn-top-settings');
  if (settingsBtn) {
    settingsBtn.classList.toggle('hidden', phase !== 'HOME' && !app.isHost);
  }

  // AI Key menu button visibility (available on HOME, and in-game for host)
  const aiKeyBtn = document.getElementById('menu-ai-key-btn');
  if (aiKeyBtn) {
    aiKeyBtn.classList.toggle('hidden', phase !== 'HOME' && !app.isHost);
  }

  // Top header room code permanent pill (U1)
  const roomPill = document.getElementById('header-room-pill');
  if (roomPill) {
    if (phase !== 'HOME' && app.state.roomCode) {
      roomPill.classList.remove('hidden');
      roomPill.innerHTML = `ROOM: <strong>${escapeHtml(app.state.roomCode)}</strong>`;
    } else {
      roomPill.classList.add('hidden');
    }
  }

  const roomBadge = document.getElementById('top-room-badge');
  if (roomBadge) {
    roomBadge.classList.add('hidden');
  }

  // Automatically dismiss scenario popup if phase changed away from SCENARIO
  if (phase !== 'SCENARIO') {
    app.scenarioPopupOpen = false;
    const scenModal = document.getElementById('scenario-popup-modal');
    if (scenModal) scenModal.classList.add('hidden');
  }

  // Dismiss QR code popup if leaving LOBBY
  if (phase !== 'LOBBY') {
    const qrModal = document.getElementById('qr-popup-modal');
    if (qrModal) qrModal.classList.add('hidden');
  }

  // Delegate rendering to current phase
  if (phase === 'HOME') renderHomeWindow();
  if (phase === 'LOBBY') renderLobbyScreen();
  if (phase === 'CHAR_CREATE') renderCharCreateScreen();
  if (phase === 'SCENARIO') renderScenarioScreen();
  if (phase === 'REVEAL') renderRevealScreen();
  if (phase === 'GAME_OVER') renderGameOverScreen();
}

/**
 * Renders the LOBBY screen.
 * Supports dual views:
 * 1. Cast View ('cast'): Roster of connected players, bot controls, and campaign preview.
 * 2. Campaign Setup View ('campaign'): Host controls to select or generate storylines.
 */
function renderLobbyScreen() {
  document.getElementById('lobby-room-code-display').textContent = app.state.roomCode;

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
  if (addBotBtn) addBotBtn.classList.toggle('hidden', !app.isHost);

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
  let campTitle = '';
  const mode = app.state.campaignMode || 'premade';
  if (mode === 'premade') {
    const camp = PREMADE_CAMPAIGNS.find(c => c.id === app.state.selectedPremadeId) || PREMADE_CAMPAIGNS[0];
    campTitle = camp.title;
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
    campTitle = 'AI-Generated Custom Campaign';
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
    campTitle = custom.title || 'Custom campaign';
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
  if (summaryEl) {
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

/**
 * Renders the Campaign Selector panels (pre-made cards, AI generator prompt, or custom acts editor).
 */
function renderCampaignSelector() {
  const mode = app.state.campaignMode;
  document.querySelectorAll('.campaign-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  document.getElementById('panel-premade').classList.toggle('hidden', mode !== 'premade');
  document.getElementById('panel-ai').classList.toggle('hidden', mode !== 'ai');
  document.getElementById('panel-custom').classList.toggle('hidden', mode !== 'custom');

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
    document.getElementById('custom-camp-title').value = app.state.customCampaign.title;
    document.getElementById('custom-camp-desc').value = app.state.customCampaign.description;

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

/**
 * Renders the Character Creation screen.
 * Supports the two-stage creation flow:
 * 1. Stage 1: Character Name, Role/vibe, and optional Quirk.
 * 2. Stage 2: Full-sketchpad drawing canvas with undo, colors, and brush sizes.
 * Once submitted, displays the crew polaroid status grid.
 */
function renderCharCreateScreen() {
  const camp = app.state.activeCampaign;
  if (!camp) return;

  document.getElementById('char-camp-title').textContent = camp.title;
  document.getElementById('char-camp-desc').textContent = camp.description;

  const quirkGroup = document.getElementById('char-quirk-group');
  if (quirkGroup) {
    quirkGroup.classList.toggle('hidden', !app.state.settings.allowStartingQuirk);
  }

  const charTimerEl = document.getElementById('char-create-timer');
  if (charTimerEl) {
    if (app.state.settings.charCreateTimer > 0) {
      charTimerEl.classList.remove('hidden');
      charTimerEl.textContent = formatSeconds(app.state.timeLeft);
    } else {
      charTimerEl.classList.add('hidden');
    }
  }

  const me = app.state.players.find(p => p.id === app.myId);
  const isReady = Boolean(me && me.character && me.character.ready);

  const step = app.charCreateStep === 2 ? 2 : 1;
  const creatorCard = document.getElementById('char-creator-card');
  const rosterCard = document.getElementById('char-roster-card');
  // Compact screens: edit your hero first, then the Crew wall replaces it once submitted
  if (creatorCard) {
    creatorCard.classList.toggle('mobile-window-hidden', isReady);
    creatorCard.classList.toggle('is-portrait-sketchpad', step === 2 && !isReady);
  }
  if (rosterCard) rosterCard.classList.toggle('mobile-window-hidden', !isReady);
  const rosterEditBtn = document.getElementById('btn-char-roster-edit');
  if (rosterEditBtn) rosterEditBtn.classList.toggle('hidden', !isReady);

  document.getElementById('char-form-box').classList.toggle('hidden', isReady);
  document.getElementById('char-waiting-box').classList.toggle('hidden', !isReady);

  const stage1El = document.getElementById('char-stage-1');
  const stage2El = document.getElementById('char-stage-2');
  const stepBtn1 = document.getElementById('char-step-btn-1');
  const stepBtn2 = document.getElementById('char-step-btn-2');
  if (stage1El) stage1El.classList.toggle('hidden', step !== 1);
  if (stage2El) stage2El.classList.toggle('hidden', step !== 2);
  if (stepBtn1) stepBtn1.classList.toggle('active', step === 1);
  if (stepBtn2) stepBtn2.classList.toggle('active', step === 2);

  const statusEl = document.getElementById('char-ready-list');
  const rosterSig = app.state.players
    .map(p => `${p.id}:${Boolean(p.character?.ready)}:${p.character?.name || ''}:${p.character?.role || ''}:${(p.character?.avatar || '').length}`)
    .join('|');
  if (statusEl.getAttribute('data-roster-sig') !== rosterSig) {
    statusEl.setAttribute('data-roster-sig', rosterSig);
    statusEl.innerHTML = app.state.players.map(p => {
      const ready = Boolean(p.character && p.character.ready);
      const safeAvatar = ready && p.character?.avatar ? sanitizeAvatar(p.character.avatar) : '';
      const photoContent = safeAvatar
        ? `<img src="${escapeHtml(safeAvatar)}" alt="${escapeHtml(p.character.name)}" />`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-card);"><svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><circle cx="12" cy="8" r="4"/><path d="M12 14c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"/></svg></div>`;
      return `
        <div class="polaroid-card ${ready ? 'is-ready' : ''}">
          <div class="polaroid-photo-frame">
            ${photoContent}
          </div>
          <div class="polaroid-name">${escapeHtml(ready ? p.character.name : p.name)}</div>
          <div class="polaroid-role">${ready ? escapeHtml(p.character.role) : 'Sketching hero...'}</div>
          <div class="polaroid-status-tag">
            <span class="badge ${p.disconnected ? 'badge-warn' : (ready ? 'badge-success' : 'badge-warn')}">${p.disconnected ? 'Offline' : (ready ? 'Ready' : 'Drawing')}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  const allReady = app.state.players.length > 0 && app.state.players.every(p => p.character && p.character.ready);

  const startCampBtn = document.getElementById('btn-host-start-campaign');
  const allReadyHostAction = document.getElementById('char-all-ready-host-action');
  const allReadyClientWait = document.getElementById('char-all-ready-client-wait');
  const skipCharBtn = document.getElementById('btn-host-skip-char');
  const charWaitingText = document.getElementById('char-waiting-text');

  const showHostStart = Boolean(app.isHost && allReady);
  const showClientWait = Boolean(!app.isHost && allReady);

  if (startCampBtn) startCampBtn.classList.toggle('hidden', !showHostStart);
  if (allReadyHostAction) allReadyHostAction.classList.toggle('hidden', !showHostStart);
  if (allReadyClientWait) allReadyClientWait.classList.toggle('hidden', !showClientWait);

  if (skipCharBtn) {
    skipCharBtn.classList.toggle('hidden', !app.isHost || allReady);
  }

  if (charWaitingText) {
    charWaitingText.textContent = allReady
      ? (app.isHost ? 'All crew members are locked in! Click "Start round 1" on the roster to begin.' : 'All crew members are locked in! Waiting for the host to start the campaign...')
      : 'Waiting for the rest of the crew to finish...';
  }
}

/**
 * Renders the active round's Scenario screen:
 * - Triggers the opening scenario popup at the beginning of each round.
 * - Supports switching between "What would you do" action view and "Crew status" list.
 * - Enforces status restrictions (e.g. BLINDED redaction, WORD_LIMIT placeholder, SKIP_TURN lockout).
 * - Displays active perks/modifiers and locked-in move confirmation stamp.
 */
function renderScenarioScreen() {
  const camp = app.state.activeCampaign;
  const roundIdx = app.state.currentRound;
  const roundObj = camp.rounds[roundIdx];
  const me = app.state.players.find(p => p.id === app.myId);

  const roundPopupKey = `${app.state.roomCode}-${camp.id || camp.title}-r${roundIdx}`;
  if (app.scenarioPopupKey !== roundPopupKey) {
    app.scenarioPopupKey = roundPopupKey;
    const isAutoDisabled = localStorage.getItem('plot_engineering_disable_scenario_popup') === 'true';
    app.scenarioPopupOpen = !isAutoDisabled;
    const actionInput = document.getElementById('scenario-action-input');
    if (actionInput && !app.state.submissions[app.myId]) {
      actionInput.value = '';
    }
  }

  const scenModal = document.getElementById('scenario-popup-modal');
  if (scenModal) {
    scenModal.classList.toggle('hidden', !app.scenarioPopupOpen);
    const chk = document.getElementById('chk-disable-scenario-popup');
    if (chk) {
      chk.checked = localStorage.getItem('plot_engineering_disable_scenario_popup') === 'true';
    }
  }

  const myDeadMod = getPlayerMetaMod(me, 'DEAD');
  const mySkipMod = getPlayerMetaMod(me, 'SKIP_TURN');
  const myWordLimitMod = getPlayerMetaMod(me, 'WORD_LIMIT');
  const myBlindedMod = getPlayerMetaMod(me, 'BLINDED_SCENARIO');

  const roundLabelText = `ROUND ${roundIdx + 1} OF ${camp.rounds.length}`;
  document.getElementById('scenario-round-badge').textContent = roundLabelText;
  const popupRoundBadge = document.getElementById('scenario-popup-round-badge');
  if (popupRoundBadge) popupRoundBadge.textContent = roundLabelText;
  document.getElementById('scenario-title').textContent = roundObj.title;

  // B5: Populate inline scene title
  const inlineTitle = document.getElementById('scenario-inline-title');
  if (inlineTitle) inlineTitle.textContent = roundObj.title;

  let sceneDesc = roundObj.scenario;
  if (myBlindedMod) {
    const redacted = roundObj.scenario
      .split(/\s+/)
      .map((w, i) => (i % 2 === 1 ? '█████' : w))
      .join(' ');
    sceneDesc = `[BLINDED BY "${myBlindedMod.name}"] ${redacted}`;
  }
  document.getElementById('scenario-description').textContent = sceneDesc;

  // B5: Populate inline scene description
  const inlineDesc = document.getElementById('scenario-inline-desc');
  if (inlineDesc) inlineDesc.textContent = sceneDesc;

  const bridgeBox = document.getElementById('scenario-bridge-box');
  const inlineBridge = document.getElementById('scenario-inline-bridge');
  if (roundIdx > 0 && app.state.roundHistory.length > 0) {
    const prev = app.state.roundHistory[app.state.roundHistory.length - 1];
    const bridgeHtml = `<strong>Previously:</strong> ${escapeHtml(prev.judgment?.continuityBridge || prev.judgment?.headline || '')}`;
    bridgeBox.classList.remove('hidden');
    bridgeBox.innerHTML = bridgeHtml;
    if (inlineBridge) {
      inlineBridge.classList.remove('hidden');
      inlineBridge.innerHTML = bridgeHtml;
    }
  } else {
    bridgeBox.classList.add('hidden');
    if (inlineBridge) inlineBridge.classList.add('hidden');
  }

  const timerEl = document.getElementById('scenario-timer');
  const addTimeBtn = document.getElementById('btn-host-add-time');
  if (app.state.settings.roundTimer > 0) {
    timerEl.classList.remove('hidden');
    timerEl.textContent = formatSeconds(app.state.timeLeft);
    timerEl.classList.toggle('timer-urgent', app.state.timeLeft <= 20);
    if (addTimeBtn) addTimeBtn.classList.toggle('hidden', !app.isHost);
  } else {
    timerEl.classList.add('hidden');
    if (addTimeBtn) addTimeBtn.classList.add('hidden');
  }

  const traitsStrip = document.getElementById('scenario-traits-strip');
  if (traitsStrip && me) {
    const modsCount = (me.modifiers || []).length;
    if (modsCount > 0) {
      traitsStrip.classList.remove('hidden');
      traitsStrip.innerHTML = `
        <details class="modifiers-section" style="cursor:pointer; margin-bottom:0.5rem;" open>
          <summary class="mod-label" style="outline:none; user-select:none; color:var(--accent-gold); font-size:0.85rem;">
            Active traits (${modsCount})
          </summary>
          <div class="modifier-chips mt-1">
            ${renderModifierChips(me.modifiers)}
          </div>
        </details>
      `;
    } else {
      traitsStrip.classList.add('hidden');
      traitsStrip.innerHTML = '';
    }
  }

  const actionInput = document.getElementById('scenario-action-input');
  if (actionInput) {
    actionInput.placeholder = myWordLimitMod
      ? `"${myWordLimitMod.name}" active: You may only type up to 5 words this round!`
      : 'Write your character\'s move! Funny or unrealistic ideas work great if they coordinate and cohere with your crew!';
    updateScenarioWordCount();
  }

  const hasSubmitted = Boolean(app.state.submissions[app.myId]);
  document.getElementById('scenario-input-area').classList.toggle('hidden', hasSubmitted);
  const lockedArea = document.getElementById('scenario-locked-area');
  lockedArea.classList.toggle('hidden', !hasSubmitted);

  const lockedStateKey = hasSubmitted
    ? (myDeadMod ? 'dead' : (mySkipMod ? `skip:${mySkipMod.name}:${mySkipMod.description || ''}` : 'locked'))
    : 'none';

  if (lockedArea.getAttribute('data-locked-state') !== lockedStateKey) {
    lockedArea.setAttribute('data-locked-state', lockedStateKey);
    if (hasSubmitted) {
      if (myDeadMod) {
        lockedArea.innerHTML = `
          <div class="big-locked-stamp" style="background:var(--accent-red); color:#fff;">ELIMINATED</div>
          <p class="text-muted small">Your character met an untimely demise and is spectating the survivors.</p>
        `;
      } else if (mySkipMod) {
        lockedArea.innerHTML = `
          <div class="big-locked-stamp" style="background:var(--accent-gold); color:var(--ink);">${escapeHtml(mySkipMod.name)}</div>
          <p class="text-muted small">${escapeHtml(mySkipMod.description || 'You cannot act this round unless a teammate rescues you!')}</p>
        `;
      } else {
        lockedArea.innerHTML = `
          <div class="big-locked-stamp">MOVE LOCKED IN</div>
          <p class="text-muted small mb-2">Keep a poker face while your teammates finish typing...</p>
          <button type="button" class="btn btn-secondary" data-action="unlock-action-edit">
            Change my move
          </button>
        `;
      }
    }
  }

  document.getElementById('btn-host-force-judge').classList.toggle('hidden', !app.isHost);
}

/**
 * Updates the live word counter badge under the scenario move input when a WORD_LIMIT restriction is active.
 */
function updateScenarioWordCount() {
  const input = document.getElementById('scenario-action-input');
  const counterEl = document.getElementById('scenario-word-limit-counter');
  if (!counterEl) return;

  const me = app.state?.players?.find(p => p.id === app.myId);
  const wordLimitMod = getPlayerMetaMod(me, 'WORD_LIMIT');

  if (!wordLimitMod) {
    counterEl.classList.add('hidden');
    return;
  }

  const text = (input ? input.value : '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const count = words.length;
  const max = 5;
  const isOver = count > max;

  counterEl.classList.remove('hidden');
  counterEl.className = `word-limit-counter ${isOver ? 'word-limit-exceeded' : 'word-limit-ok'}`;
  counterEl.innerHTML = `<strong>${escapeHtml(wordLimitMod.name)}:</strong> ${count} / ${max} words${isOver ? ' (Over limit!)' : ''}`;
}

/**
 * Renders the Reveal screen across its two steps:
 * Step 1: Cartoon Speech Bubbles showing each player's action (or redaction tape if secret).
 * Step 2: Dramatic AI typewriter story narration, followed by the verdict banner and round rankings.
 */
function renderRevealScreen() {
  const j = app.state.currentJudgment;
  const step = app.state.revealStep;
  const isJudging = app.state.isJudging;

  const step1View = document.getElementById('reveal-step1-view');
  const step2View = document.getElementById('reveal-step2-view');
  const revealSwitcher = document.getElementById('reveal-window-switcher');
  const aiGeneratingBox = document.getElementById('reveal-ai-generating-box');
  const nextBtn = document.getElementById('btn-host-reveal-next');
  const skipBtn = document.getElementById('btn-host-skip-story');
  const waitMsg = document.getElementById('client-reveal-wait');

  // 1. Populate "What Everyone Decided To Do" as Cartoon Speech Bubbles & Censor Tape
  const actionsGrid = document.getElementById('reveal-actions-grid');
  const kinds = app.state.submissionKinds || {};
  actionsGrid.innerHTML = app.state.players.map((p, idx) => {
    const isMe = p.id === app.myId;
    const kind = kinds[p.id] || (isMe ? 'text' : 'secret');
    const actionText = app.state.submissions[p.id] || '(Panicked and did nothing!)';

    if (kind === 'secret' && !isMe) {
      // U9: Render hidden moves as one compact row
      return `
        <div class="action-reveal-card" style="animation-delay: ${idx * 0.08}s; padding: 0.6rem 0.85rem;">
          <div class="row-between" style="width: 100%;">
            <div class="row-gap" style="gap: 0.65rem;">
              ${renderAvatarHtml(p.character?.avatar, 'avatar-img-sm')}
              <div>
                <strong>${escapeHtml(p.character?.name || p.name)}</strong>
                <div class="text-muted tiny">${escapeHtml(p.character?.role || '')}</div>
              </div>
            </div>
            <span class="badge badge-warn">Move locked</span>
          </div>
        </div>
      `;
    }

    let quoteHtml = '';
    if (kind === 'dead') {
      quoteHtml = `<div class="action-quote-status" style="color:var(--accent-red); font-weight:700;">Eliminated from the campaign</div>`;
    } else if (kind === 'locked') {
      quoteHtml = `<div class="action-quote-status" style="color:var(--accent-gold); font-weight:700;">Locked out this round</div>`;
    } else if (kind === 'away') {
      quoteHtml = `<div class="action-quote-status text-muted">Away during this round</div>`;
    } else {
      quoteHtml = `<blockquote class="action-quote">"${escapeHtml(hyphenateLongWords(actionText))}"</blockquote>`;
    }

    return `
      <div class="action-reveal-card" style="animation-delay: ${idx * 0.08}s;">
        <div class="action-card-header">
          ${renderAvatarHtml(p.character?.avatar, 'avatar-img')}
          <div>
            <strong>${escapeHtml(p.character?.name || p.name)}</strong>
            <div class="text-muted tiny">${escapeHtml(p.character?.role || '')}</div>
          </div>
        </div>
        ${quoteHtml}
      </div>
    `;
  }).join('');

  if (isJudging || !j) {
    stopTypewriter();
    if (step1View) step1View.classList.remove('hidden');
    if (step2View) step2View.classList.add('hidden');
    if (revealSwitcher) revealSwitcher.classList.add('hidden');
    if (aiGeneratingBox) aiGeneratingBox.classList.remove('hidden');
    nextBtn.classList.add('hidden');
    if (skipBtn) skipBtn.classList.add('hidden');
    waitMsg.classList.remove('hidden');
    waitMsg.textContent = 'The Judge is working out what happens...';
    return;
  }

  if (aiGeneratingBox) aiGeneratingBox.classList.add('hidden');

  // Populate rankings list for Step 2
  const listEl = document.getElementById('reveal-rankings-list');
  const showMoves = Boolean(app.state.settings?.revealMovesAfterStory || app.isHost);
  listEl.innerHTML = j.rankings.map((r, i) => {
    const p = app.state.players.find(pl => pl.id === r.playerId) || { name: 'Player' };
    const playerMove = app.state.submissions ? app.state.submissions[p.id] : '';
    const hasReadableMove = showMoves && playerMove && !playerMove.startsWith('(') && playerMove !== '__SECRET_ACTION__' && playerMove !== '__LOCKED_IN__';
    const medal = i === 0 ? '1st MVP' : (i === 1 ? '2nd' : (i === 2 ? '3rd' : `#${i + 1}`));
    const modsAddedHtml = (r.modifiersAdded || []).map(m => {
      const { prefix, chipClass } = getModifierDisplayMeta(m);
      return `
        <span class="mod-chip mod-${chipClass}">
          ${prefix ? `${escapeHtml(prefix)} ` : ''}<strong>${escapeHtml(m.name)}</strong>${m.description ? ` (${escapeHtml(m.description)})` : ''}
        </span>
      `;
    }).join('');

    return `
      <div class="ranking-card rank-${i + 1}" style="animation-delay: ${i * 0.07}s;">
        <div class="row-between">
          <div class="rank-player-info">
            <span class="rank-medal">${medal}</span>
            ${renderAvatarHtml(p.character?.avatar, 'avatar-img')}
            <div>
              <strong>${escapeHtml(p.character?.name || p.name)}</strong>
              <span class="award-title-badge">${escapeHtml(r.title)}</span>
            </div>
          </div>
          <div class="rank-points">
            +${(r.pointsAwarded || 0).toLocaleString()} pts
            <div class="tiny text-muted">Total ${(p.score || 0).toLocaleString()}</div>
          </div>
        </div>
        ${hasReadableMove ? `
          <div class="rank-move-quote">
            <span class="tiny text-muted">Move:</span>
            <blockquote class="action-quote">"${escapeHtml(hyphenateLongWords(playerMove))}"</blockquote>
          </div>
        ` : ''}
        <p class="rank-eval">${escapeHtml(r.evaluation)}</p>
        ${modsAddedHtml ? `<div class="new-mods-row">${modsAddedHtml}</div>` : ''}
      </div>
    `;
  }).join('');

  if (step === 1) {
    stopTypewriter();
    if (step1View) step1View.classList.remove('hidden');
    if (step2View) step2View.classList.add('hidden');
    if (revealSwitcher) revealSwitcher.classList.add('hidden');
    if (skipBtn) skipBtn.classList.add('hidden');

    if (app.isHost) {
      nextBtn.classList.remove('hidden');
      nextBtn.textContent = 'Show what happened';
      waitMsg.classList.add('hidden');
    } else {
      nextBtn.classList.add('hidden');
      waitMsg.classList.remove('hidden');
      waitMsg.textContent = 'Outcome ready! Waiting for Host to play out the scene...';
    }
    return;
  }

  if (step1View) step1View.classList.add('hidden');
  if (step2View) step2View.classList.remove('hidden');

  // B12: Show notice above story if demo judge was used as fallback
  const noticeEl = document.getElementById('reveal-judge-notice');
  if (noticeEl) {
    if (j.judgeNotice) {
      noticeEl.textContent = j.judgeNotice;
      noticeEl.classList.remove('hidden');
    } else {
      noticeEl.classList.add('hidden');
    }
  }

  const roundKey = `${app.state.currentRound}-${j.headline}`;
  if (app.typewriter.activeKey !== roundKey) {
    app.revealWindow = 'story';
    startStoryWordByWord(roundKey, j);
  } else if (app.typewriter.finished) {
    showPostStoryVerdictAndLeaderboard(j);
  }
}

/**
 * Starts the dramatic word-by-word typewriter animation for the AI generated story.
 * Includes audio ticking and automatically triggers the verdict when finished.
 * 
 * @param {string} roundKey - Unique cache key for the round narrative
 * @param {object} judgment - AI judgment payload
 */
function startStoryWordByWord(roundKey, judgment) {
  stopTypewriter();
  app.typewriter.activeKey = roundKey;
  app.typewriter.finished = false;

  const step2View = document.getElementById('reveal-step2-view');
  const revealSwitcher = document.getElementById('reveal-window-switcher');
  const storyCard = document.getElementById('reveal-story-card');
  const storyContainer = document.getElementById('reveal-story-paragraphs');
  const verdictBox = document.getElementById('reveal-verdict-box');
  const rankingsBox = document.getElementById('reveal-rankings-box');
  const nextBtn = document.getElementById('btn-host-reveal-next');
  const skipBtn = document.getElementById('btn-host-skip-story');
  const waitMsg = document.getElementById('client-reveal-wait');

  if (step2View) step2View.classList.add('story-centered');
  if (revealSwitcher) revealSwitcher.classList.add('hidden');
  if (storyCard) storyCard.classList.remove('mobile-window-hidden');
  verdictBox.classList.add('hidden');
  rankingsBox.classList.add('hidden');
  nextBtn.classList.add('hidden');
  // B22: Show Skip to everyone for their own view
  if (skipBtn) skipBtn.classList.remove('hidden');
  waitMsg.classList.remove('hidden');
  waitMsg.textContent = 'The scenario is unfolding...';

  const paragraphs = Array.isArray(judgment.storyParagraphs) && judgment.storyParagraphs.length > 0
    ? judgment.storyParagraphs
    : ['Chaos unfolded immediately!'];

  storyContainer.innerHTML = paragraphs.map((_, idx) => `<p id="story-p-${idx}" class="story-para"></p>`).join('');

  const wordQueue = [];
  paragraphs.forEach((pText, pIdx) => {
    const words = String(pText).split(/\s+/).filter(Boolean);
    words.forEach((w, wIdx) => {
      wordQueue.push({ pIdx, word: hyphenateLongWords(w), isFirst: wIdx === 0 });
    });
  });

  let cursor = 0;
  app.typewriter.timer = setInterval(() => {
    if (cursor >= wordQueue.length) {
      clearInterval(app.typewriter.timer);
      app.typewriter.timer = null;
      app.typewriter.finished = true;
      showPostStoryVerdictAndLeaderboard(judgment);
      return;
    }

    const item = wordQueue[cursor];
    const pEl = document.getElementById(`story-p-${item.pIdx}`);
    if (pEl) {
      pEl.textContent += (item.isFirst ? '' : ' ') + item.word;
    }
    if (cursor % 3 === 0) {
      sfx.wordTick();
    }
    cursor++;
  }, 55);
}

/**
 * Skips the active typewriter narration immediately and reveals full paragraphs.
 */
function skipStoryTypewriter() {
  const j = app.state.currentJudgment;
  if (!j) return;
  if (app.typewriter.timer) {
    clearInterval(app.typewriter.timer);
    app.typewriter.timer = null;
  }
  app.typewriter.finished = true;

  const paragraphs = Array.isArray(j.storyParagraphs) && j.storyParagraphs.length > 0
    ? j.storyParagraphs
    : ['Chaos unfolded immediately!'];

  const storyContainer = document.getElementById('reveal-story-paragraphs');
  if (storyContainer) {
    storyContainer.innerHTML = paragraphs.map((pText, idx) => `<p id="story-p-${idx}" class="story-para">${escapeHtml(hyphenateLongWords(pText))}</p>`).join('');
  }

  showPostStoryVerdictAndLeaderboard(j);
}

/**
 * Reveals the outcome verdict banner (Flying Colors, Barely Passed, Failed)
 * and reveals the rankings leaderboard and next round / podium button.
 * 
 * @param {object} j - Judgment payload
 */
function showPostStoryVerdictAndLeaderboard(j) {
  const step2View = document.getElementById('reveal-step2-view');
  const revealSwitcher = document.getElementById('reveal-window-switcher');
  const storyCard = document.getElementById('reveal-story-card');
  const verdictBox = document.getElementById('reveal-verdict-box');
  const rankingsBox = document.getElementById('reveal-rankings-box');
  const btnStory = document.getElementById('reveal-win-btn-story');
  const btnRankings = document.getElementById('reveal-win-btn-rankings');
  const nextBtn = document.getElementById('btn-host-reveal-next');
  const skipBtn = document.getElementById('btn-host-skip-story');
  const waitMsg = document.getElementById('client-reveal-wait');

  if (step2View) step2View.classList.remove('story-centered');
  if (revealSwitcher) revealSwitcher.classList.remove('hidden');
  if (skipBtn) skipBtn.classList.add('hidden');

  if (verdictBox.classList.contains('hidden')) {
    if (j.outcome === 'FLYING_COLORS') {
      verdictBox.className = 'verdict-banner verdict-flying-colors';
      document.getElementById('verdict-stamp').textContent = 'PASSED WITH FLYING COLORS!';
      sfx.verdictFlyingColors();
    } else if (j.outcome === 'BARELY_PASSED') {
      verdictBox.className = 'verdict-banner verdict-barely-passed';
      document.getElementById('verdict-stamp').textContent = 'PASSED (BUT JUST BARELY!)';
      sfx.verdictBarely();
    } else {
      verdictBox.className = 'verdict-banner verdict-fail';
      document.getElementById('verdict-stamp').textContent = 'SCENARIO FAILED — GAME OVER!';
      sfx.verdictFail();
    }
    document.getElementById('verdict-headline').textContent = j.headline;
    const judgeBadge = document.getElementById('verdict-judge-badge');
    if (judgeBadge) {
      judgeBadge.classList.add('hidden');
    }
  }

  rankingsBox.classList.remove('hidden');

  const revWin = app.revealWindow === 'rankings' ? 'rankings' : 'story';
  if (storyCard) storyCard.classList.toggle('mobile-window-hidden', revWin !== 'story');
  if (rankingsBox) rankingsBox.classList.toggle('mobile-window-hidden', revWin !== 'rankings');
  if (btnStory) btnStory.classList.toggle('active', revWin === 'story');
  if (btnRankings) btnRankings.classList.toggle('active', revWin === 'rankings');

  const isFailed = j.outcome === 'FAILED';
  const isLastRound = (app.state.currentRound + 1) >= app.state.activeCampaign.rounds.length;

  if (app.isHost) {
    nextBtn.classList.remove('hidden');
    if (isFailed || isLastRound) {
      nextBtn.textContent = 'See results';
    } else {
      nextBtn.textContent = 'Next round';
    }
    waitMsg.classList.add('hidden');
  } else {
    nextBtn.classList.add('hidden');
    waitMsg.classList.remove('hidden');
    waitMsg.textContent = isFailed
      ? 'Scenario Failed! Waiting for Host to open the Final Podium...'
      : 'Waiting for Host to press Continue...';
  }
}

/**
 * Renders the Grand Finale / Game Over screen.
 * Displays:
 * 1. 1st, 2nd, and 3rd place cartoon pillars with avatar art and final scores.
 * 2. 4th place honorable mention (if 4+ players).
 * 3. Final condition & status modifier summary for every character.
 * 4. Act-by-act multi-round campaign synopsis.
 */
function renderGameOverScreen() {
  const goWin = app.gameOverWindow === 'recap' ? 'recap' : 'results';
  const resultsCard = document.getElementById('gameover-results-card');
  const recapCard = document.getElementById('gameover-recap-card');
  const btnResults = document.getElementById('gameover-win-btn-results');
  const btnRecap = document.getElementById('gameover-win-btn-recap');

  if (resultsCard) resultsCard.classList.toggle('mobile-window-hidden', goWin !== 'results');
  if (recapCard) recapCard.classList.toggle('mobile-window-hidden', goWin !== 'recap');

  if (btnResults) btnResults.classList.toggle('active', goWin === 'results');
  if (btnRecap) btnRecap.classList.toggle('active', goWin === 'recap');

  const sorted = [...app.state.players].sort((a, b) => (b.score || 0) - (a.score || 0));

  // U10: Standard competition tie ranking
  const ranks = [];
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && (sorted[i].score || 0) < (sorted[i - 1].score || 0)) {
      currentRank = i + 1;
    }
    ranks.push(currentRank);
  }
  const rankCounts = {};
  ranks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });

  const getRankLabel = (idx) => {
    if (idx < 0 || idx >= ranks.length) return '';
    const r = ranks[idx];
    const isTie = rankCounts[r] > 1;
    const base = r === 1 ? '1st' : (r === 2 ? '2nd' : (r === 3 ? '3rd' : `${r}th`));
    return isTie ? `${base} (tie)` : base;
  };

  const lastRound = app.state.roundHistory[app.state.roundHistory.length - 1];
  const endedByFailure = lastRound?.judgment?.outcome === 'FAILED';

  const passedCount = app.state.roundHistory.filter(h => h.judgment?.passed).length;
  const totalRoundsInCamp = app.state.activeCampaign?.rounds?.length || app.state.roundHistory.length;

  const mainTitleEl = document.getElementById('finale-main-title');
  if (mainTitleEl) {
    mainTitleEl.textContent = endedByFailure
      ? 'Campaign ended in disaster!'
      : 'Campaign complete!';
  }

  document.getElementById('finale-campaign-summary').textContent = endedByFailure
    ? `Your crew wiped out on Round ${app.state.roundHistory.length} of "${app.state.activeCampaign?.title || 'Campaign'}" after surviving ${passedCount} act(s)!`
    : `Your crew survived all ${totalRoundsInCamp} acts of "${app.state.activeCampaign?.title || 'Campaign'}"!`;

  const podiumStageEl = document.getElementById('final-podium-stage');
  if (podiumStageEl) {
    const first = sorted[0];
    const second = sorted[1];
    const third = sorted[2];

    const renderPillar = (p, placeNum, label) => {
      if (!p) return '';
      return `
        <div class="podium-pillar place-${placeNum}">
          <div class="podium-rank-tag">${label}</div>
          ${renderAvatarHtml(p.character?.avatar, 'avatar-img-lg')}
          <h4 class="podium-pillar-name mt-1">${escapeHtml(p.character?.name || p.name)}</h4>
          <div class="podium-pillar-player text-muted tiny">Played by ${escapeHtml(p.name)}</div>
          <div class="podium-pillar-role text-muted tiny">${escapeHtml(p.character?.role || '')}</div>
          <div class="podium-score">${(p.score || 0).toLocaleString()} pts</div>
        </div>
      `;
    };

    podiumStageEl.innerHTML = `
      ${renderPillar(second, 2, getRankLabel(1))}
      ${renderPillar(first, 1, getRankLabel(0))}
      ${renderPillar(third, 3, getRankLabel(2))}
    `;
  }

  const leaderboardEl = document.getElementById('final-leaderboard-list');
  if (leaderboardEl) {
    leaderboardEl.innerHTML = sorted.map((p, i) => {
      const rankLabel = getRankLabel(i);
      const isWinner = ranks[i] === 1;
      return `
        <div class="podium-card ${isWinner ? 'podium-winner' : ''}">
          <div class="row-between">
            <div class="rank-player-info" style="min-width:0; flex:1;">
              <span class="rank-medal">${rankLabel}</span>
              ${renderAvatarHtml(p.character?.avatar, 'avatar-img')}
              <div style="min-width:0; flex:1; overflow-wrap:break-word; word-break:break-word;">
                <h4 style="white-space:normal; overflow-wrap:break-word; word-break:break-word;">${escapeHtml(p.character?.name || p.name)}</h4>
                <div class="text-muted small" style="white-space:normal; overflow-wrap:break-word; word-break:break-word;">Played by ${escapeHtml(p.name)} • ${escapeHtml(p.character?.role || '')}</div>
              </div>
            </div>
            <div class="final-score-box">${(p.score || 0).toLocaleString()} pts</div>
          </div>
          <div class="mt-1">
            <span class="mod-label">Final Character Condition &amp; Modifiers:</span>
            <div class="modifier-chips">${renderModifierChips(p.modifiers)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  const recapEl = document.getElementById('final-campaign-recap-list');
  const showRecapMoves = Boolean(app.state.settings?.revealMovesAfterStory || app.isHost);
  if (recapEl) {
    recapEl.innerHTML = app.state.roundHistory.map((h, idx) => {
      const out = h.judgment?.outcome || 'FLYING_COLORS';
      const badgeClass = out === 'FLYING_COLORS' ? 'badge-success' : (out === 'BARELY_PASSED' ? 'badge-warn' : 'badge-danger');
      const badgeText = out === 'FLYING_COLORS'
        ? 'Flying Colors'
        : (out === 'BARELY_PASSED' ? 'Barely Passed' : 'Wiped Out');
      const cleanTitle = (h.roundTitle || '').replace(/^(Act|Round)\s+[IVX0-9]+:\s*/i, '');
      const roundMoves = showRecapMoves && h.submissions ? app.state.players.map(p => {
        const move = h.submissions[p.id];
        if (!move || move.startsWith('(') || move === '__SECRET_ACTION__' || move === '__LOCKED_IN__') return '';
        return `
          <div class="tiny text-muted mt-tight">
            <strong>${escapeHtml(p.character?.name || p.name)}:</strong> "${escapeHtml(hyphenateLongWords(move))}"
          </div>
        `;
      }).filter(Boolean).join('') : '';

      return `
        <div class="summary-round-item">
          <div class="row-between mb-1">
            <strong>Round ${idx + 1}: ${escapeHtml(cleanTitle)}</strong>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <div style="font-family: var(--font-display); font-weight:700; color: var(--accent-gold); margin-bottom:0.35rem;">
            ${escapeHtml(h.judgment?.headline || '')}
          </div>
          <p class="text-muted small">
            ${escapeHtml(hyphenateLongWords((h.judgment?.storyParagraphs || []).join(' ')))}
          </p>
          ${roundMoves ? `
            <div class="mt-1">
              <span class="tiny text-muted"><strong>Crew moves:</strong></span>
              ${roundMoves}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  const playAgainBtn = document.getElementById('btn-host-play-again');
  const clientWait = document.getElementById('client-gameover-waiting');
  if (playAgainBtn) playAgainBtn.classList.toggle('hidden', !app.isHost);
  if (clientWait) clientWait.classList.toggle('hidden', app.isHost);
}
