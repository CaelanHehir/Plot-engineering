// Host Settings & Gemini API Key Modal Controllers (Single-Source Settings Grid)

const HOST_SETTINGS_SCHEMA = [
  {
    key: 'roundTimer',
    idBase: 'setting-round-timer',
    label: '⏱️ Round Action Timer',
    desc: 'Time per round to write actions (default 2m).',
    type: 'select',
    options: [
      { value: '60', text: '1 Minute (60s)' },
      { value: '90', text: '1.5 Minutes (90s)' },
      { value: '120', text: '2 Minutes (120s - Default)' },
      { value: '180', text: '3 Minutes (180s)' },
      { value: '240', text: '4 Minutes (240s)' },
      { value: '300', text: '5 Minutes (300s)' },
      { value: '0', text: 'Unlimited (No Timer)' }
    ]
  },
  {
    key: 'charCreateTimer',
    idBase: 'setting-char-timer',
    label: '🎨 Character Timer',
    desc: 'Time limit for drawing characters.',
    type: 'select',
    options: [
      { value: '0', text: 'No Timer' },
      { value: '90', text: '1.5 Minutes (90s)' },
      { value: '120', text: '2 Minutes (120s)' },
      { value: '180', text: '3 Minutes (180s)' }
    ]
  },
  {
    key: 'strictness',
    idBase: 'setting-strictness',
    label: '🎭 AI Judge Vibe',
    desc: 'How Gemini scores coordination, coherence & humor.',
    type: 'select',
    options: [
      { value: 'forgiving', text: 'Pure "Yes, And!" Improv' },
      { value: 'balanced', text: 'Comedy & Synergy (Default)' },
      { value: 'brutal', text: 'Tough Comedy Critic' }
    ]
  },
  {
    key: 'maxModifiers',
    idBase: 'setting-max-mods',
    label: '🤕 Max Active Modifiers',
    desc: 'Max active modifiers per player.',
    type: 'select',
    options: [
      { value: '3', text: 'Up to 3 Modifiers' },
      { value: '4', text: 'Up to 4 Modifiers (Default)' },
      { value: '6', text: 'Up to 6 Modifiers' },
      { value: '99', text: 'Unlimited Chaos' }
    ]
  },
  {
    key: 'pointsMultiplier',
    idBase: 'setting-points-mult',
    label: '🏆 Points Multiplier',
    desc: 'Scale round points.',
    type: 'select',
    options: [
      { value: '1', text: '1x Standard Points' },
      { value: '1.5', text: '1.5x High Stakes' },
      { value: '2', text: '2x Double Jeopardy' }
    ]
  },
  {
    key: 'allowStartingQuirk',
    idBase: 'setting-start-quirk',
    label: '🎒 Starting Quirk / Item',
    desc: 'Allow custom starting perk.',
    type: 'checkbox',
    checkboxLabel: 'Allow Starting Quirk'
  }
];

function buildSettingsGridHtml(suffix = '') {
  return HOST_SETTINGS_SCHEMA.map(item => {
    const id = `${item.idBase}${suffix}`;
    if (item.type === 'checkbox') {
      return `
        <div class="setting-item">
          <label>${item.label}</label>
          <div class="setting-desc">${item.desc}</div>
          <label style="display:flex;align-items:center;gap:8px;color:#fff;cursor:pointer;margin-top:6px;">
            <input id="${id}" type="checkbox" checked style="width:16px;height:16px;"
              onchange="updateHostSetting('${item.key}', this.checked)" />
            <span>${item.checkboxLabel}</span>
          </label>
        </div>
      `;
    }
    const optsHtml = item.options.map(o => `<option value="${o.value}">${o.text}</option>`).join('');
    return `
      <div class="setting-item">
        <label for="${id}">${item.label}</label>
        <div class="setting-desc">${item.desc}</div>
        <select id="${id}" class="input-field" onchange="updateHostSetting('${item.key}', this.value)">
          ${optsHtml}
        </select>
      </div>
    `;
  }).join('');
}

function renderSettingsGrids() {
  const lobbyGrid = document.getElementById('lobby-settings-grid');
  const modalGrid = document.getElementById('modal-settings-grid');
  if (lobbyGrid) lobbyGrid.innerHTML = buildSettingsGridHtml('');
  if (modalGrid) modalGrid.innerHTML = buildSettingsGridHtml('-modal');
  syncSettingsUI();
}

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

function updateHostSetting(key, value) {
  if (!app.isHost && app.state.phase !== 'HOME') return;
  if (key === 'roundTimer' || key === 'charCreateTimer' || key === 'maxModifiers') {
    app.state.settings[key] = parseInt(value, 10) || 0;
  } else if (key === 'pointsMultiplier') {
    app.state.settings[key] = parseFloat(value) || 1;
  } else if (key === 'allowStartingQuirk') {
    app.state.settings[key] = Boolean(value);
  } else {
    app.state.settings[key] = value;
  }
  syncSettingsUI();
  if (app.isHost && app.state.phase !== 'HOME') {
    broadcastState();
  }
}

function switchLobbyTab(tabName) {
  app.lobbyTab = tabName;
  document.querySelectorAll('.lobby-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.getElementById('lobby-tab-campaign').classList.toggle('hidden', tabName !== 'campaign');
  document.getElementById('lobby-tab-settings').classList.toggle('hidden', tabName !== 'settings');
  syncSettingsUI();
}

function openSettingsModal() {
  if (!app.isHost && app.state.phase !== 'HOME') {
    showToast('Only the Room Host can change game settings.', 'info');
    return;
  }
  syncSettingsUI();
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function updateApiKeyBadge(verified = isApiKeyVerified) {
  const badge = document.getElementById('api-key-status-badge');
  const activeModel = localStorage.getItem('chaos_coop_gemini_model') || '';
  if (badge) {
    const isOk = Boolean(verified && getStoredApiKey());
    badge.className = 'badge ' + (isOk ? 'badge-success' : 'badge-warn');
    badge.innerHTML = isOk
      ? `✅ Gemini Ready${activeModel ? ` (${activeModel})` : ''}`
      : '⚠️ Set Gemini Key';
  }
}

function openApiKeyModal() {
  document.getElementById('api-key-input').value = isApiKeyVerified ? getStoredApiKey() : '';
  document.getElementById('api-key-modal').classList.remove('hidden');
}

function closeApiKeyModal() {
  document.getElementById('api-key-modal').classList.add('hidden');
}

async function saveApiKeyFromModal() {
  const inputEl = document.getElementById('api-key-input');
  const val = (inputEl ? inputEl.value : '').trim();

  if (!val) {
    setStoredApiKey('');
    if (inputEl) inputEl.value = '';
    updateApiKeyBadge(false);
    closeApiKeyModal();
    showToast('Cleared Gemini API Key (Demo AI Mode active).', 'warn');
    return;
  }

  setLoadingOverlay(true, '🔑 Verifying Gemini API Key...');
  try {
    const models = await validateAndDiscoverModels(val);
    setLoadingOverlay(false);
    setStoredApiKey(val);
    isApiKeyVerified = true;
    updateApiKeyBadge(true);
    closeApiKeyModal();
    showToast(`✅ Gemini API Key verified! Active model: ${models[0]}`, 'success');
  } catch (err) {
    setLoadingOverlay(false);
    setStoredApiKey('');
    isApiKeyVerified = false;
    if (inputEl) {
      inputEl.value = '';
      inputEl.focus();
    }
    updateApiKeyBadge(false);
    showToast('❌ Invalid API Key refused: ' + err.message, 'error');
  }
}
