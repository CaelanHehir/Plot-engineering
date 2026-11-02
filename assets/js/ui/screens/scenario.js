/**
 * Screen Renderer & Controller: SCENARIO
 * Handles scene briefing, countdown timers, modifiers, and action submissions.
 */

import { app } from '../../state/store.js';
import {
  escapeHtml,
  formatSeconds,
  openAccessibleModal,
  closeAccessibleModal,
  showToast,
  getPlayerMetaMod,
  renderModifierChips
} from '../utils.js';
import { sfx } from '../../services/audio.js';
import {
  getStoredApiKey,
  generateBotActionsWithAI
} from '../../services/gemini/index.js';
import { generateProceduralPortraitDataUrl } from '../../features/canvas.js';
import { broadcastState, sendToHost } from '../../services/network.js';
import { renderState } from '../render.js';
import { stopTypewriter, evaluateCurrentRound } from './reveal.js';

export function renderScenarioScreen() {
  const camp = app.state.activeCampaign;
  if (!camp || !Array.isArray(camp.rounds)) return;
  const roundIdx = app.state.currentRound;
  const roundObj = camp.rounds[roundIdx];
  if (!roundObj) return;
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
  const roundBadge = document.getElementById('scenario-round-badge');
  if (roundBadge) roundBadge.textContent = roundLabelText;
  const popupRoundBadge = document.getElementById('scenario-popup-round-badge');
  if (popupRoundBadge) popupRoundBadge.textContent = roundLabelText;

  const titleEl = document.getElementById('scenario-title');
  if (titleEl) titleEl.textContent = roundObj.title;

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

  const descEl = document.getElementById('scenario-description');
  if (descEl) descEl.textContent = sceneDesc;

  const inlineDesc = document.getElementById('scenario-inline-desc');
  if (inlineDesc) inlineDesc.textContent = sceneDesc;

  const bridgeBox = document.getElementById('scenario-bridge-box');
  const inlineBridge = document.getElementById('scenario-inline-bridge');
  if (roundIdx > 0 && app.state.roundHistory.length > 0) {
    const prev = app.state.roundHistory[app.state.roundHistory.length - 1];
    const bridgeHtml = `<strong>Previously:</strong> ${escapeHtml(prev.judgment?.continuityBridge || prev.judgment?.headline || '')}`;
    if (bridgeBox) {
      bridgeBox.classList.remove('hidden');
      bridgeBox.innerHTML = bridgeHtml;
    }
    if (inlineBridge) {
      inlineBridge.classList.remove('hidden');
      inlineBridge.innerHTML = bridgeHtml;
    }
  } else {
    if (bridgeBox) bridgeBox.classList.add('hidden');
    if (inlineBridge) inlineBridge.classList.add('hidden');
  }

  const timerEl = document.getElementById('scenario-timer');
  const addTimeBtn = document.getElementById('btn-host-add-time');
  if (app.state.settings.roundTimer > 0) {
    if (timerEl) {
      timerEl.classList.remove('hidden');
      timerEl.textContent = formatSeconds(app.state.timeLeft);
      timerEl.classList.toggle('timer-urgent', app.state.timeLeft <= 20);
    }
    if (addTimeBtn) addTimeBtn.classList.toggle('hidden', !app.isHost);
  } else {
    if (timerEl) timerEl.classList.add('hidden');
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
      : 'Write your character\'s move! Coordinate with your crew or pull off a clever sabotage against a rival (high risk, high reward!)...';
    updateScenarioWordCount();
  }

  const hasSubmitted = Boolean(app.state.submissions[app.myId]);
  const inputArea = document.getElementById('scenario-input-area');
  if (inputArea) inputArea.classList.toggle('hidden', hasSubmitted);

  const lockedArea = document.getElementById('scenario-locked-area');
  if (lockedArea) {
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
            <p class="text-muted small">${escapeHtml(me.character?.name || me.name)} did nothing, they are dead.</p>
          `;
        } else if (mySkipMod) {
          lockedArea.innerHTML = `
            <div class="big-locked-stamp" style="background:var(--accent-gold); color:var(--ink);">${escapeHtml(mySkipMod.name)}</div>
            <p class="text-muted small">${escapeHtml(me.character?.name || me.name)} did nothing, they are locked out.</p>
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
  }

  const forceJudgeBtn = document.getElementById('btn-host-force-judge');
  if (forceJudgeBtn) forceJudgeBtn.classList.toggle('hidden', !app.isHost);
}

export function updateScenarioWordCount() {
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

export function startTimer(seconds) {
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

export function stopTimer() {
  if (app.timerInterval) {
    clearInterval(app.timerInterval);
    app.timerInterval = null;
  }
  app.timerDeadline = 0;
}

export function updateTimerDisplay() {
  if (!app.timerDeadline) return;
  const msLeft = Math.max(0, app.timerDeadline - Date.now());
  const secondsLeft = Math.ceil(msLeft / 1000);
  app.state.timeLeft = secondsLeft;

  const charTimerEl = document.getElementById('char-create-timer');
  if (charTimerEl && app.state.phase === 'CHAR_CREATE') {
    charTimerEl.textContent = formatSeconds(secondsLeft);
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

  if (app.isHost && msLeft <= 0) {
    stopTimer();
    if (app.state.phase === 'CHAR_CREATE') {
      hostForceStartFirstRound();
    } else if (app.state.phase === 'SCENARIO') {
      hostForceEvaluateRound();
    }
  }
}

export function hostAddExtraTime(seconds = 30) {
  if (!app.isHost || app.state.phase !== 'SCENARIO') return;
  const currentRemaining = Math.max(0, (app.timerDeadline || Date.now()) - Date.now());
  const newRemaining = currentRemaining + (seconds * 1000);
  app.state.remainingMs = newRemaining;
  app.state.timeLeft = Math.ceil(newRemaining / 1000);
  app.timerDeadline = Date.now() + newRemaining;
  showToast(`Added +${seconds} seconds to the round timer!`, 'info');
  broadcastState();
}

export function openScenarioPopup() {
  app.scenarioPopupOpen = true;
  const chk = document.getElementById('chk-disable-scenario-popup');
  if (chk) {
    chk.checked = localStorage.getItem('plot_engineering_disable_scenario_popup') === 'true';
  }
  openAccessibleModal('scenario-popup-modal');
}

export function closeScenarioPopup() {
  const chk = document.getElementById('chk-disable-scenario-popup');
  if (chk) {
    localStorage.setItem('plot_engineering_disable_scenario_popup', String(chk.checked));
  }
  app.scenarioPopupOpen = false;
  closeAccessibleModal('scenario-popup-modal');
}

export function hostForceStartFirstRound() {
  if (!app.isHost) return;
  stopTimer();
  app.state.players.forEach(p => {
    if (!p.character || !p.character.ready) {
      p.character = {
        name: p.character?.name || p.name,
        role: p.character?.role || 'Bystander thrown into the chaos',
        avatar: p.character?.avatar || generateProceduralPortraitDataUrl(),
        ready: true
      };
    }
  });
  startScenarioRound(0);
}

export function hostStartFirstRound() {
  if (!app.isHost) return;
  stopTimer();
  startScenarioRound(0);
}

export function startScenarioRound(roundIndex) {
  if (!app.isHost) return;
  stopTypewriter();
  app.revealWindow = 'story';
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

  const activeBots = [];

  app.state.players.forEach(p => {
    const deadMod = getPlayerMetaMod(p, 'DEAD');
    const skipMod = getPlayerMetaMod(p, 'SKIP_TURN');
    const charName = p.character?.name || p.name;
    if (deadMod) {
      app.state.submissions[p.id] = `${charName} did nothing, they are dead`;
    } else if (skipMod) {
      app.state.submissions[p.id] = `${charName} did nothing, they are locked out`;
    } else if (p.disconnected) {
      app.state.submissions[p.id] = '(Was away)';
    } else if (p.isBot) {
      activeBots.push(p);
    }
  });

  startTimer(Number(app.state.settings.roundTimer) || 0);

  sfx.stepReveal();
  broadcastState();
  checkAllActionsSubmitted();

  if (activeBots.length > 0) {
    triggerBotActionsForRound(activeBots, roundIndex);
  }
}

export async function triggerBotActionsForRound(activeBots, roundIndex) {
  if (!app.isHost || !activeBots || activeBots.length === 0) return;

  const campaign = app.state.activeCampaign;
  const roundObj = campaign?.rounds?.[roundIndex];
  if (!roundObj) return;

  const apiKey = getStoredApiKey();
  const detailedRecap = (app.state.roundHistory || []).map((h, i) => {
    const paras = (h.judgment?.storyParagraphs || []).join(' ');
    return `Round ${i + 1} (${h.roundTitle || 'Act'}): ${paras}`;
  }).join('\n\n');

  let actions = {};
  try {
    actions = await generateBotActionsWithAI({
      campaignTitle: campaign.title,
      roundIndex,
      totalRounds: campaign.rounds.length,
      scenarioText: roundObj.scenario,
      scenarioSecrets: roundObj.secrets || '',
      storySoFar: detailedRecap || app.state.storySoFar,
      bots: activeBots,
      allPlayers: app.state.players,
      apiKey
    });
  } catch (err) {
    console.warn('Bot action generation error:', err);
  }

  if (app.state.phase !== 'SCENARIO' || app.state.currentRound !== roundIndex) {
    return;
  }

  activeBots.forEach(bot => {
    const botAction = actions[bot.id] || `${bot.character?.name || bot.name} panicked and did nothing!`;
    app.state.submissions[bot.id] = botAction;
    app.state.hiddenSubmissions[bot.id] = true;
  });

  broadcastState();
  checkAllActionsSubmitted();
}

export function submitMyAction() {
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

export function unlockMyActionToEdit() {
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

export function checkAllActionsSubmitted() {
  if (!app.isHost) return;
  const activePlayers = app.state.players.filter(p => !p.disconnected);
  const allSubmitted = activePlayers.length > 0 && activePlayers.every(p => Boolean(app.state.submissions[p.id]));
  if (allSubmitted) {
    stopTimer();
    evaluateCurrentRound();
  }
}

export function hostForceEvaluateRound() {
  if (!app.isHost) return;
  stopTimer();
  evaluateCurrentRound();
}
