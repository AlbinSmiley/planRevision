import { PLAN, EXAMS } from './data.js';

// ─── État ──────────────────────────────────────────────────────────────────────
let STATE = {};
let GH = null;        // { token, owner, repo, branch }
let progressSha = null;
let saveTimer = null;

// ─── LocalStorage ─────────────────────────────────────────────────────────────
function lsGet(key)      { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ─── GitHub API ───────────────────────────────────────────────────────────────
async function ghFetch(path, opts = {}) {
  if (!GH) return null;
  const url = `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${GH.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
  return res;
}

async function ghReadProgress() {
  try {
    const res = await ghFetch('progress.json');
    if (!res || res.status === 404) { progressSha = null; return null; }
    if (!res.ok) return null;
    const data = await res.json();
    progressSha = data.sha;
    return JSON.parse(atob(data.content.replace(/\s/g, '')));
  } catch { return null; }
}

async function ghWriteProgress(state) {
  try {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));
    const body = {
      message: `Progression du ${new Date().toLocaleDateString('fr-CH')}`,
      content,
      branch: GH.branch || 'main',
      ...(progressSha ? { sha: progressSha } : {}),
    };
    const res = await ghFetch('progress.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res && res.ok) {
      const data = await res.json();
      progressSha = data.content.sha;
      setSyncStatus('ok');
    } else {
      setSyncStatus('error');
    }
  } catch { setSyncStatus('error'); }
}

// ─── Sync status indicator ────────────────────────────────────────────────────
function setSyncStatus(status) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.className = 'sync-dot s-' + status;
  const titles = { ok: 'Synchronisé avec GitHub', saving: 'Sauvegarde en cours…', error: 'Erreur de sync', local: 'Sauvegarde locale uniquement', loading: 'Chargement…' };
  el.title = titles[status] || '';
}

// ─── Save (debounced) ─────────────────────────────────────────────────────────
function scheduleSave() {
  lsSet('revision-checks', STATE);
  setSyncStatus(GH ? 'saving' : 'local');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (GH) await ghWriteProgress(STATE);
    else setSyncStatus('local');
  }, 2500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  GH = lsGet('gh-config');
  setSyncStatus('loading');

  if (GH) {
    const remote = await ghReadProgress();
    if (remote !== null) {
      STATE = remote;
      setSyncStatus('ok');
    } else {
      STATE = lsGet('revision-checks') || {};
      setSyncStatus('error');
    }
  } else {
    STATE = lsGet('revision-checks') || {};
    setSyncStatus('local');
  }

  render();
  bindSettings();
  bindReset();
  bindRefs();
  updateExamCountdowns();
  setInterval(updateExamCountdowns, 60000);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function taskId(dayId, bi, ti) { return `${dayId}:${bi}:${ti}`; }

const TAG_LABELS = { alg: 'Algèbre', thermo: 'Thermo', analyse: 'Analyse', metro: 'Métro', rest: 'Repos' };

function dayHTML(item) {
  const isExam = !!item.exam;
  const allIds  = item.blocks.flatMap((b, bi) => b.tasks.map((_, ti) => taskId(item.id, bi, ti)));
  const done    = allIds.filter(id => STATE[id]).length;

  return `
  <article class="day${isExam ? ' exam-day' : ''}" data-id="${item.id}">
    <div class="dhead">
      <div class="dnum">
        <span class="wd">${item.wd}</span>
        <span class="dd">${item.d.split(' ')[0]}</span>
      </div>
      <div class="dtitle">
        <div class="h">${item.title}</div>
        ${item.sub ? `<div class="sub">${item.sub}</div>` : ''}
      </div>
      <div class="dmeta">
        <span class="hrs">${item.h}</span>
        <span class="dprog">${allIds.length ? `${done}/${allIds.length}` : ''}</span>
        <span class="chev" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </div>
    </div>
    <div class="dbody">
      ${isExam ? examFlagHTML(item) : ''}
      ${item.blocks.map((b, bi) => blockHTML(b, bi, item.id)).join('')}
    </div>
  </article>`;
}

function examFlagHTML(item) {
  const e = EXAMS.find(x => x.k === item.exam.k);
  return `<div class="exam-flag ${e.k}">
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5l1.9 4 4.3.4-3.2 2.9 1 4.2-4-2.4-4 2.4 1-4.2-3.2-2.9 4.3-.4z"
            stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
    <span>${e.label}</span><span class="ftime">${e.time}</span>
  </div>`;
}

function blockHTML(b, bi, dayId) {
  return `<div class="block">
    <span class="bwhen">${b.when}</span>
    <div class="btasks">${b.tasks.map((t, ti) => taskHTML(t, bi, ti, dayId)).join('')}</div>
  </div>`;
}

function taskHTML(t, bi, ti, dayId) {
  const id   = taskId(dayId, bi, ti);
  const done = STATE[id] ? ' done' : '';
  return `<label class="task${done}" data-task data-id="${id}">
    <span class="cbx" aria-hidden="true">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M2 5.5l2.3 2.3 4.7-4.7" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
    <span class="tlabel">
      <span class="tag ${t.tag}">${TAG_LABELS[t.tag] || t.tag}</span>${t.label}
    </span>
  </label>`;
}

function render() {
  const plan = document.getElementById('plan');
  let html = '';
  let delay = 0;
  PLAN.forEach(item => {
    if (item.phase) {
      html += `<h2 class="phase">${item.phase}</h2>`;
    } else {
      html += `<div style="animation-delay:${Math.min(delay * 18, 320)}ms">${dayHTML(item)}</div>`;
      delay++;
    }
  });
  plan.innerHTML = html;
  bindDays();
  updateProgress();
}

function bindDays() {
  document.querySelectorAll('.dhead').forEach(h => {
    h.addEventListener('click', e => {
      if (e.target.closest('[data-task]')) return;
      const art = h.closest('article');
      art.classList.toggle('open');
    });
  });
  document.querySelectorAll('[data-task]').forEach(label => {
    label.addEventListener('click', e => {
      e.preventDefault();
      const id = label.dataset.id;
      STATE[id] = !STATE[id];
      label.classList.toggle('done', !!STATE[id]);
      refreshDayProgress(label.closest('article').dataset.id);
      updateProgress();
      scheduleSave();
    });
  });
}

function refreshDayProgress(dayId) {
  const art = document.querySelector(`[data-id="${dayId}"]`);
  if (!art) return;
  const tasks = art.querySelectorAll('[data-task]');
  const done  = [...tasks].filter(t => STATE[t.dataset.id]).length;
  const el    = art.querySelector('.dprog');
  if (el) el.textContent = tasks.length ? `${done}/${tasks.length}` : '';
}

function updateProgress() {
  const all  = document.querySelectorAll('[data-task]');
  const done = [...all].filter(t => STATE[t.dataset.id]).length;
  const total = all.length;
  const pct  = total ? Math.round(done / total * 100) : 0;

  const bar = document.getElementById('overbar');
  if (bar) bar.style.width = pct + '%';

  const doneEl  = document.getElementById('donecount');
  const totalEl = document.getElementById('totalcount');
  const pctEl   = document.getElementById('pcttext');
  if (doneEl)  doneEl.textContent  = done;
  if (totalEl) totalEl.textContent = total;
  if (pctEl)   pctEl.textContent   = pct + ' %';

  const ring = document.getElementById('ringfill');
  if (ring) {
    const C = 150.8;
    ring.style.strokeDashoffset = C - (C * pct / 100);
  }
  const ringtxt = document.getElementById('ringtxt');
  if (ringtxt) ringtxt.textContent = pct + '%';
}

// ─── Exam countdowns ─────────────────────────────────────────────────────────
function updateExamCountdowns() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  EXAMS.forEach(e => {
    const el = document.getElementById('cd-' + e.k);
    if (!el) return;
    const ed   = new Date(e.date + 'T00:00:00');
    const diff = Math.round((ed - today) / 86400000);
    if (diff > 1)      el.innerHTML = `${diff}<small> j</small>`;
    else if (diff === 1) el.textContent = 'demain';
    else if (diff === 0) el.textContent = "auj.";
    else                 el.innerHTML = '<small>fait</small> ✓';
  });
}

// ─── Settings dialog ─────────────────────────────────────────────────────────
function bindSettings() {
  const btn    = document.getElementById('settingsBtn');
  const dialog = document.getElementById('settingsDialog');
  const form   = document.getElementById('ghForm');
  const closeB = document.getElementById('closeSettings');
  const status = document.getElementById('ghStatus');

  btn.addEventListener('click', () => {
    const cfg = lsGet('gh-config') || {};
    document.getElementById('ghToken').value  = cfg.token  || '';
    document.getElementById('ghOwner').value  = cfg.owner  || '';
    document.getElementById('ghRepo').value   = cfg.repo   || '';
    document.getElementById('ghBranch').value = cfg.branch || 'main';
    dialog.showModal();
  });
  closeB.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  document.getElementById('testGh').addEventListener('click', async () => {
    const cfg = readForm();
    if (!cfg) { showStatus('Remplis tous les champs.', 'err'); return; }
    showStatus('Test en cours…', 'wait');
    GH = cfg;
    const data = await ghReadProgress();
    GH = lsGet('gh-config');
    if (data !== null) showStatus('✓ Connexion OK — progression chargée.', 'ok');
    else if (progressSha === null) showStatus('✓ Connexion OK — progress.json sera créé.', 'ok');
    else showStatus('✗ Échec — vérifie le token et le nom du dépôt.', 'err');
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const cfg = readForm();
    if (!cfg) return;
    lsSet('gh-config', cfg);
    GH = cfg;
    dialog.close();
    setSyncStatus('saving');
    ghWriteProgress(STATE);
  });

  document.getElementById('clearGh').addEventListener('click', () => {
    localStorage.removeItem('gh-config');
    GH = null;
    setSyncStatus('local');
    dialog.close();
  });

  function readForm() {
    const token  = document.getElementById('ghToken').value.trim();
    const owner  = document.getElementById('ghOwner').value.trim();
    const repo   = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim() || 'main';
    if (!token || !owner || !repo) return null;
    return { token, owner, repo, branch };
  }
  function showStatus(msg, type) {
    status.textContent = msg;
    status.className = 'gh-status s-' + type;
  }
}

// ─── Reference accordions ─────────────────────────────────────────────────────
function bindRefs() {
  document.querySelectorAll('.rhead').forEach(h => {
    const ref = h.closest('.ref');
    h.addEventListener('click', () => {
      const open = ref.classList.toggle('open');
      h.setAttribute('aria-expanded', open);
    });
    h.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.click(); }
    });
  });
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function bindReset() {
  document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm('Réinitialiser toute la progression ? Cette action est irréversible.')) return;
    STATE = {};
    lsSet('revision-checks', {});
    render();
    if (GH) await ghWriteProgress(STATE);
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
