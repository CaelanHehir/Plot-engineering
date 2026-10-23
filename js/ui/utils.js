// Shared UI & DOM Helper Functions

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function setLoadingOverlay(visible, text = 'Loading...') {
  const el = document.getElementById('loading-overlay');
  const txt = document.getElementById('loading-text');
  if (txt) txt.textContent = text;
  if (el) el.classList.toggle('hidden', !visible);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function renderAvatarHtml(avatarData, sizeClass = 'avatar-img') {
  if (avatarData && avatarData.startsWith('data:image/')) {
    return `<img src="${avatarData}" class="${sizeClass}" alt="Character Portrait" />`;
  }
  return `<div class="${sizeClass}" style="display:inline-flex;align-items:center;justify-content:center;font-size:1.5rem;">🎨</div>`;
}

function getPlayerMetaMod(player, metaType) {
  if (!player || !Array.isArray(player.modifiers)) return null;
  return player.modifiers.find(m => m.metaEffect === metaType) || null;
}

function getModifierDisplayMeta(m) {
  if (m.metaEffect === 'DEAD') return { icon: '💀', chipClass: 'meta', prefix: '💀 +ELIMINATED:' };
  if (m.metaEffect === 'SKIP_TURN') return { icon: '⛓️', chipClass: 'meta', prefix: '⛓️ +1-Turn Lockout:' };
  if (m.metaEffect && m.metaEffect !== 'NONE') return { icon: '⚠️', chipClass: 'meta', prefix: '⚠️ +Meta Status:' };
  if (m.type === 'buff') return { icon: '🟢', chipClass: 'buff', prefix: '🟢 +Perk/Item:' };
  if (m.type === 'debuff') return { icon: '🔴', chipClass: 'debuff', prefix: '🔴 +Condition:' };
  return { icon: '🟣', chipClass: 'neutral', prefix: '🟣 +Modifier:' };
}

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
