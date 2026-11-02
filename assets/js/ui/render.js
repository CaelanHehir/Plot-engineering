/**
 * Screen Rendering Engine & UI Router for Plot Engineering
 */

import { app } from '../state/store.js';
import { escapeHtml } from './utils.js';
import { renderLobbyScreen } from './screens/lobby.js';
import { renderCharCreateScreen } from './screens/charCreate.js';
import { renderScenarioScreen } from './screens/scenario.js';
import { renderRevealScreen } from './screens/reveal.js';
import { renderGameOverScreen } from './screens/gameOver.js';

/**
 * Toggles mobile sub-window tabs on the HOME screen.
 */
export function renderHomeWindow() {
  const isHost = app.homeWindow === 'host';
  const hostCard = document.getElementById('home-host-card');
  const joinCard = document.getElementById('home-join-card');
  const btnHost = document.getElementById('home-win-btn-host');
  const btnJoin = document.getElementById('home-win-btn-join');

  if (hostCard) hostCard.classList.toggle('mobile-window-hidden', !isHost);
  if (joinCard) joinCard.classList.toggle('mobile-window-hidden', isHost);
  if (btnHost) btnHost.classList.toggle('active', isHost);
  if (btnJoin) btnJoin.classList.toggle('active', !isHost);
}

/**
 * Sets the active HOME screen window ('host' | 'join') and re-renders it.
 * @param {string} win
 */
export function setHomeWindow(win) {
  app.homeWindow = win === 'join' ? 'join' : 'host';
  renderHomeWindow();
}

/**
 * Toggles the top HUD menu popover.
 * @param {Event} [e]
 */
export function toggleTopMenu(e) {
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

/**
 * Closes the top HUD menu popover.
 */
export function closeTopMenu() {
  const drawer = document.getElementById('top-menu-drawer');
  const btn = document.getElementById('btn-top-menu');
  if (drawer) drawer.classList.add('hidden');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '☰ Menu';
  }
}

/**
 * Main reactive render dispatcher.
 * Toggles visibility for the active phase section and calls the appropriate screen renderer.
 */
export function renderState() {
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

  // Top header room code permanent pill
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
