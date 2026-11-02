/**
 * Shared UI, DOM, Formatting & GitHub Pages URL Helper Utilities
 */

// Migrate legacy storage keys & purge any persistent API keys for security
(function migrateLegacyStorageKeys() {
  try {
    if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;
    const keys = ['muted', 'player_id', 'player_name', 'room_code'];
    keys.forEach(k => {
      const oldKey = `prompt_engineering_${k}`;
      const newKey = `plot_engineering_${k}`;
      const localVal = localStorage.getItem(oldKey);
      if (localVal !== null) {
        if (localStorage.getItem(newKey) === null) {
          localStorage.setItem(newKey, localVal);
        }
        localStorage.removeItem(oldKey);
      }
      const sessVal = sessionStorage.getItem(oldKey);
      if (sessVal !== null) {
        if (sessionStorage.getItem(newKey) === null) {
          sessionStorage.setItem(newKey, sessVal);
        }
        sessionStorage.removeItem(oldKey);
      }
    });

    // Security: Ensure legacy persistent API keys are strictly purged from disk
    localStorage.removeItem('prompt_engineering_gemini_key');
    localStorage.removeItem('plot_engineering_gemini_key');
    localStorage.removeItem('prompt_engineering_gemini_model');
    localStorage.removeItem('plot_engineering_gemini_model');
  } catch (e) {}
})();

/** Canonical GitHub Pages hosting URL for multiplayer invites */
export const GITHUB_PAGES_URL = 'https://caelanhehir.github.io/Plot-engineering/';

export function isLocalhost() {
  try {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '';
  } catch (e) {
    return false;
  }
}

export function disambiguatePlayerName(baseName, existingPlayers = []) {
  const clean = (baseName || 'Player').trim().slice(0, 24);
  let name = clean;
  let counter = 2;
  while (existingPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    name = `${clean} (${counter})`;
    counter++;
  }
  return name;
}

export function getPublicGameBaseUrl() {
  try {
    const loc = window.location;
    const isHttp = loc.protocol === 'http:' || loc.protocol === 'https:';
    if (isHttp) {
      const cleanPath = loc.pathname.replace(/index\.html$/i, '');
      return `${loc.origin}${cleanPath.endsWith('/') ? cleanPath : cleanPath + '/'}`;
    }
  } catch (e) {}
  return GITHUB_PAGES_URL;
}

export function getRoomInviteUrl(roomCode) {
  const base = getPublicGameBaseUrl();
  const url = new URL(base);
  if (roomCode) {
    url.searchParams.set('room', String(roomCode).toUpperCase());
  }
  return url.toString();
}

export function getShortDisplayJoinUrl() {
  const base = getPublicGameBaseUrl();
  return base.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function hyphenateLongWords(str) {
  return String(str ?? '').replace(/\S{26,}/g, (word) => word.split('').join('\u00AD'));
}

export function formatSeconds(sec) {
  const total = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

let currentLoadingCancelHandler = null;

export function setLoadingOverlay(visible, text = 'Loading...', onCancel = null) {
  const el = document.getElementById('loading-overlay');
  const txt = document.getElementById('loading-text');
  const cancelBtn = document.getElementById('loading-cancel-btn');

  if (txt) txt.textContent = text;
  currentLoadingCancelHandler = visible ? onCancel : null;

  if (cancelBtn) {
    cancelBtn.classList.toggle('hidden', !onCancel);
    cancelBtn.onclick = () => {
      if (currentLoadingCancelHandler) {
        currentLoadingCancelHandler();
      }
      setLoadingOverlay(false);
    };
  }

  if (el) el.classList.toggle('hidden', !visible);
}

const activeModalFocusStack = [];

export function openAccessibleModal(modalId, initialFocusSelector) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!modal) return;
  const previouslyFocused = document.activeElement;
  activeModalFocusStack.push({ modal, returnTo: previouslyFocused });
  modal.classList.remove('hidden');
  const target = initialFocusSelector
    ? modal.querySelector(initialFocusSelector)
    : modal.querySelector('button:not([disabled]):not(.hidden), input:not([disabled]):not(.hidden), select:not([disabled]):not(.hidden), textarea:not([disabled]):not(.hidden), [tabindex="0"]');
  if (target) {
    requestAnimationFrame(() => target.focus());
  }
}

export function closeAccessibleModal(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!modal) return;
  modal.classList.add('hidden');
  const recordIdx = activeModalFocusStack.findIndex(entry => entry.modal === modal);
  if (recordIdx !== -1) {
    const record = activeModalFocusStack.splice(recordIdx, 1)[0];
    if (record.returnTo && typeof record.returnTo.focus === 'function') {
      requestAnimationFrame(() => record.returnTo.focus());
    }
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && activeModalFocusStack.length > 0) {
      const current = activeModalFocusStack[activeModalFocusStack.length - 1];
      const modal = current.modal;
      const focusable = modal.querySelectorAll('button:not([disabled]):not(.hidden), input:not([disabled]):not(.hidden), select:not([disabled]):not(.hidden), textarea:not([disabled]):not(.hidden), [tabindex="0"]');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const el = document.getElementById('loading-overlay');
      if (el && !el.classList.contains('hidden') && currentLoadingCancelHandler) {
        currentLoadingCancelHandler();
        setLoadingOverlay(false);
      }
    }
  });
}

export function showToast(message, type = 'info') {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('toast-container');
  if (!container) return;
  container.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    if (!toast.isConnected) return;
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function fallbackCopyText(text, onSuccess = null, onError = null) {
  try {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.setAttribute('readonly', '');
    tempInput.style.position = 'fixed';
    tempInput.style.left = '-9999px';
    tempInput.style.opacity = '0';
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(tempInput);
    if (copied) {
      if (onSuccess) onSuccess();
      return true;
    }
  } catch (err) {
    console.warn('Fallback clipboard copy failed:', err);
  }
  if (onError) onError();
  return false;
}

export function sanitizeAvatar(url) {
  if (!url || typeof url !== 'string' || url.length > 60000) return '';
  const match = url.match(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/);
  return match ? url : '';
}

export function renderAvatarHtml(avatarData, sizeClass = 'avatar-img') {
  const safeAvatar = sanitizeAvatar(avatarData);
  if (safeAvatar) {
    return `<img src="${escapeHtml(safeAvatar)}" class="${sizeClass}" alt="Character Portrait" />`;
  }
  return `<div class="${sizeClass}" style="display:inline-flex;align-items:center;justify-content:center;background:var(--bg-card);"><svg width="60%" height="60%" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><circle cx="12" cy="8" r="4"/><path d="M12 14c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"/></svg></div>`;
}

export function getPlayerMetaMod(player, metaType) {
  if (!player || !Array.isArray(player.modifiers)) return null;
  return player.modifiers.find(m => m.metaEffect === metaType) || null;
}

export function getModifierDisplayMeta(m) {
  const desc = m?.description || '';
  const name = m?.name || 'Trait';
  if (m?.metaEffect === 'DEAD') {
    return { icon: '', chipClass: 'meta', prefix: 'Eliminated:', className: 'badge-warn', label: `Eliminated: ${name}`, title: desc };
  }
  if (m?.metaEffect === 'SKIP_TURN') {
    return { icon: '', chipClass: 'meta', prefix: 'Locked out for one round:', className: 'badge-warn', label: `Locked out: ${name}`, title: desc };
  }
  if (m?.metaEffect && m.metaEffect !== 'NONE') {
    return { icon: '', chipClass: 'meta', prefix: '', className: 'badge-warn', label: name, title: desc };
  }
  if (m?.type === 'buff') {
    return { icon: '', chipClass: 'buff', prefix: '', className: 'badge-success', label: `+ ${name}`, title: desc };
  }
  if (m?.type === 'debuff') {
    return { icon: '', chipClass: 'debuff', prefix: '', className: 'badge-warn', label: `- ${name}`, title: desc };
  }
  return { icon: '', chipClass: 'neutral', prefix: '', className: 'badge-genre', label: name, title: desc };
}

export function renderModifierChips(modifiers) {
  if (!modifiers || modifiers.length === 0) {
    return `<span class="mod-chip mod-none">No active traits</span>`;
  }
  return modifiers.map(m => {
    const { prefix, chipClass } = getModifierDisplayMeta(m);
    const prefixText = prefix ? `${prefix} ` : '';
    return `
      <span class="mod-chip mod-${chipClass}" title="${escapeHtml(m.description || '')}">
        ${prefixText}<strong>${escapeHtml(m.name)}</strong>${m.description ? `<small> — ${escapeHtml(m.description)}</small>` : ''}
      </span>
    `;
  }).join(' ');
}
