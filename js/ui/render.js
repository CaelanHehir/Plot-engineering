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
      roomBadge.innerHTML = `ROOM CODE: <strong>${escapeHtml(app.state.roomCode)}</strong>`;
    } else {
      roomBadge.classList.add('hidden');
    }
  }

  if (phase === 'LOBBY') renderLobbyScreen();
  if (phase === 'CHAR_CREATE') renderCharCreateScreen();
  if (phase === 'SCENARIO') renderScenarioScreen();
  if (phase === 'REVEAL') renderRevealScreen();
  if (phase === 'GAME_OVER') renderGameOverScreen();
}

function renderLobbyScreen() {
  document.getElementById('lobby-room-code-display').textContent = app.state.roomCode;

  const listEl = document.getElementById('lobby-player-list');
  listEl.innerHTML = app.state.players.map(p => `
    <div class="player-pill">
      <span class="player-pill-icon">${p.isBot ? '🤖' : (p.isHost ? '👑' : '🎮')}</span>
      <span class="player-pill-name">${escapeHtml(p.name)} ${p.id === app.myId ? '<em>(You)</em>' : ''}</span>
      ${app.isHost && p.id !== app.myId ? `<button type="button" class="btn-icon-remove" title="Remove" onclick="removePlayer('${p.id}')">✕</button>` : ''}
    </div>
  `).join('');

  document.getElementById('host-lobby-controls').classList.toggle('hidden', !app.isHost);
  document.getElementById('client-lobby-waiting').classList.toggle('hidden', app.isHost);

  const s = app.state.settings;
  const summaryEl = document.getElementById('client-settings-summary');
  if (summaryEl) {
    const timerTxt = s.roundTimer > 0 ? `${s.roundTimer}s (${Math.round(s.roundTimer / 60 * 10) / 10} min)` : 'No Timer';
    summaryEl.textContent = `Round Timer: ${timerTxt} • Judge Mode: ${s.strictness.toUpperCase()} • Points: ${s.pointsMultiplier}x`;
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
          <p>${escapeHtml(c.description)}</p>
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
          <strong>Round ${i + 1}</strong>
          ${app.state.customCampaign.rounds.length > 1 ? `<button type="button" class="btn-small btn-danger" onclick="removeCustomRound(${i})">Remove</button>` : ''}
        </div>
        <input type="text" class="input-field" value="${escapeHtml(r.title)}" placeholder="Round Title"
          onchange="app.state.customCampaign.rounds[${i}].title = this.value" />
        <label class="tiny text-muted" style="margin-top:2px;">1. Description (Shown to Players — do NOT include the solution!):</label>
        <textarea class="input-field" rows="2" placeholder="e.g., A troll blocks the way. He doesn't seem to want to let anyone pass."
          onchange="app.state.customCampaign.rounds[${i}].scenario = this.value">${escapeHtml(r.scenario || '')}</textarea>
        <label class="tiny text-muted" style="margin-top:2px;">2. Secrets (Only Shown to Judge LLM — keep vague/broad so many actions apply!):</label>
        <textarea class="input-field" rows="2" placeholder="e.g., The troll can be reasoned with, but is virtually immune to physical attacks."
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

  document.getElementById('char-form-box').classList.toggle('hidden', isReady);
  document.getElementById('char-waiting-box').classList.toggle('hidden', !isReady);

  const statusEl = document.getElementById('char-ready-list');
  statusEl.innerHTML = app.state.players.map(p => {
    const ready = Boolean(p.character && p.character.ready);
    return `
      <div class="ready-card ${ready ? 'is-ready' : ''}">
        <div class="ready-card-left">
          ${ready ? renderAvatarHtml(p.character.avatar, 'avatar-img') : '<span style="font-size:1.8rem;">🎨</span>'}
          <div>
            <strong>${escapeHtml(ready ? p.character.name : p.name)}</strong>
            <div class="text-muted small">${ready ? escapeHtml(p.character.role) : 'Drawing character...'}</div>
          </div>
        </div>
        <span class="badge ${ready ? 'badge-success' : 'badge-warn'}">${ready ? 'Ready!' : 'Creating'}</span>
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

  const myDeadMod = getPlayerMetaMod(me, 'DEAD');
  const mySkipMod = getPlayerMetaMod(me, 'SKIP_TURN');
  const myWordLimitMod = getPlayerMetaMod(me, 'WORD_LIMIT');
  const myBlindedMod = getPlayerMetaMod(me, 'BLINDED_SCENARIO');

  document.getElementById('scenario-round-badge').textContent = `ROUND ${roundIdx + 1} OF ${camp.rounds.length}`;
  document.getElementById('scenario-title').textContent = roundObj.title;

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
    bridgeBox.innerHTML = `<strong>Previously:</strong> ${escapeHtml(prev.judgment?.continuityBridge || prev.judgment?.headline || '')}`;
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
        <span class="mod-label">Your Active Perks & Status Effects:</span>
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
      : 'Describe your specific action! (Avoid vague or impossible actions, and keep your active perks/injuries in mind!)';
  }

  const hasSubmitted = Boolean(app.state.submissions[app.myId]);
  document.getElementById('scenario-input-area').classList.toggle('hidden', hasSubmitted);
  const lockedArea = document.getElementById('scenario-locked-area');
  lockedArea.classList.toggle('hidden', !hasSubmitted);

  if (hasSubmitted) {
    if (myDeadMod) {
      lockedArea.innerHTML = `
        <h3>💀 Your Character Is Dead!</h3>
        <p class="text-muted small">You were eliminated from the campaign and are spectating the remaining survivors.</p>
      `;
    } else if (mySkipMod) {
      lockedArea.innerHTML = `
        <h3>⛓️ Locked Out For 1 Turn (${escapeHtml(mySkipMod.name)})!</h3>
        <p class="text-muted small">${escapeHtml(mySkipMod.description || 'You cannot act this round unless a teammate rescues you!')}</p>
      `;
    } else {
      lockedArea.innerHTML = `
        <h3>🔒 Action Locked In!</h3>
        <p class="text-muted small mb-2">Waiting for remaining teammates to lock in their moves...</p>
        <button type="button" class="btn btn-secondary" onclick="unlockMyActionToEdit()">
          ✏️ Edit My Answer
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
      : `<span class="badge ${locked ? 'badge-success' : 'badge-warn'}">${locked ? '🔒 Locked In' : '✏️ Typing...'}</span>`;

    return `
      <div class="party-status-card ${locked ? 'locked' : ''}">
        <div class="row-between">
          <div class="row-gap">
            ${renderAvatarHtml(p.character?.avatar, 'avatar-img-sm')}
            <strong>${escapeHtml(p.character?.name || p.name)}</strong>
            <span class="score-pill">${p.score} pts</span>
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
  const aiGeneratingBox = document.getElementById('reveal-ai-generating-box');
  const prevBtn = document.getElementById('btn-host-reveal-prev');
  const nextBtn = document.getElementById('btn-host-reveal-next');
  const waitMsg = document.getElementById('client-reveal-wait');

  // 1. Populate "What Everyone Decided To Do" (respecting secret/hidden actions)
  const actionsGrid = document.getElementById('reveal-actions-grid');
  actionsGrid.innerHTML = app.state.players.map(p => {
    const isHidden = Boolean(
      (app.state.hiddenSubmissions && app.state.hiddenSubmissions[p.id]) ||
      app.state.submissions[p.id] === '__SECRET_ACTION__'
    );
    const actionText = app.state.submissions[p.id] || '(Panicked and did nothing!)';
    const quoteHtml = isHidden
      ? `<div class="action-quote-hidden">🕵️ Secret Action — Hidden by Player</div>`
      : `<blockquote class="action-quote">"${escapeHtml(actionText)}"</blockquote>`;

    return `
      <div class="action-reveal-card">
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
    if (aiGeneratingBox) aiGeneratingBox.classList.remove('hidden');
    prevBtn.classList.add('hidden');
    nextBtn.classList.add('hidden');
    waitMsg.classList.remove('hidden');
    waitMsg.textContent = '🔮 Read what everyone did while the AI generates the outcome...';
    return;
  }

  if (aiGeneratingBox) aiGeneratingBox.classList.add('hidden');

  // Populate rankings list for Step 2 using shared getModifierDisplayMeta
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
      <div class="ranking-card rank-${i + 1}">
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
            +${r.pointsAwarded} pts
            <div class="tiny text-muted">Total: ${p.score} pts</div>
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

    if (app.isHost) {
      prevBtn.classList.add('hidden');
      nextBtn.classList.remove('hidden');
      nextBtn.textContent = '▶️ Continue (Play Out Scenario)';
      waitMsg.classList.add('hidden');
    } else {
      prevBtn.classList.add('hidden');
      nextBtn.classList.add('hidden');
      waitMsg.classList.remove('hidden');
      waitMsg.textContent = 'Outcome ready! Waiting for Host to press Continue...';
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
    startStoryWordByWord(roundKey, j);
  } else if (app.typewriter.finished) {
    showPostStoryVerdictAndLeaderboard(j);
  }
}

function startStoryWordByWord(roundKey, judgment) {
  stopTypewriter();
  app.typewriter.activeKey = roundKey;
  app.typewriter.finished = false;

  const storyContainer = document.getElementById('reveal-story-paragraphs');
  const verdictBox = document.getElementById('reveal-verdict-box');
  const rankingsBox = document.getElementById('reveal-rankings-box');
  const nextBtn = document.getElementById('btn-host-reveal-next');
  const waitMsg = document.getElementById('client-reveal-wait');

  verdictBox.classList.add('hidden');
  rankingsBox.classList.add('hidden');
  nextBtn.classList.add('hidden');
  waitMsg.classList.remove('hidden');
  waitMsg.textContent = '📖 The scenario is playing out...';

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

function showPostStoryVerdictAndLeaderboard(j) {
  const verdictBox = document.getElementById('reveal-verdict-box');
  const rankingsBox = document.getElementById('reveal-rankings-box');
  const nextBtn = document.getElementById('btn-host-reveal-next');
  const waitMsg = document.getElementById('client-reveal-wait');

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
      document.getElementById('verdict-stamp').textContent = '💥 SCENARIO FAILED — CAMPAIGN OVER!';
      sfx.verdictFail();
    }
    document.getElementById('verdict-headline').textContent = j.headline;
  }

  rankingsBox.classList.remove('hidden');

  const isFailed = j.outcome === 'FAILED';
  const isLastRound = (app.state.currentRound + 1) >= app.state.activeCampaign.rounds.length;

  if (app.isHost) {
    nextBtn.classList.remove('hidden');
    if (isFailed) {
      nextBtn.textContent = '🏆 Continue to Final Summary & Podium (Game Over) ➡️';
    } else if (isLastRound) {
      nextBtn.textContent = '🏆 Continue to Final Summary & Podium ➡️';
    } else {
      nextBtn.textContent = `▶️ Continue to Round ${app.state.currentRound + 2} ➡️`;
    }
    waitMsg.classList.add('hidden');
  } else {
    nextBtn.classList.add('hidden');
    waitMsg.classList.remove('hidden');
    waitMsg.textContent = isFailed
      ? 'Scenario Failed! Waiting for Host to open the Final Podium & Summary...'
      : 'Waiting for Host to press Continue...';
  }
}

function renderGameOverScreen() {
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
    ? `Your party wiped out on Round ${app.state.roundHistory.length} of "${app.state.activeCampaign?.title || 'Campaign'}" after passing ${passedCount} scenario(s)!`
    : `Your party survived all ${totalRoundsInCamp} rounds of "${app.state.activeCampaign?.title || 'Campaign'}"!`;

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
          <h3 class="mt-1">${escapeHtml(p.character?.name || p.name)}</h3>
          <div class="text-muted tiny">Played by ${escapeHtml(p.name)}</div>
          <div class="text-muted tiny mt-1">${escapeHtml(p.character?.role || '')}</div>
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
            <span class="badge badge-genre">🎖️ HONORABLE MENTION — 4TH PLACE</span>
            ${renderAvatarHtml(fourth.character?.avatar, 'avatar-img')}
            <div>
              <strong>${escapeHtml(fourth.character?.name || fourth.name)}</strong>
              <span class="text-muted small"> (Played by ${escapeHtml(fourth.name)})</span>
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
          <div class="mt-2">
            <span class="mod-label">Final Character Condition & Modifiers:</span>
            <div class="modifier-chips mt-1">${renderModifierChips(p.modifiers)}</div>
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
        ? '🌟 Passed with Flying Colors'
        : (out === 'BARELY_PASSED' ? '😅 Passed (Just Barely)' : '💥 Failed');
      return `
        <div class="summary-round-item">
          <div class="row-between mb-2">
            <strong>Round ${idx + 1}: ${escapeHtml(h.roundTitle)}</strong>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <div style="font-weight:700; color: var(--accent-gold); margin-bottom:6px;">
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
