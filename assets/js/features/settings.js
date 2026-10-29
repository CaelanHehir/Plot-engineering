/**
 * Host Settings & Gemini API Key Modal Controllers
 * 
 * Manages:
 * 1. Single-source settings schema (HOST_SETTINGS_SCHEMA) rendering identical options
 *    in both the in-lobby campaign view and the floating House Rules modal.
 * 2. Real-time bi-directional setting value synchronization across UI elements.
 * 3. Gemini API key verification against Google's Models API and modal controls.
 */

/**
 * Single-source configuration schema for all customizable game rules.
 * Automatically generates HTML inputs for both the lobby and the settings modal.
 */
const HOST_SETTINGS_SCHEMA = [
  {
    key: 'roundTimer',
    idBase: 'setting-round-timer',
    label: 'Round Action Timer',
    defaultTag: '2 min',
    desc: 'Time per round to write actions.',
    type: 'select',
    options: [
      { value: '60', text: '1 min' },
      { value: '90', text: '1.5 min' },
      { value: '120', text: '2 min' },
      { value: '180', text: '3 min' },
      { value: '240', text: '4 min' },
      { value: '300', text: '5 min' },
      { value: '0', text: 'Unlimited' }
    ]
  },
  {
    key: 'charCreateTimer',
    idBase: 'setting-char-timer',
    label: 'Character Timer',
    defaultTag: 'None',
    desc: 'Time limit for drawing characters.',
    type: 'select',
    options: [
      { value: '0', text: 'None' },
      { value: '90', text: '1.5 min' },
      { value: '120', text: '2 min' },
      { value: '180', text: '3 min' }
    ]
  },
  {
    key: 'strictness',
    idBase: 'setting-strictness',
    label: 'Judge Strictness',
    defaultTag: 'Balanced',
    desc: 'How strictly the Judge scores moves.',
    type: 'select',
    options: [
      { value: 'forgiving', text: 'Forgiving' },
      { value: 'balanced', text: 'Balanced' },
      { value: 'brutal', text: 'Tough Critic' }
    ]
  },
  {
    key: 'maxModifiers',
    idBase: 'setting-max-mods',
    label: 'Max Active Traits',
    defaultTag: 'Up to 4',
    desc: 'Max active traits per player.',
    type: 'select',
    options: [
      { value: '3', text: 'Up to 3' },
      { value: '4', text: 'Up to 4' },
      { value: '6', text: 'Up to 6' },
      { value: '99', text: 'Unlimited' }
    ]
  },
  {
    key: 'pointsMultiplier',
    idBase: 'setting-points-mult',
    label: 'Points Multiplier',
    defaultTag: '1x',
    desc: 'Scale round points.',
    type: 'select',
    options: [
      { value: '1', text: '1x Standard' },
      { value: '1.5', text: '1.5x High Stakes' },
      { value: '2', text: '2x Double' }
    ]
  },
  {
    key: 'allowStartingQuirk',
    idBase: 'setting-start-quirk',
    label: 'Starting Trait',
    defaultTag: 'Off',
    desc: 'Allow custom starting trait.',
    type: 'checkbox',
    checkboxLabel: 'Allow Starting Trait'
  },
  {
    key: 'revealMovesAfterStory',
    idBase: 'setting-reveal-moves',
    label: 'Reveal Moves After Story',
    defaultTag: 'On',
    desc: 'Show all player moves once the story plays out.',
    type: 'checkbox',
    checkboxLabel: 'Reveal all player moves after judging'
  }
];

/**
 * Builds the HTML grid for the settings schema.
 * 
 * @param {string} suffix - ID suffix (e.g., '' for lobby, '-modal' for floating modal)
 * @returns {string} HTML markup string
 */
function buildSettingsGridHtml(suffix = '') {
  return HOST_SETTINGS_SCHEMA.map(item => {
    const id = `${item.idBase}${suffix}`;
    const defaultBadge = item.defaultTag ? `<span class="setting-default-tag">(default: ${escapeHtml(item.defaultTag)})</span>` : '';
    if (item.type === 'checkbox') {
      const isChecked = Boolean(app?.state?.settings?.[item.key]);
      return `
        <div class="setting-item">
          <div class="setting-label-row">
            <label for="${id}">${item.label}</label>
            ${defaultBadge}
          </div>
          <div class="setting-desc">${item.desc}</div>
          <label class="setting-checkbox-control">
            <input id="${id}" type="checkbox" ${isChecked ? 'checked' : ''} style="width:1.25rem;height:1.25rem;cursor:pointer;"
              data-bind="host-setting" data-setting-key="${item.key}" />
            <span>${item.checkboxLabel}</span>
          </label>
        </div>
      `;
    }
    const optsHtml = item.options.map(o => `<option value="${o.value}">${o.text}</option>`).join('');
    return `
      <div class="setting-item">
        <div class="setting-label-row">
          <label for="${id}">${item.label}</label>
          ${defaultBadge}
        </div>
        <div class="setting-desc">${item.desc}</div>
        <select id="${id}" class="input-field setting-input-control" data-bind="host-setting" data-setting-key="${item.key}">
          ${optsHtml}
        </select>
      </div>
    `;
  }).join('');
}

/**
 * Renders both the in-lobby and in-modal settings grids and synchronizes values.
 */
function renderSettingsGrids() {
  const lobbyGrid = document.getElementById('lobby-settings-grid');
  const modalGrid = document.getElementById('modal-settings-grid');
  if (lobbyGrid) lobbyGrid.innerHTML = buildSettingsGridHtml('');
  if (modalGrid) modalGrid.innerHTML = buildSettingsGridHtml('-modal');
  syncSettingsUI();
}

/**
 * Synchronizes the values of all settings form inputs across both the lobby and modal.
 */
function syncSettingsUI() {
  const s = app.state.settings;
  ['', '-modal'].forEach(suffix => {
    HOST_SETTINGS_SCHEMA.forEach(item => {
      const el = document.getElementById(`${item.idBase}${suffix}`);
      if (!el) return;
      if (item.type === 'checkbox') {
        el.checked = Boolean(s[item.key]);
      } else {
        el.value = String(s[item.key]);
      }
    });
  });
}

/**
 * Updates a host setting in the game state, refreshes the UI, and broadcasts to peers.
 * 
 * @param {string} key - Setting property name
 * @param {string|boolean} value - New value
 */
function updateHostSetting(key, value) {
  if (!app.isHost && app.state.phase !== 'HOME') return;
  if (key === 'roundTimer' || key === 'charCreateTimer' || key === 'maxModifiers') {
    app.state.settings[key] = parseInt(value, 10) || 0;
  } else if (key === 'pointsMultiplier') {
    app.state.settings[key] = parseFloat(value) || 1;
  } else if (key === 'allowStartingQuirk' || key === 'revealMovesAfterStory') {
    app.state.settings[key] = Boolean(value);
  } else {
    app.state.settings[key] = value;
  }
  syncSettingsUI();
  if (app.isHost && app.state.phase !== 'HOME') {
    broadcastState();
  }
}

/**
 * Switches between the 'campaign' and 'settings' tabs in the host campaign setup section.
 * @param {'campaign'|'settings'} tabName
 */
function switchLobbyTab(tabName) {
  app.lobbyTab = tabName;
  document.querySelectorAll('.lobby-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.getElementById('lobby-tab-campaign').classList.toggle('hidden', tabName !== 'campaign');
  document.getElementById('lobby-tab-settings').classList.toggle('hidden', tabName !== 'settings');
  syncSettingsUI();
}

/** Opens the House Rules editor (host only) */
function openSettingsModal() {
  if (!app.isHost && app.state.phase !== 'HOME') {
    showToast('Only the Room Host can change game settings.', 'info');
    return;
  }
  if (app.state.phase === 'LOBBY') {
    openLobbyCampaignSetup();
    const details = document.getElementById('lobby-house-rules-details');
    if (details) {
      details.open = true;
      setTimeout(() => details.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    return;
  }
  syncSettingsUI();
  openAccessibleModal('settings-modal');
}

/** Closes the floating House Rules modal */
function closeSettingsModal() {
  closeAccessibleModal('settings-modal');
}

/**
 * Updates the visual button indicating AI key status in the top menu (Part 2, U1).
 * Shows "AI key: Ready" or "AI key: Not set", omitting raw model names outside the modal.
 * 
 * @param {boolean} [verified]
 */
function updateApiKeyBadge(verified = isApiKeyVerified) {
  const btn = document.getElementById('menu-ai-key-btn');
  const badge = document.getElementById('api-key-status-badge');
  const homePill = document.getElementById('home-ai-key-btn');
  const isOk = Boolean(verified && getStoredApiKey());
  const label = isOk ? 'AI key: Ready' : 'AI key: Not set';
  if (btn) {
    btn.textContent = label;
  }
  if (badge) {
    badge.className = 'badge ' + (isOk ? 'badge-success' : 'badge-warn');
    badge.textContent = label;
  }
  if (homePill) {
    homePill.className = 'btn-small home-key-pill mb-2 ' + (isOk ? 'key-ready' : 'key-not-set');
    homePill.innerHTML = isOk
      ? '🔑 AI Key: <strong>Ready ✓</strong>'
      : '🔑 AI Key: <strong>Not set (tap to enter)</strong>';
  }
}

/** Opens the Gemini API Key configuration modal */
function openApiKeyModal() {
  const input = document.getElementById('api-key-input');
  if (input) {
    input.value = isApiKeyVerified ? getStoredApiKey() : '';
    input.classList.add('key-masked');
  }
  const toggleBtn = document.getElementById('btn-toggle-key-visibility');
  if (toggleBtn) toggleBtn.textContent = 'Show';
  openAccessibleModal('api-key-modal', '#api-key-input');
}

/** Toggles masked visibility for the Gemini API Key input field */
function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key-input');
  const btn = document.getElementById('btn-toggle-key-visibility');
  if (!input) return;
  const isMasked = input.classList.contains('key-masked');
  input.classList.toggle('key-masked', !isMasked);
  if (btn) btn.textContent = isMasked ? 'Hide' : 'Show';
}

/** Closes the Gemini API Key configuration modal */
function closeApiKeyModal() {
  closeAccessibleModal('api-key-modal');
}

/**
 * Validates and saves the entered Gemini API key.
 * Shows feedback or clears the key if left empty.
 */
async function saveApiKeyFromModal() {
  const inputEl = document.getElementById('api-key-input');
  const val = (inputEl ? inputEl.value : '').trim();
  const prevKey = getStoredApiKey();

  if (!val) {
    setStoredApiKey('');
    if (inputEl) inputEl.value = '';
    updateApiKeyBadge(false);
    closeApiKeyModal();
    showToast('Cleared Gemini API Key.', 'info');
    return;
  }

  setLoadingOverlay(true, 'Verifying API key...');
  try {
    const models = await validateAndDiscoverModels(val);
    setLoadingOverlay(false);
    setStoredApiKey(val);
    isApiKeyVerified = true;
    updateApiKeyBadge(true);
    closeApiKeyModal();
    showToast(`API key verified! Active model: ${models[0]}`, 'success');
  } catch (err) {
    setLoadingOverlay(false);
    if (err.code === 'INVALID') {
      // Key was explicitly rejected by the server
      setStoredApiKey('');
      isApiKeyVerified = false;
      if (inputEl) {
        inputEl.value = '';
        inputEl.focus();
      }
      updateApiKeyBadge(false);
      showToast('Invalid API key: ' + err.message, 'error');
    } else {
      // B4: Network timeout or rate limit: restore previous key and do not wipe it
      setStoredApiKey(prevKey);
      if (inputEl) inputEl.value = prevKey;
      showToast(err.code === 'RATE' ? 'Rate limit reached. Stored key kept.' : 'Network error verifying key. Stored key kept.', 'warn');
      closeApiKeyModal();
    }
  }
}
