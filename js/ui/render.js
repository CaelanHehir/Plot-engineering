// Screen Rendering Engine & Typewriter Story Playback

function stopTypewriter() {
  if (app.typewriter.timer) {
    clearInterval(app.typewriter.timer);
    app.typewriter.timer = null;
  }
  app.typewriter.activeKey = '';
  app.typewriter.finished = false;
}

function renderState() {
  const phase = app.state.phase;
  const screens = ['HOME', 'LOBBY', 'CHAR_CREATE', 'SCENARIO', 'REVEAL', 'GAME_OVER'];
  screens.forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.toggle('hidden', s !== phase);
  });

  const backBtn = document.getElementById('btn-global-back');
  if (backBtn) {
    if (phase === 'HOME') {
      backBtn.classList.add('hidden');
    } else {
      backBtn.classList.remove('hidden');
      if (!app.isHost) {
        backBtn.textContent = '⬅️ Leave Room';
      } else if (phase === 'LOBBY') {
        backBtn.textContent = '⬅️ Exit to Home';
      } else {
        backBtn.textContent = '⬅️ Back to Lobby';
      }
    }
  }

  const settingsBtn = document.getElementById('btn-top-settings');
  if (settingsBtn) {
    settingsBtn.classList.toggle('hidden', !app.isHost && phase !== 'HOME');
  }

  const roomBadge = document.getElementById('top-room-badge');
  if (roomBadge) {
    if (phase !== 'HOME' && app.state.roomCode) {
      roomBadge.classList.remove('hidden');
      roomBadge.innerHTML = `🎟️ ROOM: <strong>${escapeHtml(app.state.roomCode)}</strong>`;
    } else {
      roomBadge.classList.add('hidden');
    }
  }

  if (phase !== 'SCENARIO') {
    app.scenarioPopupOpen = false;
    const scenModal = document.getElementById('scenario-popup-modal');
    if (scenModal) scenModal.classList.add('hidden');
  }

  if (phase !== 'LOBBY') {
    const qrModal = document.getElementById('qr-popup-modal');
    if (qrModal) qrModal.classList.add('hidden');
  }

  if (phase === 'HOME') renderHomeWindow();
  if (phase === 'LOBBY') renderLobbyScreen();
  if (phase === 'CHAR_CREATE') renderCharCreateScreen();
  if (phase === 'SCENARIO') renderScenarioScreen();
  if (phase === 'REVEAL') renderRevealScreen();
  if (phase === 'GAME_OVER') renderGameOverScreen();
}

function renderLobbyScreen() {
  document.getElementById('lobby-room-code-display').textContent = app.state.roomCode;

  const lobbyWin = app.lobbyWindow === 'stage' ? 'stage' : 'cast';
  const leftCol = document.getElementById('lobby-left-col');
  const rightCol = document.getElementById('lobby-right-col');
  const btnCast = document.getElementById('lobby-win-btn-cast');
  const btnStage = document.getElementById('lobby-win-btn-stage');
  if (leftCol) leftCol.classList.toggle('mobile-window-hidden', lobbyWin !== 'cast');
  if (rightCol) rightCol.classList.toggle('mobile-window-hidden', lobbyWin !== 'stage');
  if (btnCast) {
    btnCast.classList.toggle('active', lobbyWin === 'cast');
    btnCast.textContent = `🎟️ Room & Cast (${app.state.players.length})`;
  }
  if (btnStage) {
    btnStage.classList.toggle('active', lobbyWin === 'stage');
    btnStage.textContent = app.isHost ? '🎬 Campaign & Rules' : '🎬 Stage Preview';
  }

  const joinUrlPill = document.getElementById('lobby-join-url-pill');
  if (joinUrlPill) {
    joinUrlPill.innerHTML = `🌐 JOIN AT: <strong>${escapeHtml(getShortDisplayJoinUrl())}</strong>`;
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

  const listEl = document.getElementById('lobby-player-list');
  listEl.innerHTML = app.state.players.map(p => {
    const isMe = p.id === app.myId;
    return `
      <div class="player-pill ${isMe ? 'is-me-pill' : ''}">
        <div class="row-gap" style="gap:6px; min-width:0;">
          <span class="player-pill-icon">${p.isBot ? '🤖' : (p.isHost ? '👑' : '🎭')}</span>
          <span class="player-pill-name" title="${escapeHtml(p.name)}">
            ${escapeHtml(p.name)} ${isMe ? '<small>(You)</small>' : ''}
          </span>
        </div>
        ${app.isHost && !isMe ? `<button type="button" class="btn-icon-remove" title="Remove" onclick="removePlayer('${p.id}')">✕</button>` : ''}
      </div>
    `;
  }).join('');

  document.getElementById('host-lobby-controls').classList.toggle('hidden', !app.isHost);
  document.getElementById('client-lobby-waiting').classList.toggle('hidden', app.isHost);

  if (app.isHost) {
    renderCampaignSelector();
  }

  // Populate live Stage Preview card for waiting guests
  const previewEl = document.getElementById('client-campaign-preview');
  if (previewEl) {
    const mode = app.state.campaignMode || 'premade';
    if (mode === 'premade') {
      const camp = PREMADE_CAMPAIGNS.find(c => c.id === app.state.selectedPremadeId) || PREMADE_CAMPAIGNS[0];
      previewEl.innerHTML = `
        <div class="campaign-card-header">
          <span class="campaign-icon">${camp.icon}</span>
          <div>
            <h3>${escapeHtml(camp.title)}</h3>
            <span class="badge badge-genre">${escapeHtml(camp.genre)} • ${camp.rounds.length} Rounds</span>
          </div>
        </div>
        <p class="mt-1">${escapeHtml(camp.description)}</p>
      `;
    } else if (mode === 'ai') {
      const rounds = app.state.aiRoundCount || 4;
      const promptSnippet = (app.state.aiPrompt || '').trim();
      previewEl.innerHTML = `
        <div class="campaign-card-header">
          <span class="campaign-icon">✨</span>
          <div>
            <h3>AI-Generated Custom Campaign</h3>
            <span class="badge badge-warn">🔮 Gemini Plot • ${rounds} Rounds</span>
          </div>
        </div>
        <p class="mt-1">${promptSnippet ? `"${escapeHtml(promptSnippet)}"` : 'The Host is cooking up a custom AI movie plot for the crew!'}</p>
      `;
    } else {
      const custom = app.state.customCampaign || {};
      const roundCount = Array.isArray(custom.rounds) ? custom.rounds.length : 3;
      previewEl.innerHTML = `
        <div class="campaign-card-header">
          <span class="campaign-icon">✍️</span>
          <div>
            <h3>${escapeHtml(custom.title || 'Host Custom Adventure')}</h3>
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
    const timerTxt = s.roundTimer > 0 ? `${s.roundTimer}s (${Math.round(s.roundTimer / 60 * 10) / 10}m)` : 'Unlimited';
    summaryEl.innerHTML = `⏱️ Timer: <strong>${timerTxt}</strong> &bull; ⚖️ Judge: <strong>${s.strictness.toUpperCase()}</strong> &bull; 🏆 Multiplier: <strong>${s.pointsMultiplier}x</strong>`;
  }
}

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
        <div class="campaign-card ${selected ? 'selected' : ''}" onclick="selectPremadeCampaign('${c.id}')">
          <div class="campaign-card-header">
            <span class="campaign-icon">${c.icon}</span>
            <div>
              <h4>${escapeHtml(c.title)}</h4>
              <span class="badge badge-genre">${escapeHtml(c.genre)} • ${c.rounds.length} Rounds</span>
            </div>
          </div>
          <p class="small text-muted">${escapeHtml(c.description)}</p>
        </div>
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
          <strong>🎬 Round ${i + 1}</strong>
          ${app.state.customCampaign.rounds.length > 1 ? `<button type="button" class="btn-small btn-danger" onclick="removeCustomRound(${i})">Remove</button>` : ''}
        </div>
        <input type="text" class="input-field" value="${escapeHtml(r.title)}" placeholder="Round Title"
          onchange="app.state.customCampaign.rounds[${i}].title = this.value" />
        <label class="tiny text-muted" style="margin-top:2px;">1. Scene Setup (Shown to Players — set the stage without spoiling!):</label>
        <textarea class="input-field" rows="2" placeholder="e.g., A massive troll in a clip-on tie blocks the bridge and glares at the party."
          onchange="app.state.customCampaign.rounds[${i}].scenario = this.value">${escapeHtml(r.scenario || '')}</textarea>
        <label class="tiny text-muted" style="margin-top:2px;">2. Comedic Hooks &amp; Quirks (Shown to AI Judge — fun personalities &amp; improv fuel!):</label>
        <textarea class="input-field" rows="2" placeholder="e.g., The troll is super insecure about his tie and loves dramatic flattery or slapstick combos!"
          onchange="app.state.customCampaign.rounds[${i}].secrets = this.value">${escapeHtml(r.secrets || '')}</textarea>
      </div>
    `).join('');
  }
}

function renderCharCreateScreen() {
  const camp = app.state.activeCampaign;
  if (!camp) return;

  document.getElementById('char-camp-title').textContent = `${camp.icon || '🎭'} ${camp.title}`;
  document.getElementById('char-camp-desc').textContent = camp.description;

  const quirkGroup = document.getElementById('char-quirk-group');
  if (quirkGroup) {
    quirkGroup.classList.toggle('hidden', !app.state.settings.allowStartingQuirk);
  }

  const charTimerEl = document.getElementById('char-create-timer');
  if (charTimerEl) {
    if (app.state.settings.charCreateTimer > 0) {
      charTimerEl.classList.remove('hidden');
      charTimerEl.textContent = `⏱️ ${formatSeconds(app.state.timeLeft)}`;
    } else {
      charTimerEl.classList.add('hidden');
    }
  }

  const me = app.state.players.find(p => p.id === app.myId);
  const isReady = Boolean(me && me.character && me.character.ready);

  const step = isReady ? 2 : (app.charCreateStep === 3 ? 3 : (app.charCreateStep === 2 ? 2 : 1));
  const creatorCard = document.getElementById('char-creator-card');
  const rosterCard = document.getElementById('char-roster-card');
  if (creatorCard) creatorCard.classList.toggle('mobile-window-hidden', step === 3 && !isReady);
  if (rosterCard) rosterCard.classList.toggle('mobile-window-hidden', step !== 3 && !isReady);

  document.getElementById('char-form-box').classList.toggle('hidden', isReady);
  document.getElementById('char-waiting-box').classList.toggle('hidden', !isReady);

  const stage1El = document.getElementById('char-stage-1');
  const stage2El = document.getElementById('char-stage-2');
  const stepBtn1 = document.getElementById('char-step-btn-1');
  const stepBtn2 = document.getElementById('char-step-btn-2');
  const stepBtn3 = document.getElementById('char-step-btn-3');
  if (stage1El) stage1El.classList.toggle('hidden', step !== 1);
  if (stage2El) stage2El.classList.toggle('hidden', step !== 2);
  if (stepBtn1) stepBtn1.classList.toggle('active', step === 1);
  if (stepBtn2) stepBtn2.classList.toggle('active', step === 2);
  if (stepBtn3) {
    const readyCount = app.state.players.filter(p => p.character && p.character.ready).length;
    stepBtn3.classList.toggle('active', step === 3);
    stepBtn3.textContent = `📸 Crew (${readyCount}/${app.state.players.length})`;
  }

  const summaryBanner = document.getElementById('char-stage2-summary');
  if (summaryBanner) {
    const nameVal = (document.getElementById('char-name-input')?.value || '').trim() || 'Your Hero';
    const roleVal = (document.getElementById('char-role-input')?.value || '').trim();
    summaryBanner.innerHTML = `🎨 Drawing: <strong>${escapeHtml(nameVal)}</strong>${roleVal ? ` <span class="text-muted small">(${escapeHtml(roleVal)})</span>` : ''}`;
  }

  const statusEl = document.getElementById('char-ready-list');
  statusEl.innerHTML = app.state.players.map(p => {
    const ready = Boolean(p.character && p.character.ready);
    const photoContent = ready && p.character?.avatar && p.character.avatar.startsWith('data:image/')
      ? `<img src="${p.character.avatar}" alt="${escapeHtml(p.character.name)}" />`
      : `<span style="font-size:2.4rem;">🎨</span>`;
    return `
      <div class="polaroid-card ${ready ? 'is-ready' : ''}">
        <div class="polaroid-photo-frame">
          ${photoContent}
        </div>
        <div class="polaroid-name">${escapeHtml(ready ? p.character.name : p.name)}</div>
        <div class="polaroid-role">${ready ? escapeHtml(p.character.role) : 'Sketching hero...'}</div>
        <div class="polaroid-status-tag">
          <span class="badge ${ready ? 'badge-success' : 'badge-warn'}">${ready ? '✅ Ready!' : '✏️ Drawing'}</span>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('btn-host-skip-char').classList.toggle('hidden', !app.isHost);
}

function renderScenarioScreen() {
  const camp = app.state.activeCampaign;
  const roundIdx = app.state.currentRound;
  const roundObj = camp.rounds[roundIdx];
  const me = app.state.players.find(p => p.id === app.myId);

  const roundPopupKey = `${app.state.roomCode}-${camp.id || camp.title}-r${roundIdx}`;
  if (app.scenarioPopupKey !== roundPopupKey) {
    app.scenarioPopupKey = roundPopupKey;
    app.scenarioPopupOpen = true;
    app.scenarioWindow = 'action';
  }

  const scenModal = document.getElementById('scenario-popup-modal');
  if (scenModal) {
    scenModal.classList.toggle('hidden', !app.scenarioPopupOpen);
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

  const activeWin = app.scenarioWindow === 'crew' ? 'crew' : 'action';
  const winActionEl = document.getElementById('scenario-window-action');
  const winCrewEl = document.getElementById('scenario-window-crew');
  const btnActionEl = document.getElementById('scenario-win-btn-action');
  const btnCrewEl = document.getElementById('scenario-win-btn-crew');
  if (winActionEl) winActionEl.classList.toggle('hidden', activeWin !== 'action');
  if (winCrewEl) winCrewEl.classList.toggle('hidden', activeWin !== 'crew');
  if (btnActionEl) btnActionEl.classList.toggle('active', activeWin === 'action');
  if (btnCrewEl) {
    btnCrewEl.classList.toggle('active', activeWin === 'crew');
    const lockedCount = app.state.players.filter(p => Boolean(app.state.submissions[p.id])).length;
    btnCrewEl.textContent = `👥 Crew Status (${lockedCount}/${app.state.players.length})`;
  }

  if (myBlindedMod) {
    const redacted = roundObj.scenario
      .split(/\s+/)
      .map((w, i) => (i % 2 === 1 ? '█████' : w))
      .join(' ');
    document.getElementById('scenario-description').textContent = `🕶️ [BLINDED BY "${myBlindedMod.name}"] ${redacted}`;
  } else {
    document.getElementById('scenario-description').textContent = roundObj.scenario;
  }

  const bridgeBox = document.getElementById('scenario-bridge-box');
  if (roundIdx > 0 && app.state.roundHistory.length > 0) {
    const prev = app.state.roundHistory[app.state.roundHistory.length - 1];
    bridgeBox.classList.remove('hidden');
    bridgeBox.innerHTML = `<strong>🎞️ Previously:</strong> ${escapeHtml(prev.judgment?.continuityBridge || prev.judgment?.headline || '')}`;
  } else {
    bridgeBox.classList.add('hidden');
  }

  const timerEl = document.getElementById('scenario-timer');
  const addTimeBtn = document.getElementById('btn-host-add-time');
  if (app.state.settings.roundTimer > 0) {
    timerEl.classList.remove('hidden');
    timerEl.textContent = `⏱️ ${formatSeconds(app.state.timeLeft)}`;
    timerEl.classList.toggle('timer-urgent', app.state.timeLeft <= 20);
    if (addTimeBtn) addTimeBtn.classList.toggle('hidden', !app.isHost);
  } else {
    timerEl.classList.add('hidden');
    if (addTimeBtn) addTimeBtn.classList.add('hidden');
  }

  if (me) {
    document.getElementById('my-char-banner').innerHTML = `
      <div class="my-char-header">
        ${renderAvatarHtml(me.character?.avatar, 'avatar-img-lg')}
        <div>
          <h4>${escapeHtml(me.character?.name || me.name)}</h4>
          <p class="text-muted small">${escapeHtml(me.character?.role || '')}</p>
        </div>
      </div>
      <div class="modifiers-section">
        <span class="mod-label">Your Active Perks &amp; Status Effects:</span>
        <div class="modifier-chips">
          ${renderModifierChips(me.modifiers)}
        </div>
      </div>
    `;
  }

  const actionInput = document.getElementById('scenario-action-input');
  if (actionInput) {
    actionInput.placeholder = myWordLimitMod
      ? `😶 "${myWordLimitMod.name}" active: You may only type up to 5 words this round!`
      : 'Write your character\'s move! Funny or unrealistic ideas work great if they coordinate and cohere with your crew!';
  }

  const hasSubmitted = Boolean(app.state.submissions[app.myId]);
  document.getElementById('scenario-input-area').classList.toggle('hidden', hasSubmitted);
  const lockedArea = document.getElementById('scenario-locked-area');
  lockedArea.classList.toggle('hidden', !hasSubmitted);

  if (hasSubmitted) {
    if (myDeadMod) {
      lockedArea.innerHTML = `
        <div class="big-locked-stamp" style="background:var(--accent-red); color:#fff;">💀 ELIMINATED!</div>
        <p class="text-muted small">Your character met an untimely demise and is spectating the survivors.</p>
      `;
    } else if (mySkipMod) {
      lockedArea.innerHTML = `
        <div class="big-locked-stamp" style="background:var(--accent-gold); color:var(--ink);">⛓️ ${escapeHtml(mySkipMod.name)}!</div>
        <p class="text-muted small">${escapeHtml(mySkipMod.description || 'You cannot act this round unless a teammate rescues you!')}</p>
      `;
    } else {
      lockedArea.innerHTML = `
        <div class="big-locked-stamp">🔒 MOVE LOCKED IN!</div>
        <p class="text-muted small mb-2">Keep a poker face while your teammates finish typing...</p>
        <button type="button" class="btn btn-secondary" onclick="unlockMyActionToEdit()">
          ✏️ Change My Move
        </button>
      `;
    }
  }

  const rosterEl = document.getElementById('scenario-party-status');
  rosterEl.innerHTML = app.state.players.map(p => {
    const locked = Boolean(app.state.submissions[p.id]);
    const pDead = getPlayerMetaMod(p, 'DEAD');
    const pSkip = getPlayerMetaMod(p, 'SKIP_TURN');
    const statusBadge = pDead
      ? `<span class="badge btn-danger">💀 Dead</span>`
      : pSkip
      ? `<span class="badge badge-warn">⛓️ ${escapeHtml(pSkip.name)}</span>`
      : `<span class="badge ${locked ? 'badge-success' : 'badge-warn'}">${locked ? '🔒 Locked In!' : '✏️ Writing...'}</span>`;

    return `
      <div class="party-status-card ${locked ? 'locked' : ''}">
        <div class="row-between">
          <div class="row-gap">
            ${renderAvatarHtml(p.character?.avatar, 'avatar-img-sm')}
            <strong>${escapeHtml(p.character?.name || p.name)}</strong>
            <span class="score-pill">${p.score} PTS</span>
          </div>
          ${statusBadge}
        </div>
        <div class="text-muted small mt-1">${escapeHtml(p.character?.role || '')}</div>
        <div class="modifier-chips mt-1">${renderModifierChips(p.modifiers)}</div>
      </div>
    `;
  }).join('');

  document.getElementById('btn-host-force-judge').classList.toggle('hidden', !app.isHost);
}

function renderRevealScreen() {
  const j = app.state.currentJudgment;
  const step = app.state.revealStep;
  const isJudging = app.state.isJudging;

  const step1View = document.getElementById('reveal-step1-view');
  const step2View = document.getElementById('reveal-step2-view');
  const revealSwitcher = document.getElementById('reveal-window-switcher');
  const aiGeneratingBox = document.getElementById('reveal-ai-generating-box');
  const prevBtn = document.getElementById('btn-host-reveal-prev');
  const nextBtn = document.getElementById('btn-host-reveal-next');
  const skipBtn = document.getElementById('btn-host-skip-story');
  const waitMsg = document.getElementById('client-reveal-wait');

  // 1. Populate "What Everyone Decided To Do" as Cartoon Speech Bubbles & Censor Tape
  const actionsGrid = document.getElementById('reveal-actions-grid');
  actionsGrid.innerHTML = app.state.players.map((p, idx) => {
    const isHidden = Boolean(
      (app.state.hiddenSubmissions && app.state.hiddenSubmissions[p.id]) ||
      app.state.submissions[p.id] === '__SECRET_ACTION__'
    );
    const actionText = app.state.submissions[p.id] || '(Panicked and did nothing!)';
    const quoteHtml = isHidden
      ? `<div class="action-quote-hidden">🕵️ TOP SECRET MOVE — Redacted by Player!</div>`
      : `<blockquote class="action-quote">"${escapeHtml(actionText)}"</blockquote>`;

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
    prevBtn.classList.add('hidden');
    nextBtn.classList.add('hidden');
    if (skipBtn) skipBtn.classList.add('hidden');
    waitMsg.classList.remove('hidden');
    waitMsg.textContent = '🔮 Read the speech bubbles while Gemini judges the outcome...';
    return;
  }

  if (aiGeneratingBox) aiGeneratingBox.classList.add('hidden');

  // Populate rankings list for Step 2
  const listEl = document.getElementById('reveal-rankings-list');
  listEl.innerHTML = j.rankings.map((r, i) => {
    const p = app.state.players.find(pl => pl.id === r.playerId) || { name: 'Player' };
    const medal = i === 0 ? '🥇 #1 MVP' : (i === 1 ? '🥈 #2' : (i === 2 ? '🥉 #3' : `#${i + 1}`));
    const modsAddedHtml = (r.modifiersAdded || []).map(m => {
      const { prefix, chipClass } = getModifierDisplayMeta(m);
      return `
        <span class="mod-chip mod-${chipClass}">
          ${prefix} <strong>${escapeHtml(m.name)}</strong> (${escapeHtml(m.description)})
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
              <span class="award-title-badge">🏅 ${escapeHtml(r.title)}</span>
            </div>
          </div>
          <div class="rank-points">
            +${r.pointsAwarded} PTS
            <div class="tiny text-muted">Total: ${p.score} PTS</div>
          </div>
        </div>
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
      prevBtn.classList.add('hidden');
      nextBtn.classList.remove('hidden');
      nextBtn.textContent = '▶️ Play Out Scenario!';
      waitMsg.classList.add('hidden');
    } else {
      prevBtn.classList.add('hidden');
      nextBtn.classList.add('hidden');
      waitMsg.classList.remove('hidden');
      waitMsg.textContent = 'Outcome ready! Waiting for Host to play out the scene...';
    }
    return;
  }

  if (step1View) step1View.classList.add('hidden');
  if (step2View) step2View.classList.remove('hidden');

  if (app.isHost) {
    prevBtn.classList.remove('hidden');
  } else {
    prevBtn.classList.add('hidden');
  }

  const roundKey = `${app.state.currentRound}-${j.headline}`;
  if (app.typewriter.activeKey !== roundKey) {
    app.revealWindow = 'story';
    startStoryWordByWord(roundKey, j);
  } else if (app.typewriter.finished) {
    showPostStoryVerdictAndLeaderboard(j);
  }
}

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
  if (skipBtn) skipBtn.classList.toggle('hidden', !app.isHost);
  waitMsg.classList.remove('hidden');
  waitMsg.textContent = '📖 The scenario is unfolding...';

  const paragraphs = Array.isArray(judgment.storyParagraphs) && judgment.storyParagraphs.length > 0
    ? judgment.storyParagraphs
    : ['Chaos unfolded immediately!'];

  storyContainer.innerHTML = paragraphs.map((_, idx) => `<p id="story-p-${idx}" class="story-para"></p>`).join('');

  const wordQueue = [];
  paragraphs.forEach((pText, pIdx) => {
    const words = String(pText).split(/\s+/).filter(Boolean);
    words.forEach((w, wIdx) => {
      wordQueue.push({ pIdx, word: w, isFirst: wIdx === 0 });
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
    storyContainer.innerHTML = paragraphs.map((pText, idx) => `<p id="story-p-${idx}" class="story-para">${escapeHtml(pText)}</p>`).join('');
  }

  showPostStoryVerdictAndLeaderboard(j);
}

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
      document.getElementById('verdict-stamp').textContent = '🌟 PASSED WITH FLYING COLORS!';
      sfx.verdictFlyingColors();
    } else if (j.outcome === 'BARELY_PASSED') {
      verdictBox.className = 'verdict-banner verdict-barely-passed';
      document.getElementById('verdict-stamp').textContent = '😅 PASSED (BUT JUST BARELY!)';
      sfx.verdictBarely();
    } else {
      verdictBox.className = 'verdict-banner verdict-fail';
      document.getElementById('verdict-stamp').textContent = '💥 SCENARIO FAILED — GAME OVER!';
      sfx.verdictFail();
    }
    document.getElementById('verdict-headline').textContent = j.headline;
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
    if (isFailed) {
      nextBtn.textContent = '🏆 View Final Podium & Summary ➡️';
    } else if (isLastRound) {
      nextBtn.textContent = '🏆 View Grand Finale Podium ➡️';
    } else {
      nextBtn.textContent = `▶️ Next Act: Round ${app.state.currentRound + 2} ➡️`;
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

function renderGameOverScreen() {
  const goWin = app.gameOverWindow === 'recap' ? 'recap' : 'podium';
  const podiumCard = document.getElementById('gameover-podium-card');
  const recapCard = document.getElementById('gameover-recap-card');
  const btnPodium = document.getElementById('gameover-win-btn-podium');
  const btnRecap = document.getElementById('gameover-win-btn-recap');
  if (podiumCard) podiumCard.classList.toggle('mobile-window-hidden', goWin !== 'podium');
  if (recapCard) recapCard.classList.toggle('mobile-window-hidden', goWin !== 'recap');
  if (btnPodium) btnPodium.classList.toggle('active', goWin === 'podium');
  if (btnRecap) btnRecap.classList.toggle('active', goWin === 'recap');

  const sorted = [...app.state.players].sort((a, b) => b.score - a.score);
  const lastRound = app.state.roundHistory[app.state.roundHistory.length - 1];
  const endedByFailure = lastRound?.judgment?.outcome === 'FAILED';

  const passedCount = app.state.roundHistory.filter(h => h.judgment?.passed).length;
  const totalRoundsInCamp = app.state.activeCampaign?.rounds?.length || app.state.roundHistory.length;

  const mainTitleEl = document.getElementById('finale-main-title');
  if (mainTitleEl) {
    mainTitleEl.textContent = endedByFailure
      ? '💥 Campaign Ended in Disaster!'
      : '🏆 Campaign Complete!';
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
          <h4 class="mt-1">${escapeHtml(p.character?.name || p.name)}</h4>
          <div class="text-muted tiny">Played by ${escapeHtml(p.name)}</div>
          <div class="text-muted tiny">${escapeHtml(p.character?.role || '')}</div>
          <div class="podium-score">${p.score} PTS</div>
        </div>
      `;
    };

    podiumStageEl.innerHTML = `
      ${renderPillar(second, 2, '🥈 2nd Place')}
      ${renderPillar(first, 1, '👑 1st Place')}
      ${renderPillar(third, 3, '🥉 3rd Place')}
    `;
  }

  const honorableEl = document.getElementById('final-honorable-mention');
  if (honorableEl) {
    if (sorted.length >= 4) {
      const fourth = sorted[3];
      honorableEl.classList.remove('hidden');
      honorableEl.innerHTML = `
        <div class="row-between">
          <div class="rank-player-info">
            <span class="badge badge-genre">🎖️ 4TH PLACE HONORABLE MENTION</span>
            ${renderAvatarHtml(fourth.character?.avatar, 'avatar-img')}
            <div>
              <strong>${escapeHtml(fourth.character?.name || fourth.name)}</strong>
              <span class="text-muted small"> (${escapeHtml(fourth.name)})</span>
              <div class="text-muted tiny">${escapeHtml(fourth.character?.role || '')}</div>
            </div>
          </div>
          <div class="final-score-box">${fourth.score} PTS</div>
        </div>
      `;
    } else {
      honorableEl.classList.add('hidden');
    }
  }

  const leaderboardEl = document.getElementById('final-leaderboard-list');
  if (leaderboardEl) {
    leaderboardEl.innerHTML = sorted.map((p, i) => {
      const rankLabel = i === 0 ? '👑 #1' : (i === 1 ? '🥈 #2' : (i === 2 ? '🥉 #3' : (i === 3 ? '🎖️ #4' : `#${i + 1}`)));
      return `
        <div class="podium-card ${i === 0 ? 'podium-winner' : ''}">
          <div class="row-between">
            <div class="rank-player-info">
              <span class="rank-medal">${rankLabel}</span>
              ${renderAvatarHtml(p.character?.avatar, 'avatar-img')}
              <div>
                <h4>${escapeHtml(p.character?.name || p.name)}</h4>
                <div class="text-muted small">Played by ${escapeHtml(p.name)} • ${escapeHtml(p.character?.role || '')}</div>
              </div>
            </div>
            <div class="final-score-box">${p.score} PTS</div>
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
  if (recapEl) {
    recapEl.innerHTML = app.state.roundHistory.map((h, idx) => {
      const out = h.judgment?.outcome || 'FLYING_COLORS';
      const badgeClass = out === 'FLYING_COLORS' ? 'badge-success' : (out === 'BARELY_PASSED' ? 'badge-warn' : 'btn-danger');
      const badgeText = out === 'FLYING_COLORS'
        ? '🌟 Flying Colors'
        : (out === 'BARELY_PASSED' ? '😅 Barely Passed' : '💥 Wiped Out');
      return `
        <div class="summary-round-item">
          <div class="row-between mb-1">
            <strong>🎬 Act ${idx + 1}: ${escapeHtml(h.roundTitle)}</strong>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <div style="font-family: var(--font-display); font-weight:700; color: var(--accent-gold); margin-bottom:5px;">
            ${escapeHtml(h.judgment?.headline || '')}
          </div>
          <p class="text-muted small">
            ${escapeHtml((h.judgment?.storyParagraphs || []).join(' '))}
          </p>
        </div>
      `;
    }).join('');
  }

  document.getElementById('btn-host-play-again').classList.toggle('hidden', !app.isHost);
}
