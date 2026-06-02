import { PLAN, EXAMS, DEADLINES, EXAM_POOL, EXAM_SUBJECTS } from './data.js?v=2';

// ─── État ──────────────────────────────────────────────────────────────────────
// STATE = { tasks: { [taskId]: bool }, exams: { [subject]: [{name, done}] } }
let STATE = { tasks: {}, exams: {} };
let GH = null;        // { token, owner, repo, branch }
let progressSha = null;
let saveTimer = null;

// ─── Index précalculés sur le PLAN ──────────────────────────────────────────────
const DAYS = {};            // id -> jour
const DAYS_BY_DATE = {};    // 'YYYY-MM-DD' -> jour
const ALL_TASK_IDS = [];
const SUBJ_TASK_IDS = { alg: [], thermo: [], analyse: [], metro: [], rest: [] };

function taskId(dayId, bi, ti) { return `${dayId}:${bi}:${ti}`; }

PLAN.forEach(item => {
  if (item.phase) return;
  DAYS[item.id] = item;
  if (item.date) DAYS_BY_DATE[item.date] = item;
  item.blocks.forEach((b, bi) => b.tasks.forEach((tk, ti) => {
    const id = taskId(item.id, bi, ti);
    ALL_TASK_IDS.push(id);
    (SUBJ_TASK_IDS[tk.tag] || (SUBJ_TASK_IDS[tk.tag] = [])).push(id);
  }));
});

function allTaskIds(item) {
  return item.blocks.flatMap((b, bi) => b.tasks.map((_, ti) => taskId(item.id, bi, ti)));
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function lsGet(key)      { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

function isoToday() {
  const d = new Date();
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function fmtDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH',
    { weekday: 'short', day: 'numeric', month: 'long' });
}

function daysUntil(iso) {
  return Math.round((new Date(iso + 'T00:00:00') - startOfToday()) / 86400000);
}

// ─── Normalisation de l'état (migration ancien format plat) ─────────────────────
function normalizeState(s) {
  if (!s || typeof s !== 'object') return { tasks: {}, exams: {} };
  if ('tasks' in s || 'exams' in s) {
    return { tasks: s.tasks || {}, exams: s.exams || {} };
  }
  // Ancien format : { 'd01:0:0': true, ... } → on le met dans tasks
  return { tasks: s, exams: {} };
}

function ensureExams() {
  STATE.exams = STATE.exams || {};
  for (const k of Object.keys(EXAM_POOL)) {
    if (!Array.isArray(STATE.exams[k])) {
      STATE.exams[k] = EXAM_POOL[k].map(name => ({ name, done: false }));
    }
  }
}

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
      STATE = normalizeState(remote);
      setSyncStatus('ok');
    } else {
      STATE = normalizeState(lsGet('revision-checks'));
      setSyncStatus('error');
    }
  } else {
    STATE = normalizeState(lsGet('revision-checks'));
    setSyncStatus('local');
  }
  ensureExams();

  renderPlan();
  renderToday();
  renderSubjectProgress();
  renderExams();
  updateProgress();
  updateExamCountdowns();

  bindGlobalClicks();
  bindTabs();
  bindSettings();
  bindReset();
  bindRefs();

  setInterval(updateExamCountdowns, 60000);
}

// ─── Rendu d'un jour (réutilisé : plan + aujourd'hui) ───────────────────────────
const TAG_LABELS = { alg: 'Algèbre', thermo: 'Thermo', analyse: 'Analyse', metro: 'Métro', rest: 'Repos' };

const CHEV = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHECK = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.3 2.3 4.7-4.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function dayCardHTML(item, opts = {}) {
  const isExam = !!item.exam;
  const ids  = allTaskIds(item);
  const done = ids.filter(id => STATE.tasks[id]).length;
  const cls = [
    'day',
    isExam ? 'exam-day' : '',
    opts.open ? 'open' : '',
    opts.today ? 'is-today' : '',
  ].filter(Boolean).join(' ');

  return `
  <article class="${cls}" data-id="${item.id}">
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
        <span class="dprog">${ids.length ? `${done}/${ids.length}` : ''}</span>
        <span class="chev" aria-hidden="true">${CHEV}</span>
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
  const done = STATE.tasks[id] ? ' done' : '';
  return `<label class="task${done}" data-task data-id="${id}">
    <span class="cbx" aria-hidden="true">${CHECK}</span>
    <span class="tlabel">
      <span class="tag ${t.tag}">${TAG_LABELS[t.tag] || t.tag}</span>${t.label}
    </span>
  </label>`;
}

// ─── Rendu : Plan complet ───────────────────────────────────────────────────────
function renderPlan() {
  const plan = document.getElementById('plan');
  let html = '';
  let delay = 0;
  PLAN.forEach(item => {
    if (item.phase) {
      html += `<h2 class="phase">${item.phase}</h2>`;
    } else {
      html += `<div style="animation-delay:${Math.min(delay * 18, 320)}ms">${dayCardHTML(item)}</div>`;
      delay++;
    }
  });
  plan.innerHTML = html;
}

// ─── Rendu : Aujourd'hui ────────────────────────────────────────────────────────
function renderToday() {
  const c = document.getElementById('view-today');
  if (!c) return;

  const iso  = isoToday();
  const item = DAYS_BY_DATE[iso];
  const dateLabel = cap(new Date(iso + 'T12:00:00')
    .toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' }));

  let html = `<div class="today-head">
    <p class="eyebrow">Programme du jour</p>
    <h2 class="today-date">${dateLabel}</h2>
  </div>`;

  html += nextExamHTML();

  if (item) {
    const ids  = allTaskIds(item);
    const done = ids.filter(id => STATE.tasks[id]).length;
    const isRest = item.blocks.every(b => b.tasks.every(t => t.tag === 'rest')) || item.h === 'repos';
    if (isRest && !item.exam) {
      html += `<div class="today-rest">
        <div class="tr-emoji">🌿</div>
        <div class="tr-title">${item.title}</div>
        <div class="tr-sub">${item.sub || 'Rien de prévu aujourd’hui.'}</div>
      </div>`;
    } else {
      html += `<div class="today-progress">Tâches du jour : <b>${done}/${ids.length}</b> faites</div>`;
    }
    html += `<div class="today-card">${dayCardHTML(item, { open: true, today: true })}</div>`;
  } else {
    html += `<div class="today-rest">
      <div class="tr-emoji">📅</div>
      <div class="tr-title">Pas de programme pour aujourd’hui</div>
      <div class="tr-sub">Le plan court du 2 au 26 juin 2026. Consulte l’onglet « Plan complet ».</div>
    </div>`;
  }

  html += deadlinesHTML();

  c.innerHTML = html;
}

function nextExamHTML() {
  const upcoming = EXAMS
    .map(e => ({ e, diff: daysUntil(e.date) }))
    .filter(x => x.diff >= 0)
    .sort((a, b) => a.diff - b.diff)[0];

  if (!upcoming) {
    return `<div class="next-exam done"><span>🎉 Tous les examens sont passés !</span></div>`;
  }
  const { e, diff } = upcoming;
  const big   = diff === 0 ? "AUJ." : diff;
  const small = diff === 0 ? "c’est le jour J" : diff === 1 ? 'jour' : 'jours';
  return `<div class="next-exam ${e.k}">
    <div class="ne-l">
      <span class="ne-tag">Prochain examen</span>
      <span class="ne-name">${e.label}</span>
      <span class="ne-date">${cap(fmtDate(e.date))} · ${e.time}</span>
    </div>
    <div class="ne-r"><span class="ne-num">${big}</span><span class="ne-unit">${small}</span></div>
  </div>`;
}

function deadlinesHTML() {
  const items = DEADLINES.map(d => {
    const diff = daysUntil(d.date);
    let badge, cls = '';
    if (diff < 0)       { badge = 'passée'; cls = 'past'; }
    else if (diff === 0){ badge = "aujourd’hui"; cls = 'soon'; }
    else if (diff === 1){ badge = 'demain'; cls = 'soon'; }
    else                { badge = `dans ${diff} j`; }
    return `<li class="dl ${d.k} ${cls}">
      <span class="dl-dot"></span>
      <span class="dl-label">${d.label}</span>
      <span class="dl-when">${badge}</span>
    </li>`;
  }).join('');
  return `<div class="deadlines">
    <h3>Échéances — cartes &amp; preuves</h3>
    <ul>${items}</ul>
  </div>`;
}

// ─── Rendu : progression par matière ────────────────────────────────────────────
const SUBJ_META = [
  { k: 'alg',     label: 'Algèbre' },
  { k: 'thermo',  label: 'Thermo' },
  { k: 'analyse', label: 'Analyse' },
  { k: 'metro',   label: 'Métrologie' },
];

function renderSubjectProgress() {
  const c = document.getElementById('subjprog');
  if (!c) return;
  c.innerHTML = SUBJ_META.map(s => {
    const ids  = SUBJ_TASK_IDS[s.k] || [];
    const done = ids.filter(id => STATE.tasks[id]).length;
    const pct  = ids.length ? Math.round(done / ids.length * 100) : 0;
    return `<div class="sp ${s.k}">
      <div class="sp-top">
        <span class="sp-name">${s.label}</span>
        <span class="sp-val">${done}/${ids.length}</span>
      </div>
      <div class="sp-bar"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('');
}

// ─── Rendu : tracker d'examens ──────────────────────────────────────────────────
function renderExams() {
  const c = document.getElementById('examTracker');
  if (!c) return;

  let totalDone = 0, totalAll = 0, html = '';

  EXAM_SUBJECTS.forEach(s => {
    const list = STATE.exams[s.k] || [];
    const done = list.filter(e => e.done).length;
    totalDone += done; totalAll += list.length;

    const items = list.map((e, i) => `
      <div class="exitem${e.done ? ' done' : ''}" data-subj="${s.k}" data-i="${i}">
        <label class="exchk" data-ex-toggle>
          <span class="cbx" aria-hidden="true">${CHECK}</span>
          <span class="exname">${escapeHtml(e.name)}</span>
        </label>
        <button class="exdel" type="button" data-ex-del aria-label="Retirer cet examen">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>`).join('');

    html += `<div class="exsubj ${s.k}">
      <div class="exsubj-head">
        <span class="exsubj-name">${s.label}</span>
        <span class="exsubj-count">${done}/${list.length} faits</span>
      </div>
      <div class="exlist">${items || '<div class="exempty">Aucun examen dans la liste.</div>'}</div>
      <form class="exadd" data-subj="${s.k}">
        <input type="text" placeholder="Ajouter un examen (ex. 2018, rattrapage…)" aria-label="Nouvel examen" maxlength="40">
        <button type="submit" class="btn">+ Ajouter</button>
      </form>
    </div>`;
  });

  c.innerHTML = `<div class="ex-summary"><b>${totalDone}</b> examen(s) fait(s) sur <b>${totalAll}</b></div>` + html;
  bindExams(c);
}

function bindExams(root) {
  root.querySelectorAll('[data-ex-toggle]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const item = el.closest('.exitem');
      const { subj, i } = item.dataset;
      const ex = STATE.exams[subj]?.[+i];
      if (!ex) return;
      ex.done = !ex.done;
      renderExams();
      scheduleSave();
    });
  });
  root.querySelectorAll('[data-ex-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.exitem');
      const { subj, i } = item.dataset;
      if (!STATE.exams[subj]) return;
      STATE.exams[subj].splice(+i, 1);
      renderExams();
      scheduleSave();
    });
  });
  root.querySelectorAll('.exadd').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const subj  = form.dataset.subj;
      const input = form.querySelector('input');
      const name  = input.value.trim();
      if (!name) return;
      (STATE.exams[subj] || (STATE.exams[subj] = [])).push({ name, done: false });
      input.value = '';
      renderExams();
      scheduleSave();
    });
  });
}

// ─── Progression globale ────────────────────────────────────────────────────────
function updateProgress() {
  const total = ALL_TASK_IDS.length;
  const done  = ALL_TASK_IDS.filter(id => STATE.tasks[id]).length;
  const pct   = total ? Math.round(done / total * 100) : 0;

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
    const C = 138.2;
    ring.style.strokeDashoffset = C - (C * pct / 100);
  }
  const ringtxt = document.getElementById('ringtxt');
  if (ringtxt) ringtxt.textContent = pct + '%';
}

function updateDayCounts() {
  document.querySelectorAll('.day[data-id]').forEach(art => {
    const item = DAYS[art.dataset.id];
    if (!item) return;
    const ids  = allTaskIds(item);
    const done = ids.filter(id => STATE.tasks[id]).length;
    const el   = art.querySelector('.dprog');
    if (el) el.textContent = ids.length ? `${done}/${ids.length}` : '';
  });
}

// ─── Toggle d'une tâche (dans n'importe quelle vue) ─────────────────────────────
function toggleTask(id) {
  STATE.tasks[id] = !STATE.tasks[id];
  document.querySelectorAll(`[data-task][data-id="${id}"]`)
    .forEach(l => l.classList.toggle('done', !!STATE.tasks[id]));
  updateProgress();
  renderSubjectProgress();
  updateDayCounts();
  // garder la vue « Aujourd'hui » à jour (sa barre de progression du jour)
  const todayProg = document.querySelector('.today-progress');
  if (todayProg) renderToday();
  scheduleSave();
}

// ─── Clics globaux (délégation : tâches + repli des jours) ──────────────────────
function bindGlobalClicks() {
  document.addEventListener('click', e => {
    const task = e.target.closest('[data-task]');
    if (task) { e.preventDefault(); toggleTask(task.dataset.id); return; }

    const dhead = e.target.closest('.dhead');
    if (dhead) { dhead.closest('article').classList.toggle('open'); }
  });
}

// ─── Onglets ────────────────────────────────────────────────────────────────────
function bindTabs() {
  const tabs  = document.querySelectorAll('.tab');
  const views = document.querySelectorAll('.view');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(x => x.classList.toggle('active', x === tab));
      const id = 'view-' + tab.dataset.tab;
      views.forEach(v => v.classList.toggle('active', v.id === id));
      if (tab.dataset.tab === 'today') renderToday();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ─── Comptes à rebours ──────────────────────────────────────────────────────────
function updateExamCountdowns() {
  EXAMS.forEach(e => {
    const el = document.getElementById('cd-' + e.k);
    if (!el) return;
    const diff = daysUntil(e.date);
    if (diff > 1)        el.innerHTML = `${diff}<small> j</small>`;
    else if (diff === 1) el.textContent = 'demain';
    else if (diff === 0) el.textContent = 'auj.';
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
    if (!confirm('Réinitialiser toute la progression (tâches ET examens faits) ? Cette action est irréversible.')) return;
    STATE = { tasks: {}, exams: {} };
    ensureExams();
    lsSet('revision-checks', STATE);
    renderPlan();
    renderToday();
    renderSubjectProgress();
    renderExams();
    updateProgress();
    if (GH) await ghWriteProgress(STATE);
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
