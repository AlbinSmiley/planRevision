import { PLAN, EXAMS, DEADLINES, SUBJECTS } from './data.js?v=5';

/* ════════════════════════════════════════════════════════════════════════════
   MODÈLE (schema v2)
   STATE.tasks est UNE liste éditable de tâches. data.js/PLAN ne sert que de
   point de départ (seed). Chaque tâche :
     { id, date, subject, when, label, kind:'task'|'break', minutes?, at?, order, done }
   Les jours (titres, dates, examens, phases) restent fixes dans data.js.
   Les 4 vues (Aujourd'hui / Plan / Matières / Éditer) sont des regroupements
   de cette même liste → cocher où que ce soit fait avancer la même progression.
   ════════════════════════════════════════════════════════════════════════════ */

let STATE = { schema: 'v2', tasks: [], dayMeta: {} };
let GH = null, progressSha = null, saveTimer = null;
let planSelected = null;   // date ISO sélectionnée dans le calendrier

// ─── Métadonnées des jours (depuis le PLAN) ─────────────────────────────────────
const DAYS = {};            // dayId -> day
const DAYS_BY_DATE = {};    // 'YYYY-MM-DD' -> day
const DAY_ORDER = [];       // dayId dans l'ordre
const WHEN_ORDER = ['Matin', 'Après-m.', 'Soir', 'Journée'];

PLAN.forEach(item => {
  if (item.phase) return;
  DAYS[item.id] = item;
  DAY_ORDER.push(item.id);
  if (item.date) DAYS_BY_DATE[item.date] = item;
});

// ─── Helpers ────────────────────────────────────────────────────────────────────
function lsGet(key)      { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function isoToday() { const d = new Date(); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function fmtDate(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'long' }); }
function fmtDateShort(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' }); }
function daysUntil(iso) { return Math.round((new Date(iso + 'T00:00:00') - startOfToday()) / 86400000); }
function uid() { return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
function whenRank(w) { const i = WHEN_ORDER.indexOf(w); return i < 0 ? 99 : i; }
function isoLocal(d) { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
function isToday(date) { return date === isoToday(); }

// Titre d'un jour (avec éventuelle surcharge utilisateur depuis l'éditeur)
function dayTitle(item) {
  const o = STATE.dayMeta && STATE.dayMeta[item.id];
  return (o && o.title) || item.title;
}

// ─── Modèle : sélecteurs / opérations ───────────────────────────────────────────
const isCountable = t => t.kind !== 'break' && t.subject !== 'rest';

function counts(arr) {
  const real = arr.filter(isCountable);
  return { done: real.filter(t => t.done).length, total: real.length };
}
function tasksForDate(date) {
  return STATE.tasks.filter(t => t.date === date).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
function tasksForSubject(k) {
  return STATE.tasks.filter(t => t.subject === k && t.kind === 'task')
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.order ?? 0) - (b.order ?? 0));
}
function groupByWhen(arr) {
  const map = new Map();
  arr.forEach(t => { if (!map.has(t.when)) map.set(t.when, []); map.get(t.when).push(t); });
  return [...map.entries()].sort((a, b) => whenRank(a[0]) - whenRank(b[0])).map(([when, tasks]) => ({ when, tasks }));
}
function maxOrder(date) {
  return STATE.tasks.filter(t => t.date === date).reduce((m, t) => Math.max(m, t.order ?? 0), 0);
}

// ─── Migration / seed depuis le PLAN ────────────────────────────────────────────
function migrate(raw) {
  if (raw && raw.schema === 'v2' && Array.isArray(raw.tasks)) {
    if (!raw.dayMeta) raw.dayMeta = {};
    return raw;
  }

  let doneMap = {}, userTasks = [], removed = {};
  if (raw && typeof raw === 'object') {
    if (raw.tasks && !Array.isArray(raw.tasks)) doneMap = raw.tasks;
    else if (!('tasks' in raw) && !('exams' in raw) && !('userTasks' in raw)) doneMap = raw; // très ancien format plat
    if (Array.isArray(raw.userTasks)) userTasks = raw.userTasks;
    if (raw.removed) removed = raw.removed;
  }

  const tasks = [];
  let order = 0;
  PLAN.forEach(item => {
    if (item.phase) return;
    item.blocks.forEach((b, bi) => b.tasks.forEach((tk, ti) => {
      const id = `${item.id}:${bi}:${ti}`;
      if (removed[id]) return;
      tasks.push({ id, date: item.date, subject: tk.tag, when: b.when, label: tk.label, kind: 'task', order: order++, done: !!doneMap[id] });
    }));
  });
  userTasks.forEach(u => {
    const day = DAYS_BY_DATE[u.date];
    if (!day) return;
    tasks.push({ id: u.id || uid(), date: u.date, subject: u.subject, when: u.when || 'Journée', label: u.label, kind: 'task', order: order++, done: !!doneMap[u.id] });
  });
  return { schema: 'v2', tasks, dayMeta: {} };
}

// ─── Temps restant ───────────────────────────────────────────────────────────────
function remaining(datetime) {
  const ms = new Date(datetime) - Date.now();
  if (ms <= 0) return { passed: true };
  const m = Math.floor(ms / 60000);
  return { passed: false, ms, days: Math.floor(m / 1440), hours: Math.floor((m % 1440) / 60), mins: m % 60 };
}
function countdownHTML(r) {
  if (r.days >= 1)  return `${r.days}<small> j</small> ${r.hours}<small> h</small>`;
  if (r.hours >= 1) return `${r.hours}<small> h</small> ${r.mins}<small> min</small>`;
  return `${r.mins}<small> min</small>`;
}
function countdownLong(r) {
  if (r.days >= 1)  return `${r.days} j  ${r.hours} h  ${r.mins} min`;
  if (r.hours >= 1) return `${r.hours} h  ${r.mins} min`;
  return `${r.mins} min`;
}

// ─── GitHub API ───────────────────────────────────────────────────────────────
async function ghFetch(path, opts = {}) {
  if (!GH) return null;
  const url = `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${path}`;
  return fetch(url, { ...opts, headers: { Authorization: `Bearer ${GH.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) } });
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
    const body = { message: `Progression du ${new Date().toLocaleDateString('fr-CH')}`, content, branch: GH.branch || 'main', ...(progressSha ? { sha: progressSha } : {}) };
    const res = await ghFetch('progress.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res && res.ok) { progressSha = (await res.json()).content.sha; setSyncStatus('ok'); }
    else setSyncStatus('error');
  } catch { setSyncStatus('error'); }
}
function setSyncStatus(status) {
  const el = document.getElementById('syncStatus'); if (!el) return;
  el.className = 'sync-dot s-' + status;
  el.title = ({ ok: 'Synchronisé avec GitHub', saving: 'Sauvegarde en cours…', error: 'Erreur de sync', local: 'Sauvegarde locale uniquement', loading: 'Chargement…' })[status] || '';
}
function scheduleSave() {
  lsSet('revision-checks', STATE);
  setSyncStatus(GH ? 'saving' : 'local');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => { if (GH) await ghWriteProgress(STATE); else setSyncStatus('local'); }, 2500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  GH = lsGet('gh-config');
  setSyncStatus('loading');
  if (GH) {
    const remote = await ghReadProgress();
    if (remote !== null) { STATE = migrate(remote); setSyncStatus('ok'); }
    else { STATE = migrate(lsGet('revision-checks')); setSyncStatus('error'); }
  } else {
    STATE = migrate(lsGet('revision-checks')); setSyncStatus('local');
  }

  renderAll();
  bindGlobalClicks(); bindTabs(); bindSettings(); bindReset(); bindRefs(); bindTheme();
  tick(); setInterval(tick, 30000);
}

// ─── Thème clair / sombre ───────────────────────────────────────────────────────
function bindTheme() {
  const btn = document.getElementById('themeBtn'); if (!btn) return;
  btn.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === 'dark' ? '#1C1A17' : '#F7F2E9';
  });
}

function renderAll() {
  renderPlan(); renderToday(); renderSubjects(); renderEdit();
  renderSubjectProgress(); updateProgress();
}

// ─── Fragments ────────────────────────────────────────────────────────────────
const SUBJ_LABEL = Object.fromEntries(SUBJECTS.map(s => [s.k, s.label]));
const TAG_SHORT  = { alg: 'Algèbre', thermo: 'Thermo', analyse: 'Analyse', metro: 'Métro', rest: 'Repos' };

const CHEV  = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHECK = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5l2.3 2.3 4.7-4.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const XMARK = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

function whenOptionsHTML(sel) {
  return WHEN_ORDER.map(w => `<option value="${w}"${w === sel ? ' selected' : ''}>${w}</option>`).join('');
}
function dayOptionsHTML(selDate) {
  return DAY_ORDER.map(id => {
    const d = DAYS[id];
    return `<option value="${d.date}"${d.date === selDate ? ' selected' : ''}>${cap(fmtDateShort(d.date))} — ${escapeHtml(dayTitle(d))}</option>`;
  }).join('');
}

function taskHTML(t, opts = {}) {
  if (t.kind === 'break') return breakRowHTML(t, opts);
  const done = t.done ? ' done' : '';
  const del  = opts.deletable ? `<button class="tdel" type="button" data-del-task data-id="${t.id}" aria-label="Retirer">${XMARK}</button>` : '';
  const dateChip = opts.showDate && t.date ? `<span class="tdate">${cap(fmtDateShort(t.date))}</span>` : '';
  const isUser = !/^d\d+:\d+:\d+$/.test(t.id);
  return `<div class="taskrow">
    <label class="task${done}" data-task data-id="${t.id}">
      <span class="cbx" aria-hidden="true">${CHECK}</span>
      <span class="tlabel">
        ${opts.showSubjectTag ? `<span class="tag ${t.subject}">${TAG_SHORT[t.subject] || t.subject}</span>` : ''}
        ${dateChip}${escapeHtml(t.label)}${isUser ? '<span class="tuser" title="Ajouté par toi">＋</span>' : ''}
      </span>
    </label>${del}
  </div>`;
}
function breakRowHTML(t) {
  const meta = [t.at ? t.at : '', t.minutes ? `${t.minutes} min` : ''].filter(Boolean).join(' · ');
  return `<div class="breakrow"><span class="bk-ic">☕</span><span class="bk-label">${escapeHtml(t.label || 'Pause')}</span>${meta ? `<span class="bk-dur">${meta}</span>` : ''}</div>`;
}

function examFlagHTML(item) {
  const e = EXAMS.find(x => x.k === item.exam.k);
  return `<div class="exam-flag ${e.k}">
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M7.5 1.5l1.9 4 4.3.4-3.2 2.9 1 4.2-4-2.4-4 2.4 1-4.2-3.2-2.9 4.3-.4z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
    <span>${e.label}</span><span class="ftime">${e.time}</span>
  </div>`;
}

function dayCardHTML(item, opts = {}) {
  const isExam = !!item.exam;
  const dayTasks = tasksForDate(item.date);
  const { done, total } = counts(dayTasks);
  const completed = total > 0 && done === total;
  const today = isToday(item.date);
  const cls = ['day', isExam ? 'exam-day' : '', opts.open ? 'open' : '', today ? 'today-hl' : '', completed ? 'done-day' : ''].filter(Boolean).join(' ');
  const blocks = groupByWhen(dayTasks).map(g => `
    <div class="block"><span class="bwhen">${g.when}</span>
      <div class="btasks">${g.tasks.map(t => taskHTML(t, { showSubjectTag: true })).join('')}</div>
    </div>`).join('');
  return `
  <article class="${cls}" data-id="${item.id}">
    <div class="dhead">
      <div class="dnum"><span class="wd">${item.wd}</span><span class="dd">${item.d.split(' ')[0]}</span></div>
      <div class="dtitle"><div class="h">${escapeHtml(dayTitle(item))}${today ? '<span class="today-badge">aujourd’hui</span>' : ''}</div>${item.sub ? `<div class="sub">${item.sub}</div>` : ''}</div>
      <div class="dmeta"><span class="hrs">${item.h}</span><span class="dprog">${total ? `${done}/${total}` : ''}</span><span class="chev" aria-hidden="true">${CHEV}</span></div>
    </div>
    <div class="dbody">${isExam ? examFlagHTML(item) : ''}${blocks || '<div class="dempty">Aucune tâche.</div>'}</div>
  </article>`;
}

// ─── Vue : Plan (calendrier) ────────────────────────────────────────────────────
const CAL_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function dominantSubject(tasks) {
  const freq = {};
  tasks.forEach(t => { if (isCountable(t)) freq[t.subject] = (freq[t.subject] || 0) + 1; });
  return Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || null;
}

function calCellHTML(d) {
  const iso = isoLocal(d);
  const day = DAYS_BY_DATE[iso];
  if (!day) return `<div class="cal-cell empty"><span class="cal-d">${d.getDate()}</span></div>`;
  const tasks = tasksForDate(iso);
  const { done, total } = counts(tasks);
  const completed = total > 0 && done === total;
  const dom = day.exam ? day.exam.k : dominantSubject(tasks);
  const pct = total ? Math.round(done / total * 100) : 0;
  const cls = ['cal-cell', dom || '', day.exam ? 'exam' : '', completed ? 'done' : '', isToday(iso) ? 'today' : '', iso === planSelected ? 'sel' : ''].filter(Boolean).join(' ');
  return `<button class="${cls}" data-cal-date="${iso}" type="button">
    <span class="cal-top"><span class="cal-d">${d.getDate()}</span>${day.exam ? '<span class="cal-star">★</span>' : ''}</span>
    <span class="cal-mid">${completed ? '<span class="cal-chk">✓</span>' : (total ? `<span class="cal-frac">${done}/${total}</span>` : '<span class="cal-rest">·</span>')}</span>
    <span class="cal-bar"><i style="width:${pct}%"></i></span>
  </button>`;
}

function renderPlan() {
  const plan = document.getElementById('plan'); if (!plan) return;
  const dates = Object.keys(DAYS_BY_DATE).sort();
  if (!dates.length) { plan.innerHTML = ''; return; }
  if (!planSelected || !DAYS_BY_DATE[planSelected]) {
    planSelected = DAYS_BY_DATE[isoToday()] ? isoToday() : dates[0];
  }
  const first = new Date(dates[0] + 'T12:00:00');
  const last  = new Date(dates[dates.length - 1] + 'T12:00:00');
  const start = new Date(first); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end   = new Date(last);  end.setDate(end.getDate() + (6 - ((last.getDay() + 6) % 7)));

  let cells = '';
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) cells += calCellHTML(new Date(d));

  plan.innerHTML = `
    <div class="calendar">
      <div class="cal-grid cal-head">${CAL_DAYS.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid cal-body">${cells}</div>
    </div>
    <div class="cal-detail" id="calDetail"></div>`;
  renderCalDetail();
}

function renderCalDetail() {
  const c = document.getElementById('calDetail'); if (!c) return;
  const day = DAYS_BY_DATE[planSelected];
  c.innerHTML = day ? dayCardHTML(day, { open: true }) : '';
}

function refreshCalendarCells() {
  const body = document.querySelector('#plan .cal-body'); if (!body) return;
  // Reconstruit uniquement la grille (léger), garde le détail/scroll
  const dates = Object.keys(DAYS_BY_DATE).sort();
  const first = new Date(dates[0] + 'T12:00:00');
  const last  = new Date(dates[dates.length - 1] + 'T12:00:00');
  const start = new Date(first); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end   = new Date(last);  end.setDate(end.getDate() + (6 - ((last.getDay() + 6) % 7)));
  let cells = '';
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) cells += calCellHTML(new Date(d));
  body.innerHTML = cells;
}

function selectPlanDay(date) {
  if (!DAYS_BY_DATE[date]) return;
  planSelected = date;
  refreshCalendarCells();
  renderCalDetail();
  const det = document.getElementById('calDetail');
  if (det) det.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Vue : Aujourd'hui ──────────────────────────────────────────────────────────
function renderToday() {
  const c = document.getElementById('view-today'); if (!c) return;
  const iso = isoToday();
  const item = DAYS_BY_DATE[iso];
  const dateLabel = cap(new Date(iso + 'T12:00:00').toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' }));
  let html = `<div class="today-head"><p class="eyebrow">Programme du jour</p><h2 class="today-date">${dateLabel}</h2></div>`;
  html += `<div id="todayNext">${nextExamHTML()}</div>`;
  if (item) {
    const { done, total } = counts(tasksForDate(item.date));
    if (total === 0 && !item.exam) {
      html += `<div class="today-rest"><div class="tr-emoji">🌿</div><div class="tr-title">${escapeHtml(dayTitle(item))}</div><div class="tr-sub">${item.sub || 'Rien de prévu aujourd’hui.'}</div></div>`;
    } else {
      html += `<div class="today-progress">Tâches du jour : <b>${done}/${total}</b> faites${done === total && total > 0 ? ' — journée terminée ✓' : ''}</div>`;
      html += `<div class="today-card">${dayCardHTML(item, { open: true, today: true })}</div>`;
    }
  } else {
    html += `<div class="today-rest"><div class="tr-emoji">📅</div><div class="tr-title">Pas de programme aujourd’hui</div><div class="tr-sub">Le plan court du 2 au 26 juin 2026.</div></div>`;
  }
  html += deadlinesHTML();
  c.innerHTML = html;
}
function nextExamHTML() {
  const up = EXAMS.map(e => ({ e, r: remaining(e.datetime) })).filter(x => !x.r.passed).sort((a, b) => a.r.ms - b.r.ms)[0];
  if (!up) return `<div class="next-exam done"><span>🎉 Tous les examens sont passés !</span></div>`;
  const { e, r } = up;
  return `<div class="next-exam ${e.k}">
    <div class="ne-l"><span class="ne-tag">Prochain examen</span><span class="ne-name">${e.label}</span><span class="ne-date">${cap(fmtDate(e.date))} · ${e.time}</span></div>
    <div class="ne-r"><span class="ne-num">${countdownLong(r)}</span><span class="ne-unit">restant</span></div>
  </div>`;
}
function deadlinesHTML() {
  const items = DEADLINES.map(d => {
    const diff = daysUntil(d.date);
    let badge, cls = '';
    if (diff < 0) { badge = 'passée'; cls = 'past'; }
    else if (diff === 0) { badge = "aujourd’hui"; cls = 'soon'; }
    else if (diff === 1) { badge = 'demain'; cls = 'soon'; }
    else { badge = `dans ${diff} j`; }
    return `<li class="dl ${d.k} ${cls}"><span class="dl-dot"></span><span class="dl-label">${d.label}</span><span class="dl-when">${badge}</span></li>`;
  }).join('');
  return `<div class="deadlines"><h3>Échéances — cartes &amp; preuves</h3><ul>${items}</ul></div>`;
}

// ─── Vue : Par matière ──────────────────────────────────────────────────────────
function renderSubjects() {
  const c = document.getElementById('subjectChecklist'); if (!c) return;
  const today = isoToday();
  c.innerHTML = SUBJECTS.map(s => {
    const list = tasksForSubject(s.k);
    const { done, total } = counts(list);
    const items = list.map(t => taskHTML(t, { showDate: true, deletable: true })).join('');
    return `<div class="exsubj ${s.k}" data-subj="${s.k}">
      <div class="exsubj-head"><span class="exsubj-name">${s.label}</span><span class="exsubj-count">${done}/${total} faites</span></div>
      <div class="exsubj-bar"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>
      <div class="checklist">${items || '<div class="exempty">Aucune tâche pour cette matière.</div>'}</div>
      <form class="addtask" data-subj="${s.k}">
        <input type="text" class="at-label" placeholder="Nouvelle tâche pour ${s.label}…" aria-label="Intitulé" maxlength="160" required>
        <div class="at-row">
          <select class="at-day" aria-label="Pour quel jour">${dayOptionsHTML(today)}</select>
          <select class="at-when" aria-label="Moment">${whenOptionsHTML('Journée')}</select>
          <button type="submit" class="btn">+ Ajouter</button>
        </div>
      </form>
    </div>`;
  }).join('');
  c.querySelectorAll('.addtask').forEach(form => form.addEventListener('submit', e => {
    e.preventDefault();
    const subject = form.dataset.subj;
    const label = form.querySelector('.at-label').value.trim();
    const date = form.querySelector('.at-day').value;
    const when = form.querySelector('.at-when').value;
    if (!label || !date) return;
    addTask({ date, subject, when, label });
  }));
}

// ─── Vue : Éditer (organiser le plan) ───────────────────────────────────────────
function renderEdit() {
  const c = document.getElementById('view-edit'); if (!c) return;
  let html = `<div class="exams-intro"><h2>Organiser mon plan</h2>
    <p>Planifie chaque journée comme tu veux : <b>ajoute</b> des tâches ou des <b>pauses</b>,
       <b>réordonne</b> (↑ ↓), <b>déplace</b> une tâche vers un autre jour, ou supprime.
       Clique sur l'intitulé pour le modifier. Tout est connecté au reste du site.</p></div>`;
  PLAN.forEach(item => {
    if (item.phase) { html += `<h2 class="phase">${item.phase}</h2>`; return; }
    html += editDayHTML(item);
  });
  c.innerHTML = html;
  bindEdit(c);
}

function editDayHTML(item) {
  const list = tasksForDate(item.date);
  const { done, total } = counts(list);
  const completed = total > 0 && done === total;
  const rows = list.map((t, i) => editRowHTML(t, i, list.length)).join('');
  const today = isToday(item.date);
  return `<article class="day edit-day${completed ? ' done-day' : ''}${today ? ' today-hl' : ''}" data-id="${item.id}">
    <div class="dhead">
      <div class="dnum"><span class="wd">${item.wd}</span><span class="dd">${item.d.split(' ')[0]}</span></div>
      <div class="dtitle">
        <button class="h h-edit" type="button" data-edit-day-title title="Renommer la journée">${escapeHtml(dayTitle(item))} <span class="pen">✎</span></button>
        <div class="sub">${list.length} élément(s)${item.exam ? ' · examen' : ''}${today ? ' · aujourd’hui' : ''}</div>
      </div>
      <div class="dmeta"><span class="dprog">${total ? `${done}/${total}` : ''}</span><span class="chev" aria-hidden="true">${CHEV}</span></div>
    </div>
    <div class="dbody">
      <div class="erows">${rows || '<div class="dempty">Aucune tâche — ajoute-en ci-dessous.</div>'}</div>
      <form class="eadd eadd-task" data-date="${item.date}">
        <select class="ea-subj" aria-label="Matière">${SUBJECTS.map(s => `<option value="${s.k}">${s.label}</option>`).join('')}</select>
        <input type="text" class="ea-label" placeholder="Nouvelle tâche…" maxlength="160" required>
        <select class="ea-when" aria-label="Moment">${whenOptionsHTML('Matin')}</select>
        <button type="submit" class="btn">+ Tâche</button>
      </form>
      <form class="eadd eadd-break" data-date="${item.date}">
        <span class="eadd-ic">☕</span>
        <input type="text" class="eb-label" placeholder="Pause" maxlength="60">
        <input type="number" class="eb-min" placeholder="min" min="1" max="600" aria-label="Durée en minutes">
        <select class="eb-when" aria-label="Moment">${whenOptionsHTML('Après-m.')}</select>
        <button type="submit" class="btn btn-ghost">+ Pause</button>
      </form>
    </div>
  </article>`;
}

function editRowHTML(t, i, n) {
  const isBreak = t.kind === 'break';
  const tagHTML = isBreak
    ? `<span class="tag rest">☕ Pause</span>`
    : `<span class="tag ${t.subject}">${TAG_SHORT[t.subject] || t.subject}</span>`;
  const meta = isBreak && t.minutes ? `<span class="erow-min">${t.minutes} min</span>` : '';
  return `<div class="erow${isBreak ? ' is-break' : ''}${t.done ? ' done' : ''}" data-id="${t.id}">
    <div class="erow-ord">
      <button class="emini" type="button" data-move-up ${i === 0 ? 'disabled' : ''} aria-label="Monter">↑</button>
      <button class="emini" type="button" data-move-down ${i === n - 1 ? 'disabled' : ''} aria-label="Descendre">↓</button>
    </div>
    <div class="erow-main">
      <div class="erow-top">${tagHTML}${meta}</div>
      <button class="erow-label" type="button" data-edit-label>${escapeHtml(t.label)}</button>
    </div>
    <div class="erow-ctrl">
      <select class="esel" data-set-when aria-label="Moment">${whenOptionsHTML(t.when)}</select>
      <select class="esel" data-move-day aria-label="Déplacer vers">${dayOptionsHTML(t.date)}</select>
      <button class="tdel" type="button" data-del-task data-id="${t.id}" aria-label="Supprimer">${XMARK}</button>
    </div>
  </div>`;
}

function bindEdit(root) {
  root.addEventListener('click', e => {
    const titleBtn = e.target.closest('[data-edit-day-title]');
    if (titleBtn) { e.stopPropagation(); renameDay(titleBtn.closest('.day').dataset.id); return; }
    const row = e.target.closest('.erow');
    if (!row) return;
    if (e.target.closest('[data-move-up]'))   { moveTask(row.dataset.id, -1); return; }
    if (e.target.closest('[data-move-down]')) { moveTask(row.dataset.id, +1); return; }
    if (e.target.closest('[data-edit-label]')) { editLabel(row.dataset.id); return; }
  });
  root.addEventListener('change', e => {
    const row = e.target.closest('.erow'); if (!row) return;
    if (e.target.closest('[data-set-when]')) setWhen(row.dataset.id, e.target.value);
    else if (e.target.closest('[data-move-day]')) moveToDay(row.dataset.id, e.target.value);
  });
  root.querySelectorAll('.eadd-task').forEach(form => form.addEventListener('submit', e => {
    e.preventDefault();
    const label = form.querySelector('.ea-label').value.trim(); if (!label) return;
    addTask({ date: form.dataset.date, subject: form.querySelector('.ea-subj').value, when: form.querySelector('.ea-when').value, label });
  }));
  root.querySelectorAll('.eadd-break').forEach(form => form.addEventListener('submit', e => {
    e.preventDefault();
    const min = parseInt(form.querySelector('.eb-min').value, 10);
    addBreak({ date: form.dataset.date, label: form.querySelector('.eb-label').value.trim() || 'Pause', minutes: Number.isFinite(min) ? min : null, when: form.querySelector('.eb-when').value });
  }));
}

// ─── Opérations sur les tâches ──────────────────────────────────────────────────
function addTask({ date, subject, when, label }) {
  STATE.tasks.push({ id: uid(), date, subject, when: when || 'Journée', label, kind: 'task', order: maxOrder(date) + 1, done: false });
  renderAll(); scheduleSave();
}
function addBreak({ date, label, minutes, when }) {
  STATE.tasks.push({ id: uid(), date, subject: 'pause', when: when || 'Après-m.', label, kind: 'break', minutes, order: maxOrder(date) + 1, done: false });
  renderAll(); scheduleSave();
}
function editLabel(id) {
  const t = STATE.tasks.find(x => x.id === id); if (!t) return;
  const v = prompt('Modifier l’intitulé :', t.label);
  if (v !== null) { t.label = v.trim() || t.label; renderAll(); scheduleSave(); }
}
function renameDay(dayId) {
  const item = DAYS[dayId]; if (!item) return;
  const v = prompt('Nom de la journée :', dayTitle(item));
  if (v === null) return;
  STATE.dayMeta = STATE.dayMeta || {};
  const t = v.trim();
  if (!t || t === item.title) delete STATE.dayMeta[dayId];   // revient au nom d'origine
  else STATE.dayMeta[dayId] = { ...(STATE.dayMeta[dayId] || {}), title: t };
  renderAll(); scheduleSave();
}
function setWhen(id, when) {
  const t = STATE.tasks.find(x => x.id === id); if (!t) return;
  t.when = when; renderAll(); scheduleSave();
}
function moveToDay(id, date) {
  const t = STATE.tasks.find(x => x.id === id); if (!t || t.date === date) return;
  t.date = date; t.order = maxOrder(date) + 1; renderAll(); scheduleSave();
}
function moveTask(id, dir) {
  const t = STATE.tasks.find(x => x.id === id); if (!t) return;
  const sib = tasksForDate(t.date);
  const i = sib.indexOf(t), j = i + dir;
  if (j < 0 || j >= sib.length) return;
  const o = t.order; t.order = sib[j].order; sib[j].order = o;
  renderAll(); scheduleSave();
}
function removeTask(id) {
  STATE.tasks = STATE.tasks.filter(t => t.id !== id);
  renderAll(); scheduleSave();
}
function toggleTask(id) {
  const t = STATE.tasks.find(x => x.id === id); if (!t) return;
  t.done = !t.done;
  document.querySelectorAll(`[data-task][data-id="${id}"]`).forEach(l => l.classList.toggle('done', !!t.done));
  updateProgress(); renderSubjectProgress(); updateSubjectCounts(); updateDayCounts(); renderToday();
  refreshCalendarCells();
  scheduleSave();
}

// ─── Progression ────────────────────────────────────────────────────────────────
function renderSubjectProgress() {
  const c = document.getElementById('subjprog'); if (!c) return;
  c.innerHTML = SUBJECTS.map(s => {
    const { done, total } = counts(STATE.tasks.filter(t => t.subject === s.k));
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div class="sp ${s.k}"><div class="sp-top"><span class="sp-name">${s.label}</span><span class="sp-val">${done}/${total}</span></div><div class="sp-bar"><i style="width:${pct}%"></i></div></div>`;
  }).join('');
}
function updateProgress() {
  const { done, total } = counts(STATE.tasks);
  const pct = total ? Math.round(done / total * 100) : 0;
  const bar = document.getElementById('overbar'); if (bar) bar.style.width = pct + '%';
  const d = document.getElementById('donecount');  if (d) d.textContent = done;
  const tt = document.getElementById('totalcount'); if (tt) tt.textContent = total;
  const p = document.getElementById('pcttext');     if (p) p.textContent = pct + ' %';
  const ring = document.getElementById('ringfill'); if (ring) { const C = 138.2; ring.style.strokeDashoffset = C - (C * pct / 100); }
  const rt = document.getElementById('ringtxt');     if (rt) rt.textContent = pct + '%';
}
function updateDayCounts() {
  document.querySelectorAll('.day[data-id]').forEach(art => {
    const day = DAYS[art.dataset.id]; if (!day) return;
    const { done, total } = counts(tasksForDate(day.date));
    const el = art.querySelector('.dprog'); if (el) el.textContent = total ? `${done}/${total}` : '';
    art.classList.toggle('done-day', total > 0 && done === total);
  });
}
function updateSubjectCounts() {
  document.querySelectorAll('#subjectChecklist .exsubj[data-subj]').forEach(sec => {
    const { done, total } = counts(STATE.tasks.filter(t => t.subject === sec.dataset.subj));
    const cnt = sec.querySelector('.exsubj-count'); if (cnt) cnt.textContent = `${done}/${total} faites`;
    const bar = sec.querySelector('.exsubj-bar i'); if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
  });
}

// ─── Clics globaux (délégation) ─────────────────────────────────────────────────
function bindGlobalClicks() {
  document.addEventListener('click', e => {
    const cell = e.target.closest('[data-cal-date]');
    if (cell) { selectPlanDay(cell.dataset.calDate); return; }
    if (e.target.closest('.erow')) return;   // les lignes d'édition gèrent leurs propres clics
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

// ─── Tic : comptes à rebours + barrer les examens passés ────────────────────────
function tick() {
  EXAMS.forEach(e => {
    const el = document.getElementById('cd-' + e.k);
    const card = document.querySelector('.exam-card.' + e.k);
    const r = remaining(e.datetime);
    if (el) el.innerHTML = r.passed ? '<small>fait</small> ✓' : countdownHTML(r);
    if (card) card.classList.toggle('passed', r.passed);
  });
  const tn = document.getElementById('todayNext'); if (tn) tn.innerHTML = nextExamHTML();
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function bindSettings() {
  const btn = document.getElementById('settingsBtn');
  const dialog = document.getElementById('settingsDialog');
  const form = document.getElementById('ghForm');
  const status = document.getElementById('ghStatus');
  btn.addEventListener('click', () => {
    const cfg = lsGet('gh-config') || {};
    document.getElementById('ghToken').value = cfg.token || '';
    document.getElementById('ghOwner').value = cfg.owner || '';
    document.getElementById('ghRepo').value = cfg.repo || '';
    document.getElementById('ghBranch').value = cfg.branch || 'main';
    dialog.showModal();
  });
  document.getElementById('closeSettings').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  document.getElementById('testGh').addEventListener('click', async () => {
    const cfg = readForm(); if (!cfg) { showStatus('Remplis tous les champs.', 'err'); return; }
    showStatus('Test en cours…', 'wait'); GH = cfg;
    const data = await ghReadProgress(); GH = lsGet('gh-config');
    if (data !== null) showStatus('✓ Connexion OK — progression chargée.', 'ok');
    else if (progressSha === null) showStatus('✓ Connexion OK — progress.json sera créé.', 'ok');
    else showStatus('✗ Échec — vérifie le token et le nom du dépôt.', 'err');
  });
  form.addEventListener('submit', e => {
    e.preventDefault(); const cfg = readForm(); if (!cfg) return;
    lsSet('gh-config', cfg); GH = cfg; dialog.close(); setSyncStatus('saving'); ghWriteProgress(STATE);
  });
  document.getElementById('clearGh').addEventListener('click', () => { localStorage.removeItem('gh-config'); GH = null; setSyncStatus('local'); dialog.close(); });
  function readForm() {
    const token = document.getElementById('ghToken').value.trim(), owner = document.getElementById('ghOwner').value.trim(), repo = document.getElementById('ghRepo').value.trim(), branch = document.getElementById('ghBranch').value.trim() || 'main';
    if (!token || !owner || !repo) return null;
    return { token, owner, repo, branch };
  }
  function showStatus(msg, type) { status.textContent = msg; status.className = 'gh-status s-' + type; }
}

// ─── Aide-mémoire ─────────────────────────────────────────────────────────────
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
    if (!confirm('Réinitialiser TOUT le plan (tâches, pauses, cases cochées) au plan de départ ? Action irréversible.')) return;
    STATE = migrate(null);   // re-seed depuis data.js, tout décoché
    lsSet('revision-checks', STATE);
    renderAll(); tick();
    if (GH) await ghWriteProgress(STATE);
  });
}

init();
