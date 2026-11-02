/**
 * Screen Renderer & Controller: REVEAL
 * Handles move unmasking, round evaluation, word-by-word AI story typewriter playback, and round rankings.
 */

import { app } from '../../state/store.js';
import {
  escapeHtml,
  hyphenateLongWords,
  showToast,
  renderAvatarHtml,
  getPlayerMetaMod,
  getModifierDisplayMeta
} from '../utils.js';
import { sfx } from '../../services/audio.js';
import {
  getStoredApiKey,
  isKeyVerified,
  setApiKeyVerified,
  judgeRoundWithAI,
  mockJudgeRound
} from '../../services/gemini/index.js';
import { updateApiKeyBadge, openApiKeyModal } from '../../features/settings.js';
import { broadcastState } from '../../services/network.js';
import { startScenarioRound } from './scenario.js';

export function stopTypewriter() {
  if (app.typewriter?.timer) {
    clearInterval(app.typewriter.timer);
    app.typewriter.timer = null;
  }
  if (!app.typewriter) {
    app.typewriter = {};
  }
  app.typewriter.activeKey = '';
  app.typewriter.finished = false;
}

export function renderRevealScreen() {
  const j = app.state.currentJudgment;
  const step = app.state.revealStep;
  const isJudging = app.state.isJudging;

  const step1View = document.getElementById('reveal-step1-view');
  const step2View = document.getElementById('reveal-step2-view');
  const revealSwitcher = document.getElementById('reveal-window-switcher');
  const aiGeneratingBox = document.getElementById('reveal-ai-generating-box');
  const nextBtn = document.getElementById('btn-host-reveal-next');
  const skipBtn = document.getElementById('btn-host-skip-story');
  const retryBtn = document.getElementById('btn-host-retry-judge');
  const waitMsg = document.getElementById('client-reveal-wait');

  // 1. Populate "What Everyone Decided To Do" as Cartoon Speech Bubbles & Censor Tape
  const actionsGrid = document.getElementById('reveal-actions-grid');
  const kinds = app.state.submissionKinds || {};
  if (actionsGrid) {
    actionsGrid.innerHTML = app.state.players.map((p, idx) => {
      const isMe = p.id === app.myId;
      const kind = kinds[p.id] || (isMe ? 'text' : 'secret');
      const actionText = app.state.submissions[p.id] || '(Panicked and did nothing!)';

      if (kind === 'secret' && !isMe) {
        // Render hidden moves as one compact row
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
        quoteHtml = `<div class="action-quote-status" style="color:var(--accent-red); font-weight:700;">${escapeHtml(actionText || `${p.character?.name || p.name} did nothing, they are dead`)}</div>`;
      } else if (kind === 'locked') {
        quoteHtml = `<div class="action-quote-status" style="color:var(--accent-gold); font-weight:700;">${escapeHtml(actionText || `${p.character?.name || p.name} did nothing, they are locked out`)}</div>`;
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
  }

  if (isJudging || !j) {
    stopTypewriter();
    if (step1View) step1View.classList.remove('hidden');
    if (step2View) step2View.classList.add('hidden');
    if (revealSwitcher) revealSwitcher.classList.add('hidden');
    if (aiGeneratingBox) aiGeneratingBox.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');
    if (skipBtn) skipBtn.classList.add('hidden');
    if (retryBtn) retryBtn.classList.add('hidden');
    if (waitMsg) {
      waitMsg.classList.remove('hidden');
      waitMsg.textContent = 'The Judge is working out what happens...';
    }
    return;
  }

  if (aiGeneratingBox) aiGeneratingBox.classList.add('hidden');

  if (step === 1) {
    stopTypewriter();
    if (step1View) step1View.classList.remove('hidden');
    if (step2View) {
      step2View.classList.add('hidden');
      step2View.classList.remove('verdict-revealed');
      step2View.classList.add('story-centered');
    }
    const listEl = document.getElementById('reveal-rankings-list');
    if (listEl) listEl.innerHTML = '';
    if (revealSwitcher) revealSwitcher.classList.add('hidden');
    if (skipBtn) skipBtn.classList.add('hidden');
    if (retryBtn) retryBtn.classList.add('hidden');

    if (app.isHost) {
      if (nextBtn) {
        nextBtn.classList.remove('hidden');
        nextBtn.textContent = 'Show what happened';
      }
      if (waitMsg) waitMsg.classList.add('hidden');
    } else {
      if (nextBtn) nextBtn.classList.add('hidden');
      if (waitMsg) {
        waitMsg.classList.remove('hidden');
        waitMsg.textContent = 'Outcome ready! Waiting for Host to play out the scene...';
      }
    }
    return;
  }

  if (step1View) step1View.classList.add('hidden');
  if (step2View) step2View.classList.remove('hidden');

  const isFallback = Boolean(j && j.judgedBy === 'demo');
  if (retryBtn) {
    retryBtn.classList.toggle('hidden', !(app.isHost && isFallback && !app.state.isJudging));
  }

  // Show notice above story if demo judge was used as fallback
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

export function startStoryWordByWord(roundKey, judgment) {
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

  if (step2View) {
    step2View.classList.remove('verdict-revealed');
    step2View.classList.add('story-centered');
  }
  const listEl = document.getElementById('reveal-rankings-list');
  if (listEl) listEl.innerHTML = '';
  if (revealSwitcher) revealSwitcher.classList.add('hidden');
  if (storyCard) storyCard.classList.remove('mobile-window-hidden');
  if (verdictBox) verdictBox.classList.add('hidden');
  if (rankingsBox) rankingsBox.classList.add('hidden');
  if (nextBtn) nextBtn.classList.add('hidden');
  if (skipBtn) skipBtn.classList.remove('hidden');
  if (waitMsg) {
    waitMsg.classList.remove('hidden');
    waitMsg.textContent = 'The scenario is unfolding...';
  }

  const paragraphs = Array.isArray(judgment.storyParagraphs) && judgment.storyParagraphs.length > 0
    ? judgment.storyParagraphs
    : ['Chaos unfolded immediately!'];

  if (storyContainer) {
    storyContainer.innerHTML = paragraphs.map((_, idx) => `<p id="story-p-${idx}" class="story-para"></p>`).join('');
  }

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

export function skipStoryTypewriter() {
  const j = app.state.currentJudgment;
  if (!j) return;
  if (app.typewriter?.timer) {
    clearInterval(app.typewriter.timer);
    app.typewriter.timer = null;
  }
  if (!app.typewriter) app.typewriter = {};
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

export function renderRevealRankingsList(j) {
  const listEl = document.getElementById('reveal-rankings-list');
  if (!listEl || !j || !Array.isArray(j.rankings)) return;

  const showMoves = Boolean(app.state.settings?.revealMovesAfterStory || app.isHost);
  listEl.innerHTML = j.rankings.map((r, i) => {
    const p = app.state.players.find(pl => pl.id === r.playerId) || { name: 'Player' };
    const playerMove = app.state.submissions ? app.state.submissions[p.id] : '';
    const hasReadableMove = showMoves && playerMove && !playerMove.startsWith('(') && playerMove !== '__SECRET_ACTION__' && playerMove !== '__LOCKED_IN__';
    const medal = i === 0 ? '1st' : (i === 1 ? '2nd' : (i === 2 ? '3rd' : `#${i + 1}`));
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
              ${i === 0 ? '<span class="rank-mvp-badge">★ MVP</span>' : ''}
              <span class="award-title-badge">${escapeHtml(r.title)}</span>
            </div>
          </div>
          <div class="rank-points">
            <span class="rank-points-num" data-target-pts="${r.pointsAwarded || 0}">+${(r.pointsAwarded || 0).toLocaleString()} pts</span>
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
}
export function animateNumberCountUp(element, targetNum, duration = 600) {
  if (!element) return;
  if (targetNum <= 0) {
    element.textContent = '+0 pts';
    return;
  }
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(targetNum * ease);
    element.textContent = `+${current.toLocaleString()} pts`;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = `+${targetNum.toLocaleString()} pts`;
    }
  }
  requestAnimationFrame(step);
}

export function showPostStoryVerdictAndLeaderboard(j) {
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

  if (skipBtn) skipBtn.classList.add('hidden');

  // 1. Reveal Verdict Stamp FIRST - keep rankings hidden to never spoil the outcome
  if (verdictBox && verdictBox.classList.contains('hidden')) {
    if (j.outcome === 'FLYING_COLORS') {
      verdictBox.className = 'verdict-banner verdict-flying-colors';
      document.getElementById('verdict-stamp').textContent = 'PASSED WITH FLYING COLORS!';
      sfx.verdictFlyingColors();
    } else if (j.outcome === 'PASSED' || j.outcome === 'BARELY_PASSED') {
      verdictBox.className = 'verdict-banner verdict-barely-passed';
      document.getElementById('verdict-stamp').textContent = 'SCENARIO PASSED!';
      sfx.verdictBarely();
    } else {
      verdictBox.className = 'verdict-banner verdict-fail';
      document.getElementById('verdict-stamp').textContent = 'SCENARIO FAILED — GAME OVER!';
      sfx.verdictFail();
    }
    const hlEl = document.getElementById('verdict-headline');
    if (hlEl) hlEl.textContent = j.headline || '';
    const judgeBadge = document.getElementById('verdict-judge-badge');
    if (judgeBadge) judgeBadge.classList.add('hidden');
    verdictBox.classList.remove('hidden');
  }

  const isFailed = j.outcome === 'FAILED';
  const isLastRound = (app.state.currentRound + 1) >= (app.state.activeCampaign?.rounds?.length || 0);

  const revealStandings = () => {
    if (app.state.phase !== 'REVEAL' || app.state.revealStep !== 2) return;

    if (step2View) {
      step2View.classList.remove('story-centered');
      step2View.classList.add('verdict-revealed');
    }
    if (revealSwitcher) revealSwitcher.classList.remove('hidden');
    if (rankingsBox) rankingsBox.classList.remove('hidden');

    renderRevealRankingsList(j);

    const revWin = app.revealWindow === 'rankings' ? 'rankings' : 'story';
    if (storyCard) storyCard.classList.toggle('mobile-window-hidden', revWin !== 'story');
    if (rankingsBox) rankingsBox.classList.toggle('mobile-window-hidden', revWin !== 'rankings');
    if (btnStory) btnStory.classList.toggle('active', revWin === 'story');
    if (btnRankings) btnRankings.classList.toggle('active', revWin === 'rankings');

    // Smooth count-up animation for points awarded
    document.querySelectorAll('.rank-points-num[data-target-pts]').forEach(el => {
      const targetPts = parseInt(el.getAttribute('data-target-pts'), 10) || 0;
      animateNumberCountUp(el, targetPts, 600);
    });

    if (app.isHost) {
      if (nextBtn) {
        nextBtn.classList.remove('hidden');
        if (isFailed || isLastRound) {
          nextBtn.textContent = 'See results';
        } else {
          nextBtn.textContent = 'Next round';
        }
      }
      if (waitMsg) waitMsg.classList.add('hidden');
    } else {
      if (nextBtn) nextBtn.classList.add('hidden');
      if (waitMsg) {
        waitMsg.classList.remove('hidden');
        waitMsg.textContent = isFailed
          ? 'Scenario Failed! Waiting for Host to open the Final Podium...'
          : 'Waiting for Host to press Continue...';
      }
    }
  };

  const alreadyRevealed = step2View && step2View.classList.contains('verdict-revealed');
  if (alreadyRevealed) {
    revealStandings();
    return;
  }

  // Ensure rankings remain hidden while players absorb the verdict
  if (rankingsBox) rankingsBox.classList.add('hidden');
  if (revealSwitcher) revealSwitcher.classList.add('hidden');

  // 1.1s dramatic pause so the verdict is absorbed before standings appear
  setTimeout(revealStandings, 1100);
}

export function setRevealWindow(win) {
  app.revealWindow = win === 'rankings' ? 'rankings' : 'story';
  if (app.state.currentJudgment && app.typewriter?.finished) {
    showPostStoryVerdictAndLeaderboard(app.state.currentJudgment);
  }
}

export async function evaluateCurrentRound() {
  if (!app.isHost || app.state.isJudging) return;

  app.state._preRoundSnapshot = {
    players: app.state.players.map(p => ({
      id: p.id,
      score: p.score || 0,
      modifiers: (p.modifiers || []).map(m => ({ ...m }))
    })),
    storySoFar: app.state.storySoFar || ''
  };

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
  if (apiKey && isKeyVerified()) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
        if (judgment) {
          updateApiKeyBadge(true);
          break;
        }
      } catch (err) {
        console.warn(`AI judging attempt ${attempt}/${maxAttempts} failed:`, err);
        if (err?.code === 'INVALID') {
          break;
        }
        if (attempt < maxAttempts) {
          const backoffMs = attempt === 1 ? 1500 : 3000;
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }
    }

    if (!judgment) {
      judgment = mockJudgeRound({
        players: app.state.players,
        submissions: app.state.submissions,
        settings: app.state.settings,
        isLastRound: (roundIndex + 1) >= campaign.rounds.length
      });
      judgment.judgeNotice = 'The AI judge was unavailable after multiple attempts, so a fallback judge decided this round.';
    }
  } else {
    await new Promise(r => setTimeout(r, 1500));
    judgment = mockJudgeRound({
      players: app.state.players,
      submissions: app.state.submissions,
      settings: app.state.settings,
      isLastRound: (roundIndex + 1) >= campaign.rounds.length
    });
    judgment.judgeNotice = 'No AI key is set, so the demo judge decided this round.';
  }

  if (app.state.phase !== 'REVEAL') return;

  const maxMods = Number(app.state.settings.maxModifiers) || 99;
  const roundFailed = judgment.outcome === 'FAILED';
  const isFinalRound = (roundIndex + 1) >= campaign.rounds.length;

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

    if (isFinalRound) {
      rankItem.modifiersAdded = [];
    }

    player.score = (player.score || 0) + (rankItem.pointsAwarded || 0);

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

    if (!isFinalRound && Array.isArray(rankItem.modifiersAdded)) {
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
    : ((judgment.outcome === 'PASSED' || judgment.outcome === 'BARELY_PASSED') ? 'PASSED' : 'FAILED');
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

export async function hostRetryAiJudge() {
  if (!app.isHost || app.state.isJudging || app.state.phase !== 'REVEAL') return;
  const j = app.state.currentJudgment;
  if (!j || j.judgedBy !== 'demo') {
    showToast('AI judgment already active.', 'info');
    return;
  }

  const apiKey = getStoredApiKey();
  if (!apiKey) {
    showToast('Please enter an AI key in settings first.', 'warn');
    openApiKeyModal();
    return;
  }

  setApiKeyVerified(true);
  updateApiKeyBadge(true);

  if (app.state._preRoundSnapshot) {
    const snap = app.state._preRoundSnapshot;
    for (const p of app.state.players) {
      const snapP = snap.players.find(sp => sp.id === p.id);
      if (snapP) {
        p.score = snapP.score;
        p.modifiers = (snapP.modifiers || []).map(m => ({ ...m }));
      }
    }
    app.state.storySoFar = snap.storySoFar || '';
  }

  if (app.state.roundHistory.length > 0 &&
      app.state.roundHistory[app.state.roundHistory.length - 1].roundIndex === app.state.currentRound) {
    app.state.roundHistory.pop();
  }

  stopTypewriter();
  if (!app.typewriter) app.typewriter = {};
  app.typewriter.activeKey = '';
  app.typewriter.finished = false;
  app.state.currentJudgment = null;
  app.state.revealStep = 1;
  app.state.isJudging = false;

  showToast('Retrying AI Judge with Gemini...', 'info');
  await evaluateCurrentRound();
}

export function hostNextRevealStep() {
  if (!app.isHost) return;

  if (app.state.revealStep === 1) {
    if (app.state.isJudging || !app.state.currentJudgment) return;
    app.state.revealStep = 2;
    sfx.stepReveal();
    broadcastState();
    return;
  }

  if (!app.typewriter?.finished) {
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
