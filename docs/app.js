const STORAGE_KEY = 'habit-reset-web-v1';

const state = {
  data: {
    userName: 'Sam',
    trackingStartDate: todayKey(),
    reports: [],
  },
  settings: {
    githubOwner: 'sammysagala190-web',
    githubRepo: 'habit-reset-app',
    githubBranch: 'main',
    githubPath: 'data/habit-data.json',
    githubToken: '',
  },
  editingId: null,
  remoteSha: null,
};

const el = {
  saveAllBtn: document.getElementById('saveAllBtn'),
  currentStreak: document.getElementById('currentStreak'),
  longestStreak: document.getElementById('longestStreak'),
  reportCount: document.getElementById('reportCount'),
  lastRelapse: document.getElementById('lastRelapse'),
  userName: document.getElementById('userName'),
  trackingStartDate: document.getElementById('trackingStartDate'),
  formTitle: document.getElementById('formTitle'),
  reportDate: document.getElementById('reportDate'),
  reportTrigger: document.getElementById('reportTrigger'),
  reportNotes: document.getElementById('reportNotes'),
  saveReportBtn: document.getElementById('saveReportBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  monthLabel: document.getElementById('monthLabel'),
  calendar: document.getElementById('calendar'),
  reportList: document.getElementById('reportList'),
  githubOwner: document.getElementById('githubOwner'),
  githubRepo: document.getElementById('githubRepo'),
  githubBranch: document.getElementById('githubBranch'),
  githubPath: document.getElementById('githubPath'),
  githubToken: document.getElementById('githubToken'),
  loadGithubBtn: document.getElementById('loadGithubBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  status: document.getElementById('status'),
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function fromDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toPrettyDate(key) {
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isValidDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysBetween(startKey, endKey) {
  const start = startOfDay(fromDateKey(startKey));
  const end = startOfDay(fromDateKey(endKey));
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function uniqueSortedReportDates() {
  return [...new Set(state.data.reports.map((report) => report.date))].sort();
}

function sortedReports() {
  return [...state.data.reports].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

function computeCurrentStreak() {
  const dates = uniqueSortedReportDates();
  const today = todayKey();
  if (dates.length === 0) return Math.max(1, daysBetween(state.data.trackingStartDate, today) + 1);
  return Math.max(0, daysBetween(dates[dates.length - 1], today));
}

function computeLongestGap() {
  const today = todayKey();
  const dates = uniqueSortedReportDates();
  if (dates.length === 0) return Math.max(1, daysBetween(state.data.trackingStartDate, today) + 1);

  let best = Math.max(0, daysBetween(state.data.trackingStartDate, dates[0]));
  for (let i = 1; i < dates.length; i += 1) {
    best = Math.max(best, Math.max(0, daysBetween(dates[i - 1], dates[i]) - 1));
  }
  best = Math.max(best, Math.max(0, daysBetween(dates[dates.length - 1], today)));
  return best;
}

function getLastRelapseDate() {
  const dates = uniqueSortedReportDates();
  return dates.length ? dates[dates.length - 1] : null;
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    data: state.data,
    settings: state.settings,
  }));
}

function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.data) {
      state.data.userName = parsed.data.userName || 'Sam';
      state.data.trackingStartDate = parsed.data.trackingStartDate || todayKey();
      state.data.reports = Array.isArray(parsed.data.reports) ? parsed.data.reports : [];
    }
    if (parsed.settings) {
      state.settings.githubOwner = parsed.settings.githubOwner || 'sammysagala190-web';
      state.settings.githubRepo = parsed.settings.githubRepo || 'habit-reset-app';
      state.settings.githubBranch = parsed.settings.githubBranch || 'main';
      state.settings.githubPath = parsed.settings.githubPath || 'data/habit-data.json';
      state.settings.githubToken = parsed.settings.githubToken || '';
    }
  } catch {
    setStatus('Could not read saved local data.');
  }
}

function setStatus(message) {
  el.status.textContent = message;
}

function syncInputsFromState() {
  el.userName.value = state.data.userName;
  el.trackingStartDate.value = state.data.trackingStartDate;
  el.reportDate.value = todayKey();
  el.githubOwner.value = state.settings.githubOwner;
  el.githubRepo.value = state.settings.githubRepo;
  el.githubBranch.value = state.settings.githubBranch;
  el.githubPath.value = state.settings.githubPath;
  el.githubToken.value = state.settings.githubToken;
}

function resetForm() {
  state.editingId = null;
  el.formTitle.textContent = 'Add relapse report';
  el.reportDate.value = todayKey();
  el.reportTrigger.value = '';
  el.reportNotes.value = '';
  el.cancelEditBtn.classList.add('hidden');
}

function startEdit(id) {
  const report = state.data.reports.find((item) => item.id === id);
  if (!report) return;
  state.editingId = id;
  el.formTitle.textContent = 'Edit relapse report';
  el.reportDate.value = report.date;
  el.reportTrigger.value = report.trigger;
  el.reportNotes.value = report.notes;
  el.cancelEditBtn.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteReport(id) {
  state.data.reports = state.data.reports.filter((item) => item.id !== id);
  if (state.editingId === id) resetForm();
  saveLocal();
  render();
  setStatus('Relapse report deleted locally. Save to GitHub when ready.');
}

function saveReport() {
  const date = el.reportDate.value;
  const trigger = el.reportTrigger.value.trim();
  const notes = el.reportNotes.value.trim();

  if (!isValidDateKey(date)) {
    alert('Use a valid date.');
    return;
  }
  if (daysBetween(date, todayKey()) < 0) {
    alert('Relapse date cannot be in the future.');
    return;
  }
  if (daysBetween(state.data.trackingStartDate, date) < 0) {
    alert('Relapse date cannot be earlier than tracking start date.');
    return;
  }

  const stamp = new Date().toISOString();

  if (state.editingId) {
    state.data.reports = state.data.reports.map((report) =>
      report.id === state.editingId
        ? { ...report, date, trigger, notes, updatedAt: stamp }
        : report
    );
    setStatus('Relapse report updated locally. Save to GitHub when ready.');
  } else {
    state.data.reports.push({
      id: `${stamp}-${Math.random().toString(36).slice(2, 9)}`,
      date,
      trigger,
      notes,
      createdAt: stamp,
      updatedAt: stamp,
    });
    setStatus('Relapse report added locally. Save to GitHub when ready.');
  }

  saveLocal();
  resetForm();
  render();
}

function getMonthMatrix(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks, year, month };
}

function dateKeyFor(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function renderCalendar() {
  const monthData = getMonthMatrix(new Date());
  const monthLabel = new Date(monthData.year, monthData.month, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  el.monthLabel.textContent = monthLabel;

  const relapseDateSet = new Set(state.data.reports.map((report) => report.date));
  const today = todayKey();

  let html = '<div class="weekdays">';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((day) => {
    html += `<div class="weekday">${day}</div>`;
  });
  html += '</div>';

  monthData.weeks.forEach((week) => {
    html += '<div class="week">';
    week.forEach((day) => {
      if (!day) {
        html += '<div class="day blank"></div>';
        return;
      }
      const key = dateKeyFor(monthData.year, monthData.month, day);
      const isToday = key === today;
      const started = daysBetween(state.data.trackingStartDate, key) >= 0;
      const inPastOrToday = daysBetween(key, today) >= 0;
      const relapse = relapseDateSet.has(key);
      const clean = started && inPastOrToday && !relapse;
      const classes = ['day'];
      if (clean) classes.push('clean');
      if (relapse) classes.push('relapse');
      if (isToday) classes.push('today');
      html += `<div class="${classes.join(' ')}">${day}</div>`;
    });
    html += '</div>';
  });

  el.calendar.innerHTML = html;
}

function renderReports() {
  const reports = sortedReports();
  if (!reports.length) {
    el.reportList.innerHTML = '<p>No relapse reports yet.</p>';
    return;
  }

  el.reportList.innerHTML = reports.map((report) => `
    <div class="report-item">
      <h3>${toPrettyDate(report.date)}</h3>
      <p><strong>Trigger:</strong> ${escapeHtml(report.trigger || 'Not specified')}</p>
      <p><strong>Notes:</strong> ${escapeHtml(report.notes || 'No notes')}</p>
      <div class="row">
        <button class="ghost" data-edit="${report.id}">Edit</button>
        <button class="danger" data-delete="${report.id}">Delete</button>
      </div>
    </div>
  `).join('');

  el.reportList.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => startEdit(button.dataset.edit));
  });
  el.reportList.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => deleteReport(button.dataset.delete));
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderOverview() {
  const streak = computeCurrentStreak();
  const longest = computeLongestGap();
  const lastRelapse = getLastRelapseDate();

  el.currentStreak.textContent = `${streak} day${streak === 1 ? '' : 's'}`;
  el.longestStreak.textContent = `${longest} day${longest === 1 ? '' : 's'}`;
  el.reportCount.textContent = String(state.data.reports.length);
  el.lastRelapse.textContent = lastRelapse ? toPrettyDate(lastRelapse) : 'None logged';
}

function render() {
  renderOverview();
  renderCalendar();
  renderReports();
}

function pullInputsToState() {
  state.data.userName = el.userName.value.trim() || 'Sam';
  state.data.trackingStartDate = el.trackingStartDate.value || todayKey();
  state.settings.githubOwner = el.githubOwner.value.trim();
  state.settings.githubRepo = el.githubRepo.value.trim();
  state.settings.githubBranch = el.githubBranch.value.trim() || 'main';
  state.settings.githubPath = el.githubPath.value.trim() || 'data/habit-data.json';
  state.settings.githubToken = el.githubToken.value.trim();
}

async function githubRequest(method, path, body) {
  const { githubOwner, githubRepo, githubToken } = state.settings;
  if (!githubOwner || !githubRepo || !githubToken) {
    throw new Error('Missing GitHub settings or token.');
  }

  const response = await fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `GitHub request failed with ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

function toBase64Unicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function fromBase64Unicode(str) {
  return decodeURIComponent(escape(atob(str)));
}

async function loadFromGitHub() {
  pullInputsToState();
  saveLocal();
  setStatus('Loading from GitHub...');

  const path = `/contents/${encodeURIComponent(state.settings.githubPath).replace(/%2F/g, '/')}`;
  const refQuery = `?ref=${encodeURIComponent(state.settings.githubBranch)}`;

  try {
    const result = await githubRequest('GET', `${path}${refQuery}`);
    state.remoteSha = result.sha || null;
    const parsed = JSON.parse(fromBase64Unicode((result.content || '').replace(/\n/g, '')));
    state.data.userName = parsed.userName || 'Sam';
    state.data.trackingStartDate = parsed.trackingStartDate || todayKey();
    state.data.reports = Array.isArray(parsed.reports) ? parsed.reports : [];
    saveLocal();
    syncInputsFromState();
    resetForm();
    render();
    setStatus('Loaded latest data from GitHub.');
  } catch (error) {
    setStatus(`Could not load from GitHub, ${error.message}`);
  }
}

async function saveToGitHub() {
  pullInputsToState();
  saveLocal();
  setStatus('Saving to GitHub...');

  const contentObject = {
    userName: state.data.userName,
    trackingStartDate: state.data.trackingStartDate,
    reports: sortedReports(),
    updatedAt: new Date().toISOString(),
  };

  const body = {
    message: 'Update habit reset data',
    content: toBase64Unicode(JSON.stringify(contentObject, null, 2)),
    branch: state.settings.githubBranch,
  };

  if (state.remoteSha) body.sha = state.remoteSha;

  const path = `/contents/${encodeURIComponent(state.settings.githubPath).replace(/%2F/g, '/')}`;

  try {
    const result = await githubRequest('PUT', path, body);
    state.remoteSha = result.content?.sha || null;
    setStatus('Saved to GitHub successfully.');
  } catch (error) {
    setStatus(`Could not save to GitHub, ${error.message}`);
  }
}

function bindEvents() {
  el.saveReportBtn.addEventListener('click', saveReport);
  el.cancelEditBtn.addEventListener('click', resetForm);
  el.saveSettingsBtn.addEventListener('click', () => {
    pullInputsToState();
    saveLocal();
    setStatus('Settings saved on this phone.');
  });
  el.loadGithubBtn.addEventListener('click', loadFromGitHub);
  el.saveAllBtn.addEventListener('click', saveToGitHub);
  el.userName.addEventListener('change', () => {
    pullInputsToState();
    saveLocal();
    renderOverview();
  });
  el.trackingStartDate.addEventListener('change', () => {
    pullInputsToState();
    saveLocal();
    render();
  });
}

function init() {
  loadLocal();
  syncInputsFromState();
  resetForm();
  bindEvents();
  render();
  setStatus('Ready. Save settings on this phone, then load or save with GitHub.');
}

init();