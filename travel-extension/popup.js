'use strict';

// ── State ──────────────────────────────────────────────────────────────────────
let screenshotDataUrl = null;
let extractedData     = null;

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const { apiKey, appEndpoint } = await chrome.storage.sync.get(['apiKey', 'appEndpoint']);
  if (!apiKey || !appEndpoint) {
    show('settings');
    document.getElementById('settings-btn').style.visibility = 'hidden';
  } else {
    await loadTab();
    show('capture');
  }
});

// ── Panel switching ────────────────────────────────────────────────────────────
function show(name) {
  document.querySelectorAll('.panel').forEach(p => (p.style.display = 'none'));
  document.getElementById(`panel-${name}`).style.display = 'block';
  // Hide the header gear icon while on settings or loading
  document.getElementById('settings-btn').style.visibility =
    (name === 'settings' || name === 'loading') ? 'hidden' : 'visible';
}

// ── Tab info ───────────────────────────────────────────────────────────────────
async function loadTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById('page-title').textContent = tab.title  || 'Untitled page';
  document.getElementById('page-url').textContent   = tab.url    || '';
}

// ── Settings ───────────────────────────────────────────────────────────────────
document.getElementById('settings-btn').addEventListener('click', async () => {
  const { apiKey, appEndpoint } = await chrome.storage.sync.get(['apiKey', 'appEndpoint']);
  document.getElementById('api-key').value      = apiKey      || '';
  document.getElementById('app-endpoint').value = appEndpoint || '';
  show('settings');
});

document.getElementById('save-settings-btn').addEventListener('click', async () => {
  const apiKey      = document.getElementById('api-key').value.trim();
  const appEndpoint = document.getElementById('app-endpoint').value.trim();

  if (!apiKey)      return showError('settings', 'Enter your Claude API key.');
  if (!appEndpoint) return showError('settings', 'Enter your travel app endpoint URL.');

  await chrome.storage.sync.set({ apiKey, appEndpoint });
  document.getElementById('settings-btn').style.visibility = 'visible';
  await loadTab();
  show('capture');
});

// ── Capture ────────────────────────────────────────────────────────────────────
document.getElementById('capture-btn').addEventListener('click', async () => {
  show('loading');
  setStatus('Capturing screenshot…');

  try {
    // Grab the visible tab as a PNG data URL
    screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });

    setStatus('Reading page with AI…');
    const { apiKey } = await chrome.storage.sync.get(['apiKey']);
    const base64 = screenshotDataUrl.replace('data:image/png;base64,', '');
    extractedData = await extractWithAI(base64, apiKey);

    renderResults(extractedData);
    show('results');
  } catch (err) {
    await loadTab();
    show('capture');
    showError('capture', err.message);
  }
});

function setStatus(msg) {
  document.getElementById('loading-status').textContent = msg;
}

// ── AI extraction ──────────────────────────────────────────────────────────────
async function extractWithAI(base64Image, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: 'image/png', data: base64Image },
          },
          {
            type: 'text',
            text: `This is a screenshot of a travel booking confirmation page.
Extract the reservation details and return ONLY a valid JSON object.
Include only fields that are clearly visible on screen. Use these exact keys:

{
  "type": "flight | hotel | car | restaurant | activity | other",
  "name": "hotel, airline, or venue name",
  "confirmation_number": "booking / reservation / confirmation number",
  "check_in": "check-in date and time, or flight departure",
  "check_out": "check-out date and time, or flight arrival",
  "address": "full street address",
  "city": "city name",
  "country": "country",
  "total_price": "total price with currency symbol",
  "cancellation_policy": "one-line summary",
  "notes": "any other important details"
}

Return only the JSON object — no explanation, no markdown fences.`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `AI request failed (HTTP ${res.status})`);
  }

  const result = await res.json();
  const text   = result.content[0].text.trim();
  const match  = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI returned an unexpected response. Please try again.');

  return JSON.parse(match[0]);
}

// ── Render results ─────────────────────────────────────────────────────────────
const TYPE_ICONS = {
  flight:     '✈️',
  hotel:      '🏨',
  car:        '🚗',
  restaurant: '🍽️',
  activity:   '🎯',
  other:      '📋',
};

const FIELD_DEFS = [
  { key: 'name',                 label: 'Name' },
  { key: 'confirmation_number',  label: 'Confirmation #' },
  { key: 'check_in',             label: 'Check-in / Departure' },
  { key: 'check_out',            label: 'Check-out / Arrival' },
  { key: 'address',              label: 'Address' },
  { key: 'city',                 label: 'City' },
  { key: 'country',              label: 'Country' },
  { key: 'total_price',          label: 'Total Price' },
  { key: 'cancellation_policy',  label: 'Cancellation' },
  { key: 'notes',                label: 'Notes' },
];

function renderResults(data) {
  const type = (data.type || 'other').toLowerCase();
  document.getElementById('type-badge').textContent =
    `${TYPE_ICONS[type] || '📋'} ${type}`;

  document.getElementById('screenshot-preview').src = screenshotDataUrl;

  const container = document.getElementById('results-fields');
  container.innerHTML = '';

  FIELD_DEFS.forEach(({ key, label }) => {
    if (!data[key]) return;
    const div = document.createElement('div');
    div.className = 'result-field';
    div.innerHTML = `<label>${label}</label>
      <input type="text" data-key="${key}" value="${escapeAttr(String(data[key]))}">`;
    container.appendChild(div);
  });
}

// ── Send to travel app ─────────────────────────────────────────────────────────
document.getElementById('send-btn').addEventListener('click', async () => {
  // Merge any edits the user made to the fields
  const edits = {};
  document.querySelectorAll('#results-fields input[data-key]').forEach(input => {
    edits[input.dataset.key] = input.value.trim();
  });

  const [tab]          = await chrome.tabs.query({ active: true, currentWindow: true });
  const { appEndpoint } = await chrome.storage.sync.get(['appEndpoint']);

  const payload = {
    ...extractedData,
    ...edits,
    source_url:   tab.url,
    source_title: tab.title,
    captured_at:  new Date().toISOString(),
    screenshot:   screenshotDataUrl,   // base64 PNG — remove if your backend doesn't need it
  };

  try {
    const res = await fetch(appEndpoint, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    show('success');
  } catch (err) {
    showError('results', err.message);
  }
});

// ── Navigation ─────────────────────────────────────────────────────────────────
document.getElementById('back-btn').addEventListener('click', async () => {
  await loadTab();
  show('capture');
});

document.getElementById('capture-again-btn').addEventListener('click', async () => {
  await loadTab();
  show('capture');
});

// ── Error display ──────────────────────────────────────────────────────────────
function showError(panel, msg) {
  const el = document.getElementById(`${panel}-error`);
  if (!el) return;
  el.textContent    = msg;
  el.style.display  = 'block';
  setTimeout(() => (el.style.display = 'none'), 6000);
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
