// ============================================================
// ExPhys LIMS — API Wrapper + Shared Utilities
// ============================================================
// Replace the URL below with your deployed Apps Script Web App URL.
// Found under: Deploy > Manage deployments > Web App URL
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbxQSJHuEUVqhWJR_X7Ioh8QmzxdRER9fqzwQgcBXz4AW8Kvc-SrBapECRKGsnM1uIK4/exec';
const TIMEOUT_MS = 15000;

// ── API Calls ─────────────────────────────────────────────────

async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data && data.error) throw new Error(data.error);
    return data;
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Request timed out after 15s' : err.message;
    showToast('Load error: ' + msg, 'error');
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}

async function apiPost(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // No Content-Type header — avoids CORS preflight with Apps Script
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data && data.error) throw new Error(data.error);
    return data;
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Request timed out after 15s' : err.message;
    showToast('Save error: ' + msg, 'error');
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}

// ── Toast Notifications ───────────────────────────────────────

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastIn .2s ease reverse';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// ── Date Utilities ────────────────────────────────────────────

function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val + 'T00:00:00'); // Force local date parse
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Status Helpers ────────────────────────────────────────────

function calPill(dateStr, needsCal) {
  if (!needsCal || needsCal === 'No' || needsCal === false || needsCal === '') {
    return '<span class="pill pill-blue">N/A</span>';
  }
  if (!dateStr) return '<span class="pill pill-amber">Not Set</span>';
  const d = daysUntil(dateStr);
  if (d === null)  return '<span class="pill pill-amber">Not Set</span>';
  if (d < 0)       return '<span class="pill pill-rose">⚠ Overdue</span>';
  if (d <= 14)     return '<span class="pill pill-amber">Due Soon</span>';
  return '<span class="pill pill-green">OK</span>';
}

function servicePill(dateStr) {
  if (!dateStr) return '<span class="pill pill-blue">—</span>';
  const d = daysUntil(dateStr);
  if (d === null)  return '—';
  if (d < 0)       return '<span class="pill pill-rose">⚠ Overdue</span>';
  if (d <= 14)     return '<span class="pill pill-amber">Due Soon</span>';
  return '<span class="pill pill-green">OK</span>';
}

function stockPill(qty, threshold) {
  const q = Number(qty) || 0;
  const t = Number(threshold) || 0;
  if (q === 0)       return '<span class="pill pill-rose">Out of Stock</span>';
  if (t > 0 && q <= t) return '<span class="pill pill-amber">Low Stock</span>';
  return '<span class="pill pill-green">In Stock</span>';
}

// ── HTML Escaping ─────────────────────────────────────────────

function esc(str) {
  return String(str === null || str === undefined ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Clock ─────────────────────────────────────────────────────

function startClock() {
  function tick() {
    const el = document.getElementById('clock');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
  }
  tick();
  setInterval(tick, 1000);
}

// ── Modal Helpers ─────────────────────────────────────────────

function openModal(id) {
  const m = document.getElementById(id || 'modal');
  if (m) m.style.display = 'flex';
}

function closeModal(id) {
  const m = document.getElementById(id || 'modal');
  if (m) m.style.display = 'none';
}

// Close modal on ESC key or backdrop click
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  }
});

// ── CSV Export ────────────────────────────────────────────────

function downloadCSV(rows, filename) {
  if (!rows || !rows.length) { showToast('No data to export', 'warning'); return; }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = String(r[h] === null || r[h] === undefined ? '' : r[h]);
      return v.includes(',') || v.includes('"') || v.includes('\n')
        ? '"' + v.replace(/"/g, '""') + '"'
        : v;
    }).join(','))
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Populate Select Helper ────────────────────────────────────

function populateSelect(selectEl, items, valueKey, labelKey, selected = '', placeholder = '') {
  selectEl.innerHTML = placeholder ? `<option value="">${placeholder}</option>` : '';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item[valueKey];
    opt.textContent = item[labelKey];
    if (String(item[valueKey]) === String(selected)) opt.selected = true;
    selectEl.appendChild(opt);
  });
}
