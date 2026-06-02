import { PLAN, EXAMS, DEADLINES, SUBJECTS } from './data.js?v=3';

/* ════════════════════════════════════════════════════════════════════════════
   MODÈLE
   Tout est UNE liste de tâches. Chaque tâche a : id, dayId, date, subject,
   when, label, builtin. Le PLAN (data.js) fournit les tâches « builtin » ;
   l'utilisateur peut en ajouter (STATE.userTasks) ou en masquer (STATE.removed).
   Les trois vues (Aujourd'hui / Plan / Par matière) ne sont que des regroupements
   de cette même liste → cocher où que ce soit fait avancer la même progression.
   ════════════════════════════════════════════════════════════════════════════ */

let STATE = { tasks: {}, userTasks: [], removed: {} };
let GH = null;
let progressSha = null;
let saveTimer = null;
let TASKS = [];   // liste unifiée, reconstruite à chaque changement structurel

// ─── Métadonnées des jours (depuis le PLAN) ─────────────────────────────────────
const DAYS = {};            // dayId -> { id, wd, d, date, h, title, sub, exam }
const DAYS_BY_DATE = {};    // 'YYYY-MM-DD' -> day
const DAY_ORDER = [];       // dayId dans l'ordre du plan
const WHEN_ORDER = ['Matin', 'Après-m.', 'Soir', 'Journée'];

PLAN.forEach(item => {
  if (item.phase) return;
  DAYS[item.id] = item;
  DAY_ORDER.push(item.id);
  if (item.date) DAYS_BY_DATE[item.date] = item;
});

// ─── Construction de la liste unifiée ───────────────────────────────────────────
function buildTasks() {
  const list = [];
  PLAN.forEach(item => {
    if (item.phase) return;
    item.blocks.forEach((b, bi) => b.tasks.forEach((tk, ti) => {
      const id = `${item.id}:${bi}:${ti}`;
      if (STATE.removed[id]) return;
      list.push({ id, dayId: item.id, date: item.date, subject: tk.tag, when: b.when, label: tk.label, builtin: true });
    }));
  });
  (STATE.userTasks || []).forEach(u => {
    const day = DAYS_BY_DATE[u.date];
    list.push({ id: u.id, dayId: day ? day.id : null, date: u.date, subject: u.subject, when: u.when || 'Journée', label: u.label, builtin: false });
  });
  TASKS = list;
}

// Une tâche « comptable » (exclut les rappels de repos)
function counts(taskArr) {
  const real = taskArr.filter(t => t.subject !== 'rest');
  const done = real.filter(t => STATE.tasks[t.id]).length;
  return { done, total: real.length };
}

function tasksForDay(dayId)   { return TASKS.filter(t => t.dayId === dayId); }
function tasksForDate(date)   { return TASKS.filter(t => t.date === date); }
function tasksForSubject(k)   {
  return TASKS.filter(t => t.subject === k)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '')
      || whenRank(a.when) - whenRank(b.when));
}
function whenRank(w) { const i = WHEN_ORDER.indexOf(w); return i < 0 ? 99 : i; }

// Regroupe des tâches par moment de la journée, dans l'ordre WHEN_ORDER
function groupByWhen(taskArr) {
  const map = new Map();
  taskArr.forEach(t => { if (!map.has(t.when)) map.set(t.when, []); map.get(t.when).push(t); });
  return [...map.entries()]
    .sort((a, b) => whenRank(a[0]) - whenRank(b[0]))
    .map(([when, tasks]) => ({ when, tasks }));
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
  const d = new Date(); const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function fmtDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'long' });
}
function fmtDateShort(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
}
function daysUntil(iso) { return Math.round((new Date(iso + 'T00:00:00') - startOfToday()) / 86400000); }
function uid() { return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }

// Temps restant exact avant un datetime
function remaining(datetime) {
  const ms = new Date(datetime) - Date.now();
  if (ms <= 0) return { passed: true };
  const totalMin = Math.floor(ms / 60000);
  return {
    passed: false, ms,
    days:  Math.floor(totalMin / 1440),
    hours: Math.floor((totalMin % 1440) / 60),
    mins:  totalMin % 60,
  };
}
// Compte à rebours compact pour les cartes : "13 j 2 h" / "5 h 23 min" / "12 min"
function countdownHTML(r) {
  if (r.days >= 1)  return `${r.days}<small> j</small> ${r.hours}<small> h</small>`;
  if (r.hours >= 1) return `${r.hours}<small> h</small> ${r.mins}<small> min</small>`;
  return `${r.mins}<small> min</small>`;
}
// Version verbeuse pour le bandeau « prochain examen »
function countdownLong(r) {
  if (r.days >= 1)  return `${r.days} j  ${r.hours} h  ${r.mins} min`;
  if (r.hours >= 1) return `${r.hours} h  ${r.mins} min`;
  return `${r.mins} min`;
}

// ─── Normalisation de l'état (migration des anciens formats) ────────────────────
function normalizeState(s) {
  const base = { tasks: {}, userTasks: [], removed: {} };
  if (!s || typeof s !== 'object') return base;
  if ('tasks' in s || 'userTasks' in s || 'removed' in s || 'exams' in s) {
    return {
      tasks: s.tasks || {},
      userTasks: Array.isArray(s.userTasks) ? s.userTasks : [],
      removed: s.removed || {},
    };
  }
  // Ancien format plat { 'd01:0:0': true } → tasks
  return { tasks: s, userTasks: [], removed: {} };
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
    if (res && res.ok) { progressSha = (await res.json()).content.sha; setSyncStatus('ok'); }
    else setSyncStatus('error');
  } catch { setSyncStatus('error'); }
}

// ─── Sync status ────────────────────────────────────────────────────────────────
function setSyncStatus(status) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.className = 'sync-dot s-' + status;
  const titles = { ok: 'Synchronisé avec GitHub', saving: 'Sauvegarde en cours…', error: 'Erreur de sync', local: 'Sauvegarde locale uniquement', loading: 'Chargement…' };
  el.title = titles[status] || '';
}
function scheduleSave() {
  lsSet('revision-checks', STATE);
  setSyncStatus(GH ? 'saving' : 'local');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (GH) await ghWriteProgress(STATE); else setSyncStatus('local');
  }, 2500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  GH = lsGet('gh-config');
  setSyncStatus('loading');

  if (GH) {
    const remote = await ghReadProgress();
    if (remote !== null) { STATE = normalizeState(remote); setSyncStatus('ok'); }
    else { STATE = normalizeState(lsGet('revision-checks')); setSyncStatus('error'); }
  } else {
    STATE = normalizeState(lsGet('revision-checks')); setSyncStatus('local');
  }

  buildTasks();
  renderAll();

  bindGlobalClicks();
  bindTabs();
  bindSettings();
  bindReset();
  bindRefs();

  tick();
  setInterval(tick, 30000);
}

// Rendu complet (après changement structurel)
function renderAll() {
  renderPlan();
  renderToday();
  renderSubjects();
  renderSubjectProgress();
  updateProgress();
}

// ─── Fragments réutilisables ────────────────────────────────────────────────────
const SUBJ_LABEL = Object.fromEntries(SUBJECTS.map(s => [s.k, s.label]));
const TAG_LABELS = { ...SUBJ_LABEL, rest: 'Repos' };
const TAG_SHORT  = { alg: 'Algèbre', thermo: 'Thermo', analyse: 'Analyse', metro: 'Métro', rest: 'Repos' };

const CHEV  = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHECK = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.3 2.3 4.7-4.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const XMARK = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

function taskHTML(t, opts = {}) {
  const done = STATE.tasks[t.id] ? ' done' : '';
  const del  = opts.deletable ? `<button class="tdel" type="button" data-del-task data-id="${t.id}" aria-label="Retirer">${XMARK}</button>` : '';
  const dateChip = opts.showDate && t.date
    ? `<span class="tdate">${cap(fmtDateShort(t.date))}</span>` : '';
  return `<div class="taskrow">
    <label class="task${done}" data-task data-id="${t.id}">
      <span class="cbx" aria-hidden="true">${CHECK}</span>
      <span class="tlabel">
        ${opts.showSubjectTag ? `<span class="tag ${t.subject}">${TAG_SHORT[t.subject] || t.subject}</span>` : ''}
        ${dateChip}${escapeHtml(t.label)}
        ${!t.builtin ? '<span class="tuser" title="Ajouté par toi">＋</span>' : ''}
      </span>
    </label>${del}
  </div>`;
}

function examFlagHTML(item) {
  const e = EXAMS.find(x => x.k === item.exam.k);
  return `<div class="exam-flag ${e.k}">
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5l1.9 4 4.3.4-3.2 2.9 1 4.2-4-2.4-4 2.4 1-4.2-3.2-2.9 4.3-.4z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>
    <span>${e.label}</span><span class="ftime">${e.time}</span>
  </div>`;
}

function dayCardHTML(item, opts = {}) {
  const isExam = !!item.exam;
  const dayTasks = tasksForDay(item.id);
  const { done, total } = counts(dayTasks);
  const cls = ['day', isExam ? 'exam-day' : '', opts.open ? 'open' : '', opts.today ? 'is-today' : ''].filter(Boolean).join(' ');
  const blocks = groupByWhen(dayTasks).map(g => `
    <div class="block">
      <span class="bwhen">${g.when}</span>
      <div class="btasks">${g.tasks.map(t => taskHTML(t, { showSubjectTag: true })).join('')}</div>
    </div>`).join('');

  return `
  <article class="${cls}" data-id="${item.id}">
    <div class="dhead">
      <div class="dnum"><span class="wd">${item.wd}</span><span class="dd">${item.d.split(' ')[0]}</span></div>
      <div class="dtitle"><div class="h">${item.title}</div>${item.sub ? `<div class="sub">${item.sub}</div>` : ''}</div>
      <div class="dmeta">
        <span class="hrs">${item.h}</span>
        <span class="dprog">${total ? `${done}/${total}` : ''}</span>
        <span class="chev" aria-hidden="true">${CHEV}</span>
      </div>
    </div>
    <div class="dbody">
      ${isExam ? examFlagHTML(item) : ''}
      ${blocks || '<div class="dempty">Aucune tâche.</div>'}
    </div>
  </article>`;
}

// ─── Vue : Plan complet ─────────────────────────────────────────────────────────
function renderPlan() {
  const plan = document.getElementById('plan');
  if (!plan) return;
  let html = '', delay = 0;
  PLAN.forEach(item => {
    if (item.phase) { html += `<h2 class="phase">${item.phase}</h2>`; }
    else {
      html += `<div style="animation-delay:${Math.min(delay * 18, 320)}ms">${dayCardHTML(item)}</div>`;
      delay++;
    }
  });
  plan.innerHTML = html;
}

// ─── Vue : Aujourd'hui ──────────────────────────────────────────────────────────
function renderToday() {
  const c = document.getElementById('view-today');
  if (!c) return;
  const iso = isoToday();
  const item = DAYS_BY_DATE[iso];
  const dateLabel = cap(new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' }));

  let html = `<div class="today-head"><p class="eyebrow">Programme du jour</p><h2 class="today-date">${dateLabel}</h2></div>`;
  html += `<div id="todayNext">${nextExamHTML()}</div>`;

  if (item) {
    const dayTasks = tasksForDay(item.id);
    const { done, total } = counts(dayTasks);
    const isRest = total === 0 && !item.exam;
    if (isRest) {
      html += `<div class="today-rest"><div class="tr-emoji">🌿</div><div class="tr-title">${item.title}</div><div class="tr-sub">${item.sub || 'Rien de prévu aujourd’hui.'}</div></div>`;
    } else {
      html += `<div class="today-progress">Tâches du jour : <b>${done}/${total}</b> faites</div>`;
      html += `<div class="today-card">${dayCardHTML(item, { open: true, today: true })}</div>`;
    }
  } else {
    html += `<div class="today-rest"><div class="tr-emoji">📅</div><div class="tr-title">Pas de programme aujourd’hui</div><div class="tr-sub">Le plan court du 2 au 26 juin 2026. Voir « Plan complet ».</div></div>`;
  }
  html += deadlinesHTML();
  c.innerHTML = html;
}

function nextExamHTML() {
  const up = EXAMS.map(e => ({ e, r: remaining(e.datetime) }))
    .filter(x => !x.r.passed)
    .sort((a, b) => a.r.ms - b.r.ms)[0];
  if (!up) return `<div class="next-exam done"><span>🎉 Tous les examens sont passés !</span></div>`;
  const { e, r } = up;
  return `<div class="next-exam ${e.k}">
    <div class="ne-l">
      <span class="ne-tag">Prochain examen</span>
      <span class="ne-name">${e.label}</span>
      <span class="ne-date">${cap(fmtDate(e.date))} · ${e.time}</span>
    </div>
    <div class="ne-r"><span class="ne-num">${countdownLong(r)}</span><span class="ne-unit">restant</span></div>
  </div>`;
}

function deadlinesHTML() {
  const items = DEADLINES.map(d => {
    const diff = daysUntil(d.date);
    let badge, cls = '';
    if (diff < 0)        { badge = 'passée'; cls = 'past'; }
    else if (diff === 0) { badge = "aujourd’hui"; cls = 'soon'; }
    else if (diff === 1) { badge = 'demain'; cls = 'soon'; }
    else                 { badge = `dans ${diff} j`; }
    return `<li class="dl ${d.k} ${cls}"><span class="dl-dot"></span><span class="dl-label">${d.label}</span><span class="dl-when">${badge}</span></li>`;
  }).join('');
  return `<div class="deadlines"><h3>Échéances — cartes &amp; preuves</h3><ul>${items}</ul></div>`;
}

// ─── Vue : Par matière (checklist générale, connectée au plan) ──────────────────
function dayOptionsHTML(selectedDate) {
  return DAY_ORDER.map(id => {
    const d = DAYS[id];
    const sel = d.date === selectedDate ? ' selected' : '';
    return `<option value="${d.date}"${sel}>${cap(fmtDateShort(d.date))} — ${d.title.replace(/"/g, '')}</option>`;
  }).join('');
}

function renderSubjects() {
  const c = document.getElementById('subjectChecklist');
  if (!c) return;
  const today = isoToday();
  let html = '';

  SUBJECTS.forEach(s => {
    const list = tasksForSubject(s.k);
    const { done, total } = counts(list);
    const items = list.map(t => taskHTML(t, { showDate: true, deletable: true })).join('');
    html += `<div class="exsubj ${s.k}" data-subj="${s.k}">
      <div class="exsubj-head">
        <span class="exsubj-name">${s.label}</span>
        <span class="exsubj-count">${done}/${total} faites</span>
      </div>
      <div class="exsubj-bar"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>
      <div class="checklist">${items || '<div class="exempty">Aucune tâche pour cette matière.</div>'}</div>
      <form class="addtask" data-subj="${s.k}">
        <input type="text" class="at-label" placeholder="Nouvelle tâche pour ${s.label}…" aria-label="Intitulé" maxlength="120" required>
        <div class="at-row">
          <select class="at-day" aria-label="Pour quel jour">${dayOptionsHTML(today)}</select>
          <select class="at-when" aria-label="Moment">
            <option value="Matin">Matin</option>
            <option value="Après-m.">Après-m.</option>
            <option value="Soir">Soir</option>
            <option value="Journée" selected>Journée</option>
          </select>
          <button type="submit" class="btn">+ Ajouter</button>
        </div>
      </form>
    </div>`;
  });
  c.innerHTML = html;
  bindAddForms(c);
}

function bindAddForms(root) {
  root.querySelectorAll('.addtask').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const subject = form.dataset.subj;
      const label = form.querySelector('.at-label').value.trim();
      const date  = form.querySelector('.at-day').value;
      const when  = form.querySelector('.at-when').value;
      if (!label || !date) return;
      STATE.userTasks.push({ id: uid(), date, subject, when, label });
      buildTasks();
      renderAll();
      scheduleSave();
    });
  });
}

// ─── Progression par matière (vue Plan) ─────────────────────────────────────────
function renderSubjectProgress() {
  const c = document.getElementById('subjprog');
  if (!c) return;
  c.innerHTML = SUBJECTS.map(s => {
    const { done, total } = counts(TASKS.filter(t => t.subject === s.k));
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div class="sp ${s.k}">
      <div class="sp-top"><span class="sp-name">${s.label}</span><span class="sp-val">${done}/${total}</span></div>
      <div class="sp-bar"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('');
}

// ─── Progression globale ────────────────────────────────────────────────────────
function updateProgress() {
  const { done, total } = counts(TASKS);
  const pct = total ? Math.round(done / total * 100) : 0;
  const bar = document.getElementById('overbar'); if (bar) bar.style.width = pct + '%';
  const d = document.getElementById('donecount');  if (d) d.textContent = done;
  const tt = document.getElementById('totalcount'); if (tt) tt.textContent = total;
  const p = document.getElementById('pcttext');     if (p) p.textContent = pct + ' %';
  const ring = document.getElementById('ringfill');
  if (ring) { const C = 138.2; ring.style.strokeDashoffset = C - (C * pct / 100); }
  const rt = document.getElementById('ringtxt');     if (rt) rt.textContent = pct + '%';
}

function updateDayCounts() {
  document.querySelectorAll('.day[data-id]').forEach(art => {
    const id = art.dataset.id;
    if (!DAYS[id]) return;
    const { done, total } = counts(tasksForDay(id));
    const el = art.querySelector('.dprog');
    if (el) el.textContent = total ? `${done}/${total}` : '';
  });
}

// Met à jour compteurs/barres de la vue « Par matière » sans re-rendre
// (évite d'effacer ce qui est tapé dans un formulaire d'ajout)
function updateSubjectCounts() {
  document.querySelectorAll('#subjectChecklist .exsubj[data-subj]').forEach(sec => {
    const { done, total } = counts(TASKS.filter(t => t.subject === sec.dataset.subj));
    const cnt = sec.querySelector('.exsubj-count'); if (cnt) cnt.textContent = `${done}/${total} faites`;
    const bar = sec.querySelector('.exsubj-bar i'); if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  });
}

// ─── Toggle d'une tâche (toutes vues) ───────────────────────────────────────────
function toggleTask(id) {
  STATE.tasks[id] = !STATE.tasks[id];
  document.querySelectorAll(`[data-task][data-id="${id}"]`).forEach(l => l.classList.toggle('done', !!STATE.tasks[id]));
  updateProgress();
  renderSubjectProgress();
  updateSubjectCounts();     // compteurs/barres par matière (sans re-rendu complet)
  updateDayCounts();
  const tp = document.querySelector('.today-progress'); if (tp) renderToday();
  scheduleSave();
}

function removeTask(id) {
  const t = TASKS.find(x => x.id === id);
  if (!t) return;
  if (t.builtin) STATE.removed[id] = true;
  else STATE.userTasks = STATE.userTasks.filter(u => u.id !== id);
  delete STATE.tasks[id];
  buildTasks();
  renderAll();
  scheduleSave();
}

// ─── Clics globaux (délégation) ─────────────────────────────────────────────────
function bindGlobalClicks() {
  document.addEventListener('click', e => {
    const del = e.target.closest('[data-del-task]');
    if (del) { e.preventDefault(); removeTask(del.dataset.id); return; }
    const task = e.target.closest('[data-task]');
    if (task) { e.preventDefault(); toggleTask(task.dataset.id); return; }
    const dhead = e.target.closest('.dhead');
    if (dhead) dhead.closest('article').classList.toggle('open');
  });
}

// ─── Onglets ────────────────────────────────────────────────────────────────────
function bindTabs() {
  const tabs = document.querySelectorAll('.tab');
  const views = document.querySelectorAll('.view');
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(x => x.classList.toggle('active', x === tab));
    const id = 'view-' + tab.dataset.tab;
    views.forEach(v => v.classList.toggle('active', v.id === id));
    if (tab.dataset.tab === 'today') renderToday();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}

// ─── Tic d'horloge : comptes à rebours + barrer les examens passés ──────────────
function tick() {
  EXAMS.forEach(e => {
    const el = document.getElementById('cd-' + e.k);
    const card = document.querySelector('.exam-card.' + e.k);
    const r = remaining(e.datetime);
    if (el) el.innerHTML = r.passed ? '<small>fait</small> ✓' : countdownHTML(r);
    if (card) card.classList.toggle('passed', r.passed);
  });
  const tn = document.getElementById('todayNext');
  if (tn) tn.innerHTML = nextExamHTML();
}

// ─── Settings dialog ─────────────────────────────────────────────────────────
function bindSettings() {
  const btn = document.getElementById('settingsBtn');
  const dialog = document.getElementById('settingsDialog');
  const form = document.getElementById('ghForm');
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
    lsSet('gh-config', cfg); GH = cfg; dialog.close();
    setSyncStatus('saving'); ghWriteProgress(STATE);
  });

  document.getElementById('clearGh').addEventListener('click', () => {
    localStorage.removeItem('gh-config'); GH = null; setSyncStatus('local'); dialog.close();
  });

  function readForm() {
    const token = document.getElementById('ghToken').value.trim();
    const owner = document.getElementById('ghOwner').value.trim();
    const repo  = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim() || 'main';
    if (!token || !owner || !repo) return null;
    return { token, owner, repo, branch };
  }
  function showStatus(msg, type) { status.textContent = msg; status.className = 'gh-status s-' + type; }
}

// ─── Accordéons aide-mémoire ─────────────────────────────────────────────────────
function bindRefs() {
  document.querySelectorAll('.rhead').forEach(h => {
    const ref = h.closest('.ref');
    h.addEventListener('click', () => { const open = ref.classList.toggle('open'); h.setAttribute('aria-expanded', open); });
    h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.click(); } });
  });
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function bindReset() {
  document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm('Réinitialiser toute la progression (cases cochées + tâches ajoutées) ? Action irréversible.')) return;
    STATE = { tasks: {}, userTasks: [], removed: {} };
    lsSet('revision-checks', STATE);
    buildTasks(); renderAll(); tick();
    if (GH) await ghWriteProgress(STATE);
  });
}

init();
