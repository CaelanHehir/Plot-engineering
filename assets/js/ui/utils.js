/**
 * Shared UI, DOM, Formatting & GitHub Pages URL Helper Utilities
 */

/** Canonical GitHub Pages hosting URL for multiplayer invites */
const GITHUB_PAGES_URL = 'https://caelanhehir.github.io/Plot-engineering/';

/**
 * Resolves the public base URL of the currently running game.
 * Automatically respects custom web hosting or falls back to the GitHub Pages production URL.
 * 
 * @returns {string} Fully qualified base URL ending with a slash
 */
function getPublicGameBaseUrl() {
  try {
    const loc = window.location;
    const isHttp = loc.protocol === 'http:' || loc.protocol === 'https:';
    const isLocalhost = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' || loc.hostname === '';
    if (isHttp && !isLocalhost) {
      const cleanPath = loc.pathname.replace(/index\.html$/i, '');
      return `${loc.origin}${cleanPath.endsWith('/') ? cleanPath : cleanPath + '/'}`;
    }
  } catch (e) {}
  return GITHUB_PAGES_URL;
}

/**
 * Generates an invite URL with the given 4-letter room code in the query string.
 * 
 * @param {string} roomCode - 4-character room code
 * @returns {string} Complete URL with ?room=CODE
 */
function getRoomInviteUrl(roomCode) {
  const base = getPublicGameBaseUrl();
  const url = new URL(base);
  if (roomCode) {
    url.searchParams.set('room', String(roomCode).toUpperCase());
  }
  return url.toString();
}

/**
 * Produces a concise, human-friendly URL string for the in-room banner display.
 * Strips http://, https://, and trailing slashes for clean reading.
 * 
 * @returns {string} e.g. "caelanhehir.github.io/Plot-engineering"
 */
function getShortDisplayJoinUrl() {
  const base = getPublicGameBaseUrl();
  return base.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/**
 * Escapes unsafe HTML characters to prevent XSS injection from player inputs or AI responses.
 * 
 * @param {string} str - Raw input string
 * @returns {string} HTML-escaped string
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Inserts soft hyphens (&shy; / \u00AD) into unusually long words that exceed the width
 * of a text box (26+ characters). This allows the browser to hyphenate and break only
 * extreme words onto the next line without splitting normal English words.
 * 
 * @param {string} str - Text to format
 * @returns {string} Text with soft hyphens in 26+ character words
 */
function hyphenateLongWords(str) {
  return String(str ?? '').replace(/\S{26,}/g, (word) => word.split('').join('\u00AD'));
}

/**
 * Formats seconds into mm:ss or ss string.
 * 
 * @param {number} sec - Duration in seconds
 * @returns {string} e.g. "1:30" or "45s"
 */
function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

/**
 * Displays or hides the full-screen modal loading overlay with custom text.
 * 
 * @param {boolean} visible - Whether to show the overlay
 * @param {string} text - Message to display under the spinner
 */
function setLoadingOverlay(visible, text = 'Loading...') {
  const el = document.getElementById('loading-overlay');
  const txt = document.getElementById('loading-text');
  if (txt) txt.textContent = text;
  if (el) el.classList.toggle('hidden', !visible);
}

/**
 * Displays a single temporary toast notification at the bottom right.
 * Immediately clears any previous toast so only one notification is active at a time.
 * 
 * @param {string} message - Notification text
 * @param {'info'|'success'|'warn'|'error'} type - Style theme for the toast
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  // Capped at one notification at a time: immediately clear previous toast
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

/**
 * Sanitizes base64 avatar data URLs to prevent script injection (B2).
 * Only permits valid webp, png, or jpeg base64 data URIs up to 60,000 characters.
 * 
 * @param {string} url - Raw avatar string
 * @returns {string} Validated data URL or empty string
 */
function sanitizeAvatar(url) {
  if (!url || typeof url !== 'string' || url.length > 60000) return '';
  const match = url.match(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/);
  return match ? url : '';
}

/**
 * Renders an avatar image element from a data URL or falls back to an emoji placeholder.
 * 
 * @param {string} avatarData - Canvas data URL (image/webp or image/png)
 * @param {string} sizeClass - CSS class controlling dimensions (avatar-img, avatar-img-sm, avatar-img-lg)
 * @returns {string} HTML string
 */
function renderAvatarHtml(avatarData, sizeClass = 'avatar-img') {
  const safeAvatar = sanitizeAvatar(avatarData);
  if (safeAvatar) {
    return `<img src="${escapeHtml(safeAvatar)}" class="${sizeClass}" alt="Character Portrait" />`;
  }
  return `<div class="${sizeClass}" style="display:inline-flex;align-items:center;justify-content:center;font-size:1.5rem;">🎨</div>`;
}

/**
 * Finds an active meta-modifier of a specific type (DEAD, SKIP_TURN, WORD_LIMIT, BLINDED_SCENARIO) on a player.
 * 
 * @param {object} player - Player object from game state
 * @param {string} metaType - Meta condition key to check for
 * @returns {object|null} Matching modifier object or null
 */
function getPlayerMetaMod(player, metaType) {
  if (!player || !Array.isArray(player.modifiers)) return null;
  return player.modifiers.find(m => m.metaEffect === metaType) || null;
}

/**
 * Returns icon, CSS class, and prefix label for modifier chips based on their effect type.
 * 
 * @param {object} m - Modifier object
 * @returns {{icon: string, chipClass: string, prefix: string}}
 */
function getModifierDisplayMeta(m) {
  if (m.metaEffect === 'DEAD') return { icon: '💀', chipClass: 'meta', prefix: '💀 +ELIMINATED:' };
  if (m.metaEffect === 'SKIP_TURN') return { icon: '⛓️', chipClass: 'meta', prefix: '⛓️ +1-Turn Lockout:' };
  if (m.metaEffect && m.metaEffect !== 'NONE') return { icon: '⚠️', chipClass: 'meta', prefix: '⚠️ +Meta Status:' };
  if (m.type === 'buff') return { icon: '🟢', chipClass: 'buff', prefix: '🟢 +Perk/Item:' };
  if (m.type === 'debuff') return { icon: '🔴', chipClass: 'debuff', prefix: '🔴 +Condition:' };
  return { icon: '🟣', chipClass: 'neutral', prefix: '🟣 +Modifier:' };
}

/**
 * Generates HTML chips for a player's active modifiers and perks.
 * 
 * @param {Array<object>} modifiers - List of active modifier objects
 * @returns {string} HTML markup for the modifier chips
 */
function renderModifierChips(modifiers) {
  if (!modifiers || modifiers.length === 0) {
    return `<span class="mod-chip mod-none">✨ No active status effects</span>`;
  }
  return modifiers.map(m => {
    const { icon, chipClass } = getModifierDisplayMeta(m);
    return `
      <span class="mod-chip mod-${chipClass}" title="${escapeHtml(m.description || '')}">
        ${icon} <strong>${escapeHtml(m.name)}</strong>
        ${m.description ? `<small>— ${escapeHtml(m.description)}</small>` : ''}
      </span>
    `;
  }).join('');
}
