/**
 * Screen Renderer & Controller: CHAR_CREATE
 * Handles two-stage character creation, bot character generation, and crew polaroid readiness display.
 */

import { app } from '../../state/store.js';
import {
  disambiguatePlayerName,
  escapeHtml,
  formatSeconds,
  showToast,
  sanitizeAvatar
} from '../utils.js';
import { sfx } from '../../services/audio.js';
import {
  getStoredApiKey,
  generateBotCharactersWithAI
} from '../../services/gemini/index.js';
import {
  drawState,
  syncCanvasToContainer,
  exportCompactAvatar,
  generateProceduralPortraitDataUrl
} from '../../features/canvas.js';
import { broadcastState, sendToHost } from '../../services/network.js';
import { renderState } from '../render.js';

export function updateCharCreateStepProgress() {
  const stepBtn1 = document.getElementById('char-step-btn-1');
  const stepBtn2 = document.getElementById('char-step-btn-2');
  if (!stepBtn1 || !stepBtn2) return;

  const me = app.state.players.find(p => p.id === app.myId);
  const nameInput = document.getElementById('char-name-input');
  const roleInput = document.getElementById('char-role-input');

  const nameVal = (nameInput?.value || me?.character?.name || '').trim();
  const roleVal = (roleInput?.value || me?.character?.role || '').trim();
  const bioDone = Boolean(nameVal && roleVal);
  const sketchDone = Boolean(drawState.hasDrawn || (me?.character?.avatar && me.character.ready));

  stepBtn1.innerHTML = `1. Bio${bioDone ? ' <span class="char-step-check" title="Complete">✓</span>' : ''}`;
  stepBtn1.classList.toggle('is-complete', bioDone);

  stepBtn2.innerHTML = `2. Portrait${sketchDone ? ' <span class="char-step-check" title="Complete">✓</span>' : ''}`;
  stepBtn2.classList.toggle('is-complete', sketchDone);
}

export function renderCharCreateScreen() {
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
  updateCharCreateStepProgress();

  const statusEl = document.getElementById('char-ready-list');
  if (statusEl) {
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

export function setCharCreateStep(step) {
  app.charCreateStep = step === 2 ? 2 : 1;
  sfx.stepReveal();
  renderCharCreateScreen();
  if (app.charCreateStep === 2) {
    requestAnimationFrame(() => syncCanvasToContainer(true));
  }
}

export function goToCharPortraitStage() {
  setCharCreateStep(2);
}

export function submitMyCharacter() {
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

export function unlockMyCharacterToEdit() {
  if (app.isHost) {
    const me = app.state.players.find(p => p.id === app.myId);
    if (me && me.character) {
      me.character.ready = false;
    }
    broadcastState();
  } else {
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

export function checkAllCharactersReady() {
  if (!app.isHost) return;
  const activePlayers = app.state.players.filter(p => !p.disconnected);
  const allReady = activePlayers.length > 0 && activePlayers.every(p => p.character && p.character.ready);
  if (allReady) {
    clearInterval(app.timerInterval);
  }
  broadcastState();
}

export async function generateBotCharactersForGame(bots) {
  if (!app.isHost || !bots || bots.length === 0) return;
  const campaign = app.state.activeCampaign;
  const apiKey = getStoredApiKey();

  let botCharacters = [];
  try {
    botCharacters = await generateBotCharactersWithAI({
      campaignTitle: campaign?.title || 'Unknown Campaign',
      campaignDescription: campaign?.description || '',
      genre: campaign?.genre || 'Comedy',
      count: bots.length,
      settings: app.state.settings,
      apiKey
    });
  } catch (err) {
    console.warn('AI bot character generation error:', err);
  }

  if (app.state.phase !== 'CHAR_CREATE') return;

  bots.forEach((bot, idx) => {
    const profile = (botCharacters && botCharacters[idx]) || {
      name: `Agent ${String.fromCharCode(65 + idx)}`,
      role: `Unsuspecting bystander caught in ${campaign?.title || 'the chaos'}`,
      startingTrait: {
        name: 'Unlucky Hunch',
        type: 'neutral',
        description: 'Has a persistent bad feeling about whatever happens next'
      }
    };

    bot.character = {
      name: profile.name,
      role: profile.role,
      avatar: generateProceduralPortraitDataUrl(),
      ready: true
    };
    bot.name = disambiguatePlayerName(`${profile.name.split(' ')[0]} (Bot)`, app.state.players.filter(p => p.id !== bot.id));

    if (app.state.settings.allowStartingQuirk && profile.startingTrait) {
      bot.modifiers = [{ ...profile.startingTrait, metaEffect: 'NONE' }];
    } else {
      bot.modifiers = [];
    }
  });

  checkAllCharactersReady();
  broadcastState();
}
