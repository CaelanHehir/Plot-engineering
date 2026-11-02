/**
 * Screen Renderer & Controller: GAME_OVER
 * Handles final score podium, player recap, and markdown story export.
 */

import { app } from '../../state/store.js';
import {
  escapeHtml,
  hyphenateLongWords,
  showToast,
  fallbackCopyText,
  renderAvatarHtml,
  getPlayerMetaMod,
  renderModifierChips
} from '../utils.js';

export function renderGameOverScreen() {
  const goWin = app.gameOverWindow === 'recap' ? 'recap' : (app.gameOverWindow === 'players' ? 'players' : 'results');
  const resultsCard = document.getElementById('gameover-results-card');
  const playersCard = document.getElementById('gameover-players-card');
  const recapCard = document.getElementById('gameover-recap-card');
  const btnResults = document.getElementById('gameover-win-btn-results');
  const btnPlayers = document.getElementById('gameover-win-btn-players');
  const btnRecap = document.getElementById('gameover-win-btn-recap');

  if (resultsCard) resultsCard.classList.toggle('mobile-window-hidden', goWin !== 'results');
  if (playersCard) playersCard.classList.toggle('mobile-window-hidden', goWin !== 'players');
  if (recapCard) recapCard.classList.toggle('mobile-window-hidden', goWin !== 'recap');

  if (btnResults) btnResults.classList.toggle('active', goWin === 'results');
  if (btnPlayers) btnPlayers.classList.toggle('active', goWin === 'players');
  if (btnRecap) btnRecap.classList.toggle('active', goWin === 'recap');

  const sorted = [...app.state.players].sort((a, b) => (b.score || 0) - (a.score || 0));

  // Standard competition tie ranking
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

  const roundHistory = Array.isArray(app.state.roundHistory) ? app.state.roundHistory : [];
  const lastRound = roundHistory[roundHistory.length - 1];
  const endedByFailure = lastRound?.judgment?.outcome === 'FAILED';

  const passedCount = roundHistory.filter(h => h.judgment?.passed).length;
  const totalRoundsInCamp = app.state.activeCampaign?.rounds?.length || roundHistory.length;

  const mainTitleEl = document.getElementById('finale-main-title');
  if (mainTitleEl) {
    mainTitleEl.textContent = endedByFailure
      ? 'Campaign ended in disaster!'
      : 'Campaign complete!';
  }

  const summaryEl = document.getElementById('finale-campaign-summary');
  if (summaryEl) {
    summaryEl.textContent = endedByFailure
      ? `Your crew wiped out on Round ${roundHistory.length} of "${app.state.activeCampaign?.title || 'Campaign'}" after surviving ${passedCount} act(s)!`
      : `Your crew survived all ${totalRoundsInCamp} acts of "${app.state.activeCampaign?.title || 'Campaign'}"!`;
  }

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

  const runnersUpEl = document.getElementById('final-runners-up-list');
  if (runnersUpEl) {
    const runnersUp = sorted.slice(3);
    if (runnersUp.length > 0) {
      runnersUpEl.classList.remove('hidden');
      runnersUpEl.innerHTML = `
        <div class="runners-up-card">
          <div class="runners-up-title">Honorable mentions</div>
          <div class="runners-up-grid">
            ${runnersUp.map((p, idx) => {
              const actualIdx = idx + 3;
              const rankLabel = getRankLabel(actualIdx);
              return `
                <div class="runner-up-pill">
                  <span class="runner-up-rank">${rankLabel}</span>
                  ${renderAvatarHtml(p.character?.avatar, 'avatar-img-sm')}
                  <div class="runner-up-info">
                    <span class="runner-up-name">${escapeHtml(p.character?.name || p.name)}</span>
                    <span class="runner-up-player">Played by ${escapeHtml(p.name)}</span>
                  </div>
                  <span class="runner-up-score">${(p.score || 0).toLocaleString()} pts</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      runnersUpEl.classList.add('hidden');
      runnersUpEl.innerHTML = '';
    }
  }

  const leaderboardEl = document.getElementById('final-leaderboard-list');
  if (leaderboardEl) {
    leaderboardEl.innerHTML = sorted.map((p, idx) => {
      const isDead = Boolean(getPlayerMetaMod(p, 'DEAD'));
      const activeMods = p.modifiers || [];
      const rankLabel = getRankLabel(idx);

      return `
        <div class="leaderboard-item">
          <div class="row-between">
            <div class="row-gap" style="gap:0.75rem;">
              <span class="leaderboard-rank">${rankLabel}</span>
              ${renderAvatarHtml(p.character?.avatar, 'avatar-img-sm')}
              <div>
                <strong>${escapeHtml(p.character?.name || p.name)}</strong>
                <div class="text-muted tiny">Played by ${escapeHtml(p.name)} &bull; ${escapeHtml(p.character?.role || 'Adventurer')}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <span class="leaderboard-score">${(p.score || 0).toLocaleString()} pts</span>
              ${isDead ? '<div><span class="badge" style="background:var(--accent-red); color:#fff; font-size:0.65rem;">Dead</span></div>' : ''}
            </div>
          </div>
          ${activeMods.length > 0 ? `
            <div class="mt-1" style="border-top:1px dashed var(--border); padding-top:0.35rem;">
              <span class="tiny text-muted uppercase">Final Enduring Conditions:</span>
              <div class="mt-tight">${renderModifierChips(activeMods)}</div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  const recapListEl = document.getElementById('final-campaign-recap-list');
  if (recapListEl) {
    const showRecapMoves = Boolean(app.state.settings?.revealMovesAfterStory);
    recapListEl.innerHTML = roundHistory.map((h, idx) => {
      const cleanTitle = (h.roundTitle || `Round ${idx + 1}`).replace(/^(Act|Round)\s+[IVX0-9]+:\s*/i, '');
      const badgeClass = h.judgment?.outcome === 'FLYING_COLORS'
        ? 'badge-success'
        : ((h.judgment?.outcome === 'PASSED' || h.judgment?.outcome === 'BARELY_PASSED') ? 'badge-success' : 'badge-warn');
      const badgeText = h.judgment?.outcome === 'FLYING_COLORS'
        ? 'Flying Colors'
        : ((h.judgment?.outcome === 'PASSED' || h.judgment?.outcome === 'BARELY_PASSED') ? 'Passed' : 'Wiped Out');

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
              <span class="tiny text-muted"><strong>Crew actions:</strong></span>
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

export function setGameOverWindow(win) {
  if (win === 'players') {
    app.gameOverWindow = 'players';
  } else if (win === 'recap') {
    app.gameOverWindow = 'recap';
  } else {
    app.gameOverWindow = 'results';
  }
  renderGameOverScreen();
}

export function copyStoryRecap() {
  const camp = app.state.activeCampaign;
  const history = app.state.roundHistory || [];
  const players = app.state.players || [];
  const lastRound = history[history.length - 1];
  const endedByFailure = lastRound?.judgment?.outcome === 'FAILED';
  const passedCount = history.filter(h => h.judgment?.passed).length;
  const totalRounds = camp?.rounds?.length || history.length;

  const resultStatus = endedByFailure
    ? `Campaign ended in disaster on Round ${history.length} after surviving ${passedCount} act(s).`
    : `Campaign complete! Survived all ${totalRounds} acts.`;

  const lines = [
    '=== PLOT ENGINEERING: STORY RECAP ===',
    `Campaign: ${camp?.title || 'Custom Campaign'}`,
    `Status: ${resultStatus}`,
    '',
    '--- CAST ---'
  ];

  players.forEach(p => {
    const cName = p.character?.name || p.name;
    const cRole = p.character?.role ? ` (${p.character.role})` : '';
    lines.push(`* ${cName}${cRole} - Played by ${p.name} [${(p.score || 0).toLocaleString()} pts]`);
  });

  lines.push('', '--- STORYLINE ---');

  history.forEach((h, idx) => {
    const cleanTitle = (h.roundTitle || `Round ${idx + 1}`).replace(/^(Act|Round)\s+[IVX0-9]+:\s*/i, '');
    const outcome = h.judgment?.outcome === 'FLYING_COLORS'
      ? 'Flying Colors'
      : ((h.judgment?.outcome === 'PASSED' || h.judgment?.outcome === 'BARELY_PASSED') ? 'Passed' : 'Wiped Out');

    lines.push(`\n[Round ${idx + 1}: ${cleanTitle}] - ${outcome}`);
    if (h.judgment?.headline) {
      lines.push(`"${h.judgment.headline}"`);
    }
    const paragraphs = (h.judgment?.storyParagraphs || []).join('\n\n');
    if (paragraphs) {
      lines.push(paragraphs);
    }

    const moves = [];
    if (h.submissions) {
      players.forEach(p => {
        const move = h.submissions[p.id];
        if (move && !move.startsWith('(') && move !== '__SECRET_ACTION__' && move !== '__LOCKED_IN__') {
          moves.push(`  * ${p.character?.name || p.name}: "${move}"`);
        }
      });
    }
    if (moves.length > 0) {
      lines.push('Crew actions:');
      lines.push(...moves);
    }
  });

  const fullText = lines.join('\n');
  const onCopySuccess = () => showToast('Story recap copied to clipboard!', 'success');
  const onCopyError = () => showToast('Failed to copy to clipboard', 'error');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fullText)
      .then(onCopySuccess)
      .catch(() => fallbackCopyText(fullText, onCopySuccess, onCopyError));
  } else {
    fallbackCopyText(fullText, onCopySuccess, onCopyError);
  }
}
