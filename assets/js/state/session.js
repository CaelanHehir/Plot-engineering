/**
 * Plot Engineering — Session Persistence & Recovery via sessionStorage
 */

import { app } from './store.js';

export const SESSION_KEY = 'plot_engineering_active_session';

export function saveSessionToStorage() {
  if (!app || !app.roomCode || app.state.phase === 'HOME') {
    return;
  }

  try {
    const payload = {
      isHost: app.isHost,
      roomCode: app.roomCode,
      myName: app.myName,
      myId: app.myId,
      lobbyView: app.lobbyView,
      charCreateStep: app.charCreateStep,
      state: app.isHost ? app.state : {
        phase: app.state.phase,
        roomCode: app.state.roomCode,
        currentRound: app.state.currentRound
      },
      savedAt: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save room session to sessionStorage:', err);
  }
}

export function loadSessionFromStorage() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.roomCode) return null;
    if (Date.now() - (data.savedAt || 0) > 4 * 60 * 60 * 1000) {
      clearSessionStorage();
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Failed to parse session from sessionStorage:', err);
    return null;
  }
}

export function clearSessionStorage() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (err) {}
}

export function hasActiveSession() {
  return Boolean(loadSessionFromStorage());
}
