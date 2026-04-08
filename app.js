/* ===================================================
   MHT-CET 2027 Study Tracker — app.js
   =================================================== */

// ===== STATE =====
let state = {
  xp: 0, level: 0, streak: 0, lastStudyDate: null,
  sessions: [], tasks: [], goals: [], mistakes: [],
  reflections: [], missionsDone: [],
  calendarData: {}, // { 'YYYY-MM-DD': hours }
  settings: { pomoDuration: 25, breakDuration: 5, dailyGoal: 6, accent: '#667eea', dark: false },
  futureMsg: '', personalNote: '', visionImage: '',
  hardcoreMode: false,
  missionsDate: '', missions: []
};

function loadState() {
  const saved = localStorage.getItem('cetTrackerState');
  if (saved) {
    try { state = { ...state, ...JSON.parse(saved) }; } catch(e) {}
  }
}
function saveState() {
  localStorage.setItem('cetTrackerState', JSON.stringify(state));
}

// ===== LEVELS =====
const LEVELS = [
  { name: 'Beginner', min: 0, max: 500 },
  { name: 'Grinder', min: 500, max: 2000 },
  { name: 'Topper', min: 2000, max: 5000 },
  { name: 'CET Slayer', min: 5000, max: Infinity }
];
function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return i;
  }
  return 0;
}
function getLevelProgress(xp) {
  const lvl = getLevel(xp);
  const l = LEVELS[lvl];
  if (l.max === Infinity) return 100;
  return Math.min(100, ((xp - l.min) / (l.max - l.min)) * 100);
}

// ===== BADGES =====
const BADGES = [
  { id: 'first_session', icon: '🎯', name: 'First Step', desc: 'Complete first session', check: s => s.sessions.length >= 1 },
  { id: 'streak3', icon: '🔥', name: 'On Fire', desc: '3-day streak', check: s => s.streak >= 3 },
  { id: 'streak7', icon: '⚡', name: 'Week Warrior', desc: '7-day streak', check: s => s.streak >= 7 },
  { id: 'xp500', icon: '⭐', name: 'XP Hunter', desc: 'Earn 500 XP', check: s => s.xp >= 500 },
  { id: 'xp2000', icon: '💎', name: 'Diamond Grind', desc: 'Earn 2000 XP', check: s => s.xp >= 2000 },
  { id: 'sessions10', icon: '📚', name: 'Bookworm', desc: '10 sessions done', check: s => s.sessions.length >= 10 },
  { id: 'hours10', icon: '⏰', name: 'Time Lord', desc: '10 hours total', check: s => getTotalHours() >= 10 },
  { id: 'hours50', icon: '🏆', name: 'Champion', desc: '50 hours total', check: s => getTotalHours() >= 50 },
];
function getTotalHours() {
  return state.sessions.reduce((a, s) => a + (s.duration || 0), 0) / 3600;
}

// ===== QUOTES =====
const QUOTES = [
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "The secret of getting ahead is getting started.",
  "Don't watch the clock; do what it does. Keep going.",
  "Believe you can and you're halfway there.",
  "Hard work beats talent when talent doesn't work hard.",
  "Your future is created by what you do today, not tomorrow.",
  "Push yourself, because no one else is going to do it for you.",
  "Dream it. Wish it. Do it.",
  "Great things never come from comfort zones.",
  "It always seems impossible until it's done.",
  "Study hard, for the well is deep, and our brains are shallow.",
  "The expert in anything was once a beginner.",
  "Discipline is the bridge between goals and accomplishment.",
  "You don't have to be great to start, but you have to start to be great.",
  "CET 2027 — Your moment. Your glory. Earn it."
];

// ===== MISSIONS =====
const MISSION_TEMPLATES = [
  "Study Physics for 1 hour",
  "Solve 20 Chemistry MCQs",
  "Revise 3 Math formulas",
  "Complete 1 Pomodoro session",
  "Read Biology notes for 30 min",
  "Solve 10 PYQ questions",
  "Watch 1 concept video",
  "Write 5 key formulas from memory",
  "Take a mock test",
  "Review yesterday's mistakes",
  "Study Organic Chemistry reactions",
  "Practice Integration problems",
  "Revise Newton's Laws",
  "Complete 2 hours of focused study",
  "Update your mistake notebook"
];
function generateMissions() {
  const today = todayStr();
  if (state.missionsDate === today && state.missions.length > 0) return state.missions;
  const shuffled = [...MISSION_TEMPLATES].sort(() => Math.random() - 0.5);
  state.missions = shuffled.slice(0, 5).map((t, i) => ({ id: i, text: t, done: false }));
  state.missionsDate = today;
  state.missionsDone = [];
  saveState();
  return state.missions;
}

// ===== UTILS =====
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function fmtTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function fmtMins(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${pad(m)}:${pad(s)}`;
}
function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ===== PAGE NAVIGATION =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  const nav = document.querySelector(`[data-page="${name}"]`);
  if (nav) nav.classList.add('active');
  // Close sidebar on mobile
  if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
  // Page-specific init
  if (name === 'analytics') initCharts();
  if (name === 'calendar') renderCalendar();
  if (name === 'countdown') updateCountdown();
  if (name === 'phases') renderPhases();
  if (name === 'motivation') renderMotivation();
  if (name === 'goals') renderGoals();
  if (name === 'tasks') { renderTasks(); renderMistakes(); }
  if (name === 'session') renderSessionHistory();
  if (name === 'settings') loadSettings();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ===== DARK MODE =====
function toggleDark() {
  state.settings.dark = !state.settings.dark;
  document.body.classList.toggle('dark', state.settings.dark);
  const t1 = document.getElementById('dark-mode-toggle');
  if (t1) t1.checked = state.settings.dark;
  saveState();
}

// ===== ACCENT COLOR =====
function setAccent(color) {
  state.settings.accent = color;
  document.documentElement.style.setProperty('--accent', color);
  saveState();
}

// ===== XP & LEVEL UI =====
function updateXPUI() {
  const lvlIdx = getLevel(state.xp);
  const lvl = LEVELS[lvlIdx];
  const pct = getLevelProgress(state.xp);
  const fill = document.getElementById('sb-xp-fill');
  const lvlEl = document.getElementById('sb-level');
  const xpEl = document.getElementById('sb-xp');
  if (fill) fill.style.width = pct + '%';
  if (lvlEl) lvlEl.textContent = lvl.name;
  if (xpEl) xpEl.textContent = state.xp + ' XP';
  const dashXp = document.getElementById('dash-xp');
  if (dashXp) dashXp.textContent = state.xp;
}

// ===== STREAK =====
function updateStreak() {
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (state.lastStudyDate === today) return;
  if (state.lastStudyDate === yesterday) {
    state.streak++;
  } else if (state.lastStudyDate !== today) {
    state.streak = 1;
  }
  state.lastStudyDate = today;
  saveState();
  const el = document.getElementById('dash-streak');
  if (el) el.textContent = state.streak;
}

// ===== DASHBOARD INIT =====
function initDashboard() {
  const dateEl = document.getElementById('dash-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  updateXPUI();
  const streakEl = document.getElementById('dash-streak');
  if (streakEl) streakEl.textContent = state.streak;
  const sessEl = document.getElementById('dash-sessions');
  if (sessEl) sessEl.textContent = state.sessions.length;
  updateTodayHours();
  renderDailyMissions();
  renderBadges();
}

function updateTodayHours() {
  const today = todayStr();
  const hrs = state.calendarData[today] || 0;
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  const el = document.getElementById('dash-today-hours');
  if (el) el.textContent = `${h}h ${m}m`;
}

// ===== DAILY MISSIONS =====
function renderDailyMissions() {
  const missions = generateMissions();
  const el = document.getElementById('daily-missions-dash');
  if (!el) return;
  el.innerHTML = missions.map(m => `
    <div class="mission-item ${m.done ? 'done' : ''}" id="mission-${m.id}">
      <div class="mission-check ${m.done ? 'checked' : ''}" onclick="toggleMission(${m.id})">
        ${m.done ? '✓' : ''}
      </div>
      <span>${m.text}</span>
    </div>
  `).join('');
}

function toggleMission(id) {
  const m = state.missions.find(x => x.id === id);
  if (!m) return;
  m.done = !m.done;
  if (m.done) { state.xp += 20; updateXPUI(); }
  else { state.xp = Math.max(0, state.xp - 20); updateXPUI(); }
  saveState();
  renderDailyMissions();
}

// ===== BADGES =====
function renderBadges() {
  const el = document.getElementById('badges-grid');
  if (!el) return;
  el.innerHTML = BADGES.map(b => {
    const earned = b.check(state);
    return `<div class="badge ${earned ? 'earned' : ''}" title="${b.desc}">
      ${b.icon} ${b.name}
    </div>`;
  }).join('');
}

// ===== WEB WORKER TIMER (Study Session) =====
let sessionWorker = null;
let sessionRunning = false;
let sessionPaused = false;
let sessionSeconds = 0;
let sessionSubject = '';
let sessionTopic = '';

function initWorker() {
  if (sessionWorker) return;
  try {
    sessionWorker = new Worker('worker.js');
    sessionWorker.onmessage = function(e) {
      if (e.data.type === 'tick') {
        sessionSeconds = e.data.seconds;
        updateSessionUI();
      }
    };
  } catch(err) {
    console.warn('Worker failed, using fallback timer');
    sessionWorker = null;
  }
}

// Fallback interval timer
let fallbackInterval = null;
function startFallbackTimer() {
  fallbackInterval = setInterval(() => {
    sessionSeconds++;
    updateSessionUI();
  }, 1000);
}
function stopFallbackTimer() {
  clearInterval(fallbackInterval);
  fallbackInterval = null;
}

function updateSessionUI() {
  const el = document.getElementById('session-timer');
  if (el) el.textContent = fmtTime(sessionSeconds);
  const fsEl = document.getElementById('fs-timer');
  if (fsEl) fsEl.textContent = fmtTime(sessionSeconds);
  const focusEl = document.getElementById('focus-timer');
  if (focusEl) focusEl.textContent = fmtTime(sessionSeconds);
  const xpEl = document.getElementById('session-xp');
  if (xpEl) xpEl.textContent = Math.floor(sessionSeconds / 30); // 2 XP/min = 1 XP/30s
}

function startSession() {
  const subj = document.getElementById('session-subject').value;
  const topic = document.getElementById('session-topic').value;
  if (!subj) { alert('Please select a subject!'); return; }
  sessionSubject = subj;
  sessionTopic = topic;
  sessionRunning = true;
  sessionPaused = false;
  document.getElementById('btn-start-session').disabled = true;
  document.getElementById('btn-pause-session').disabled = false;
  document.getElementById('btn-stop-session').disabled = false;
  const focusLabel = document.getElementById('focus-subject-label');
  if (focusLabel) focusLabel.textContent = `${subj}${topic ? ' — ' + topic : ''}`;
  if (sessionWorker) {
    sessionWorker.postMessage({ type: 'set', seconds: sessionSeconds });
    sessionWorker.postMessage('start');
  } else {
    startFallbackTimer();
  }
}

function pauseSession() {
  if (!sessionRunning) return;
  if (!sessionPaused) {
    sessionPaused = true;
    if (sessionWorker) sessionWorker.postMessage('pause');
    else stopFallbackTimer();
    document.getElementById('btn-pause-session').textContent = '▶ Resume';
  } else {
    sessionPaused = false;
    if (sessionWorker) sessionWorker.postMessage('resume');
    else startFallbackTimer();
    document.getElementById('btn-pause-session').textContent = '⏸ Pause';
  }
}

function stopSession() {
  if (!sessionRunning && sessionSeconds === 0) return;
  const duration = sessionSeconds;
  if (sessionWorker) sessionWorker.postMessage('stop');
  else stopFallbackTimer();
  sessionRunning = false;
  sessionPaused = false;
  // Save session
  if (duration > 10) {
    const xpEarned = Math.floor(duration / 30);
    state.xp += xpEarned;
    const today = todayStr();
    state.calendarData[today] = (state.calendarData[today] || 0) + duration / 3600;
    state.sessions.unshift({
      id: Date.now(), subject: sessionSubject, topic: sessionTopic,
      duration, xp: xpEarned, date: today, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    });
    updateStreak();
    updateXPUI();
    updateTodayHours();
    renderBadges();
    saveState();
    renderSessionHistory();
  }
  sessionSeconds = 0;
  updateSessionUI();
  document.getElementById('btn-start-session').disabled = false;
  document.getElementById('btn-pause-session').disabled = true;
  document.getElementById('btn-stop-session').disabled = true;
  document.getElementById('btn-pause-session').textContent = '⏸ Pause';
  const sessEl = document.getElementById('dash-sessions');
  if (sessEl) sessEl.textContent = state.sessions.length;
}

function renderSessionHistory() {
  const el = document.getElementById('session-history');
  if (!el) return;
  if (state.sessions.length === 0) {
    el.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">No sessions yet. Start studying!</p>';
    return;
  }
  el.innerHTML = state.sessions.slice(0, 20).map(s => `
    <div class="history-item">
      <div>
        <div class="history-subject">${s.subject}</div>
        <div class="history-meta">${s.topic || 'General'} • ${fmtTime(s.duration)}</div>
      </div>
      <div style="text-align:right">
        <div style="color:#f5a623;font-weight:700">+${s.xp} XP</div>
        <div class="history-meta">${s.date} ${s.time || ''}</div>
      </div>
    </div>
  `).join('');
}

// ===== POMODORO =====
let pomoWorker = null;
let pomoRunning = false;
let pomoPaused = false;
let pomoSeconds = 0;
let pomoMode = 'focus'; // 'focus' | 'break'
let pomoCycles = 0;
let pomoFallback = null;

function getPomoFocusSecs() { return (parseInt(document.getElementById('pomo-focus-dur')?.value) || state.settings.pomoDuration) * 60; }
function getPomoBreakSecs() { return (parseInt(document.getElementById('pomo-break-dur')?.value) || state.settings.breakDuration) * 60; }

function initPomoWorker() {
  if (pomoWorker) return;
  try {
    pomoWorker = new Worker('worker.js');
    pomoWorker.onmessage = function(e) {
      if (e.data.type === 'tick') {
        pomoSeconds = e.data.seconds;
        updatePomoUI();
        const total = pomoMode === 'focus' ? getPomoFocusSecs() : getPomoBreakSecs();
        if (pomoSeconds >= total) switchPomoMode();
      }
    };
  } catch(e) { pomoWorker = null; }
}

function startPomo() {
  if (pomoRunning && !pomoPaused) return;
  if (!pomoRunning) {
    pomoSeconds = 0;
    pomoMode = 'focus';
  }
  pomoRunning = true;
  pomoPaused = false;
  if (pomoWorker) {
    pomoWorker.postMessage({ type: 'set', seconds: pomoSeconds });
    pomoWorker.postMessage('start');
  } else {
    clearInterval(pomoFallback);
    pomoFallback = setInterval(() => {
      pomoSeconds++;
      updatePomoUI();
      const total = pomoMode === 'focus' ? getPomoFocusSecs() : getPomoBreakSecs();
      if (pomoSeconds >= total) switchPomoMode();
    }, 1000);
  }
}

function pausePomo() {
  if (!pomoRunning) return;
  if (!pomoPaused) {
    pomoPaused = true;
    if (pomoWorker) pomoWorker.postMessage('pause');
    else clearInterval(pomoFallback);
  } else {
    pomoPaused = false;
    startPomo();
  }
}

function resetPomo() {
  pomoRunning = false;
  pomoPaused = false;
  pomoSeconds = 0;
  pomoMode = 'focus';
  if (pomoWorker) pomoWorker.postMessage('stop');
  else clearInterval(pomoFallback);
  updatePomoUI();
}

function switchPomoMode() {
  if (pomoMode === 'focus') {
    pomoCycles++;
    pomoMode = 'break';
    state.xp += 10;
    updateXPUI();
    saveState();
    if (Notification.permission === 'granted') new Notification('Pomodoro!', { body: 'Focus done! Take a break 🎉' });
  } else {
    pomoMode = 'focus';
    if (Notification.permission === 'granted') new Notification('Break over!', { body: 'Back to work! 💪' });
  }
  pomoSeconds = 0;
  if (pomoWorker) {
    pomoWorker.postMessage({ type: 'set', seconds: 0 });
  }
  updatePomoUI();
}

function updatePomoUI() {
  const total = pomoMode === 'focus' ? getPomoFocusSecs() : getPomoBreakSecs();
  const remaining = Math.max(0, total - pomoSeconds);
  const el = document.getElementById('pomo-display');
  if (el) el.textContent = fmtMins(remaining);
  const modeEl = document.getElementById('pomo-mode');
  if (modeEl) modeEl.textContent = pomoMode === 'focus' ? '🎯 Focus' : '☕ Break';
  const cyclesEl = document.getElementById('pomo-cycles');
  if (cyclesEl) cyclesEl.textContent = pomoCycles;
}

function savePomoSettings() {
  state.settings.pomoDuration = parseInt(document.getElementById('pomo-focus-dur').value) || 25;
  state.settings.breakDuration = parseInt(document.getElementById('pomo-break-dur').value) || 5;
  saveState();
  resetPomo();
  alert('Pomodoro settings saved!');
}

function saveDailyGoal() {
  state.settings.dailyGoal = parseInt(document.getElementById('daily-goal-input').value) || 6;
  saveState();
  alert('Daily goal saved!');
}

function loadSettings() {
  const dg = document.getElementById('daily-goal-input');
  if (dg) dg.value = state.settings.dailyGoal;
  const pf = document.getElementById('pomo-focus-dur');
  if (pf) pf.value = state.settings.pomoDuration;
  const pb = document.getElementById('pomo-break-dur');
  if (pb) pb.value = state.settings.breakDuration;
  const dm = document.getElementById('dark-mode-toggle');
  if (dm) dm.checked = state.settings.dark;
  const ac = document.getElementById('accent-color');
  if (ac) ac.value = state.settings.accent;
}

function clearAllData() {
  if (confirm('Are you sure? This will delete ALL your data permanently!')) {
    localStorage.removeItem('cetTrackerState');
    location.reload();
  }
}

// ===== CALENDAR =====
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function renderCalendar() {
  const today = new Date();
  const label = document.getElementById('cal-month-label');
  if (label) label.textContent = new Date(calYear, calMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
    const isToday = dateStr === todayStr();
    const hrs = state.calendarData[dateStr] || 0;
    const isPast = new Date(dateStr) < today && !isToday;
    let cls = 'cal-day';
    if (isToday) cls += ' today';
    else if (hrs > 0) cls += ' studied';
    else if (isPast) cls += ' missed';
    else cls += ' future';
    html += `<div class="${cls}">
      <span>${d}</span>
      ${hrs > 0 ? `<span class="cal-day-hrs">${hrs.toFixed(1)}h</span>` : ''}
    </div>`;
  }
  grid.innerHTML = html;
}

function calPrev() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}
function calNext() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

// ===== COUNTDOWN =====
function updateCountdown() {
  const target = new Date('2027-04-01T00:00:00');
  const start = new Date('2025-01-01T00:00:00');
  function tick() {
    const now = new Date();
    const diff = target - now;
    if (diff <= 0) {
      document.getElementById('cd-days').textContent = '0';
      document.getElementById('cd-hours').textContent = '00';
      document.getElementById('cd-mins').textContent = '00';
      document.getElementById('cd-secs').textContent = '00';
      document.getElementById('cd-message').textContent = '🎉 CET 2027 is here! Go crush it!';
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const dEl = document.getElementById('cd-days');
    const hEl = document.getElementById('cd-hours');
    const mEl = document.getElementById('cd-mins');
    const sEl = document.getElementById('cd-secs');
    if (dEl) dEl.textContent = days;
    if (hEl) hEl.textContent = pad(hours);
    if (mEl) mEl.textContent = pad(mins);
    if (sEl) sEl.textContent = pad(secs);
    // Message
    const msgEl = document.getElementById('cd-message');
    if (msgEl) {
      if (days > 500) msgEl.textContent = '🌱 You have plenty of time — but don\'t waste it. Start NOW.';
      else if (days > 300) msgEl.textContent = '📚 Less than a year left. Build your foundation strong.';
      else if (days > 180) msgEl.textContent = '⚡ 6 months to go. Grind harder every single day.';
      else if (days > 90) msgEl.textContent = '🔥 3 months left! Revision mode: ON. No excuses.';
      else if (days > 30) msgEl.textContent = '💀 Final month! Every hour counts. BEAST MODE.';
      else if (days > 7) msgEl.textContent = '🚨 Last week! Sleep, revise, stay calm. You got this.';
      else msgEl.textContent = '🎯 EXAM WEEK! Trust your preparation. Go be a CET Slayer!';
    }
    // Progress bar
    const totalDuration = target - start;
    const elapsed = now - start;
    const pct = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    const fill = document.getElementById('cd-progress-fill');
    const pctEl = document.getElementById('cd-progress-pct');
    if (fill) fill.style.width = pct.toFixed(1) + '%';
    if (pctEl) pctEl.textContent = pct.toFixed(1) + '%';
  }
  tick();
  if (window._countdownInterval) clearInterval(window._countdownInterval);
  window._countdownInterval = setInterval(tick, 1000);
}

// ===== TASKS =====
function addTask() {
  const input = document.getElementById('task-input');
  const priority = document.getElementById('task-priority').value;
  const text = input.value.trim();
  if (!text) return;
  state.tasks.unshift({ id: Date.now(), text, priority, done: false });
  input.value = '';
  saveState();
  renderTasks();
}

function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (t) { t.done = !t.done; if (t.done) { state.xp += 10; updateXPUI(); } saveState(); renderTasks(); }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(x => x.id !== id);
  saveState();
  renderTasks();
}

function renderTasks() {
  const el = document.getElementById('task-list');
  if (!el) return;
  if (state.tasks.length === 0) {
    el.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:16px">No tasks yet. Add one above!</p>';
    return;
  }
  el.innerHTML = state.tasks.map(t => `
    <div class="task-item ${t.done ? 'done' : ''}">
      <div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleTask(${t.id})">${t.done ? '✓' : ''}</div>
      <span class="task-text">${t.text}</span>
      <span class="task-priority ${t.priority}">${t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢'} ${t.priority}</span>
      <button class="task-del" onclick="deleteTask(${t.id})">🗑</button>
    </div>
  `).join('');
}

// ===== MISTAKE NOTEBOOK =====
function addMistake() {
  const input = document.getElementById('mistake-input');
  const subject = document.getElementById('mistake-subject').value;
  const text = input.value.trim();
  if (!text) return;
  state.mistakes.unshift({ id: Date.now(), text, subject, date: todayStr() });
  input.value = '';
  saveState();
  renderMistakes();
}

function deleteMistake(id) {
  state.mistakes = state.mistakes.filter(x => x.id !== id);
  saveState();
  renderMistakes();
}

function renderMistakes() {
  const el = document.getElementById('mistake-list');
  if (!el) return;
  if (state.mistakes.length === 0) {
    el.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:16px">No mistakes noted yet. Keep learning!</p>';
    return;
  }
  el.innerHTML = state.mistakes.map(m => `
    <div class="mistake-item">
      <div style="flex:1">
        <div style="font-weight:600;margin-bottom:2px">${m.text}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${m.date}</div>
      </div>
      <span class="mistake-subject">${m.subject}</span>
      <button class="task-del" onclick="deleteMistake(${m.id})" style="margin-left:8px">🗑</button>
    </div>
  `).join('');
}

// ===== GOALS =====
function addGoal() {
  const input = document.getElementById('goal-input');
  const target = document.getElementById('goal-target');
  const text = input.value.trim();
  if (!text) return;
  state.goals.unshift({ id: Date.now(), text, target: target.value.trim(), done: false });
  input.value = ''; target.value = '';
  saveState();
  renderGoals();
}

function toggleGoal(id) {
  const g = state.goals.find(x => x.id === id);
  if (g) { g.done = !g.done; if (g.done) { state.xp += 50; updateXPUI(); } saveState(); renderGoals(); }
}

function deleteGoal(id) {
  state.goals = state.goals.filter(x => x.id !== id);
  saveState();
  renderGoals();
}

function renderGoals() {
  const el = document.getElementById('goal-list');
  if (!el) return;
  if (state.goals.length === 0) {
    el.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:16px">No goals yet. Set one!</p>';
    return;
  }
  el.innerHTML = state.goals.map(g => `
    <div class="goal-item ${g.done ? 'done' : ''}">
      <div class="task-check ${g.done ? 'checked' : ''}" onclick="toggleGoal(${g.id})">${g.done ? '✓' : ''}</div>
      <span class="goal-text" style="${g.done ? 'text-decoration:line-through;opacity:0.5' : ''}">${g.text}</span>
      ${g.target ? `<span class="goal-target">🎯 ${g.target}</span>` : ''}
      <button class="goal-del" onclick="deleteGoal(${g.id})">🗑</button>
    </div>
  `).join('');
}

// ===== FUTURE SELF MESSAGE =====
function saveFutureMsg() {
  const val = document.getElementById('future-msg').value.trim();
  if (!val) return;
  state.futureMsg = val;
  saveState();
  renderFutureMsg();
}

function renderFutureMsg() {
  const el = document.getElementById('future-msg-display');
  if (!el) return;
  if (state.futureMsg) {
    el.style.display = 'block';
    el.innerHTML = `<strong>💌 Your message to future self:</strong><br><br>"${state.futureMsg}"`;
    document.getElementById('future-msg').value = state.futureMsg;
  }
}

// ===== DAILY REFLECTION =====
function saveReflection() {
  const val = document.getElementById('reflection-input').value.trim();
  if (!val) return;
  state.reflections.unshift({ text: val, date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) });
  document.getElementById('reflection-input').value = '';
  saveState();
  renderReflections();
}

function renderReflections() {
  const el = document.getElementById('reflection-list');
  if (!el) return;
  if (state.reflections.length === 0) {
    el.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:12px">No reflections yet.</p>';
    return;
  }
  el.innerHTML = state.reflections.slice(0, 10).map(r => `
    <div class="reflection-item">
      <div class="reflection-date">📅 ${r.date}</div>
      <div>${r.text}</div>
    </div>
  `).join('');
}

// ===== PHASES =====
function renderPhases() {
  const now = new Date();
  const phase1End = new Date('2027-01-31');
  const phase2Start = new Date('2027-02-01');
  const phase2End = new Date('2027-04-01');
  const appStart = new Date('2025-01-01');

  // Phase 1 progress
  const p1Total = phase1End - appStart;
  const p1Elapsed = Math.min(now - appStart, p1Total);
  const p1Pct = Math.max(0, Math.min(100, (p1Elapsed / p1Total) * 100));
  const fill1 = document.getElementById('phase1-fill');
  const pct1El = document.getElementById('phase1-pct');
  if (fill1) fill1.style.width = p1Pct.toFixed(1) + '%';
  if (pct1El) pct1El.textContent = p1Pct.toFixed(1) + '% complete';

  // Phase 2 progress
  const p2Total = phase2End - phase2Start;
  const p2Elapsed = Math.max(0, Math.min(now - phase2Start, p2Total));
  const p2Pct = Math.max(0, Math.min(100, (p2Elapsed / p2Total) * 100));
  const fill2 = document.getElementById('phase2-fill');
  const pct2El = document.getElementById('phase2-pct');
  if (fill2) fill2.style.width = p2Pct.toFixed(1) + '%';
  if (pct2El) pct2El.textContent = p2Pct.toFixed(1) + '% complete';

  // Active phase highlight
  const phase2Card = document.getElementById('phase2-card');
  const phase1Card = document.getElementById('phase1-card');
  if (now >= phase2Start) {
    if (phase2Card) phase2Card.classList.add('active-phase');
    if (phase1Card) phase1Card.style.opacity = '0.6';
  }
}

// ===== ANALYTICS =====
let chartDaily = null, chartSubject = null;

function initCharts() {
  // Daily hours last 7 days
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const str = d.toISOString().split('T')[0];
    labels.push(d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }));
    data.push(parseFloat((state.calendarData[str] || 0).toFixed(2)));
  }

  const ctx1 = document.getElementById('chart-daily');
  if (ctx1) {
    if (chartDaily) chartDaily.destroy();
    chartDaily = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Hours Studied',
          data,
          backgroundColor: 'rgba(102,126,234,0.6)',
          borderColor: '#667eea',
          borderWidth: 2,
          borderRadius: 8,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(102,126,234,0.1)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Subject distribution
  const subjectHours = {};
  state.sessions.forEach(s => {
    subjectHours[s.subject] = (subjectHours[s.subject] || 0) + s.duration / 3600;
  });
  const subLabels = Object.keys(subjectHours);
  const subData = Object.values(subjectHours).map(v => parseFloat(v.toFixed(2)));
  const subColors = ['rgba(102,126,234,0.8)', 'rgba(240,147,251,0.8)', 'rgba(79,172,254,0.8)', 'rgba(67,233,123,0.8)'];

  const ctx2 = document.getElementById('chart-subject');
  if (ctx2) {
    if (chartSubject) chartSubject.destroy();
    if (subLabels.length === 0) {
      ctx2.parentElement.innerHTML = '<div class="chart-title">📚 Subject Distribution</div><p style="text-align:center;color:var(--text-muted);padding:40px">No sessions yet</p>';
    } else {
      chartSubject = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: subLabels,
          datasets: [{ data: subData, backgroundColor: subColors, borderWidth: 0 }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } },
          cutout: '65%'
        }
      });
    }
  }

  // Weekly summary
  const weekEl = document.getElementById('weekly-summary');
  if (weekEl) {
    const weekHours = data.reduce((a, b) => a + b, 0);
    const avgHours = weekHours / 7;
    const bestDay = Math.max(...data);
    const activeDays = data.filter(d => d > 0).length;
    weekEl.innerHTML = `
      <div class="summary-item"><div class="summary-val">${weekHours.toFixed(1)}h</div><div class="summary-label">Total This Week</div></div>
      <div class="summary-item"><div class="summary-val">${avgHours.toFixed(1)}h</div><div class="summary-label">Daily Average</div></div>
      <div class="summary-item"><div class="summary-val">${bestDay.toFixed(1)}h</div><div class="summary-label">Best Day</div></div>
      <div class="summary-item"><div class="summary-val">${activeDays}/7</div><div class="summary-label">Active Days</div></div>
      <div class="summary-item"><div class="summary-val">${state.xp}</div><div class="summary-label">Total XP</div></div>
      <div class="summary-item"><div class="summary-val">${state.streak}</div><div class="summary-label">Current Streak</div></div>
    `;
  }
}

// ===== MOTIVATION =====
let quoteIdx = 0;
function renderMotivation() {
  const el = document.getElementById('quote-display');
  if (el) el.textContent = `"${QUOTES[quoteIdx % QUOTES.length]}"`;
  const noteEl = document.getElementById('personal-note');
  if (noteEl && state.personalNote) noteEl.value = state.personalNote;
  const noteDisplay = document.getElementById('personal-note-display');
  if (noteDisplay && state.personalNote) {
    noteDisplay.style.display = 'block';
    noteDisplay.textContent = state.personalNote;
  }
  if (state.visionImage) {
    const vd = document.getElementById('vision-display');
    if (vd) vd.innerHTML = `<img src="${state.visionImage}" alt="Vision"/>`;
  }
}

function newQuote() {
  quoteIdx = (quoteIdx + 1) % QUOTES.length;
  const el = document.getElementById('quote-display');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = `"${QUOTES[quoteIdx]}"`;
      el.style.opacity = '1';
    }, 200);
  }
}

function savePersonalNote() {
  const val = document.getElementById('personal-note').value.trim();
  state.personalNote = val;
  saveState();
  const el = document.getElementById('personal-note-display');
  if (el) { el.style.display = 'block'; el.textContent = val; }
}

function uploadVision() {
  const file = document.getElementById('vision-upload').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    state.visionImage = e.target.result;
    saveState();
    const vd = document.getElementById('vision-display');
    if (vd) vd.innerHTML = `<img src="${e.target.result}" alt="Vision" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin-top:12px"/>`;
  };
  reader.readAsDataURL(file);
}

// ===== STRATEGY =====
function toggleHardcore() {
  state.hardcoreMode = document.getElementById('hardcore-toggle').checked;
  const label = document.getElementById('hardcore-label');
  const msg = document.getElementById('hardcore-msg');
  if (label) label.textContent = state.hardcoreMode ? 'ON 🔥' : 'OFF';
  if (msg) msg.style.display = state.hardcoreMode ? 'block' : 'none';
  saveState();
}

// ===== AI COACH =====
async function sendChat() {
  const input = document.getElementById('chat-input');
  const query = input.value.trim();
  if (!query) return;
  input.value = '';
  appendChatMsg('user', query);
  await fetchAIResponse(query);
}

async function sendPrompt(text) {
  appendChatMsg('user', text);
  await fetchAIResponse(text);
}

function appendChatMsg(role, text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <span class="chat-avatar">${role === 'bot' ? '🤖' : '👤'}</span>
    <div class="chat-bubble">${text}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  if (!container) return null;
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <span class="chat-avatar">🤖</span>
    <div class="chat-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

async function fetchAIResponse(query) {
  const typing = showTyping();
  try {
    const studyContext = `Tu ek strict lekin caring MHT-CET 2027 study coach hai. Tera naam "Guru" hai. Tu hamesha Hinglish mein baat karta hai — matlab Hindi words use karta hai but Roman script mein (English letters mein Hindi). Kabhi pure English mein mat bol. Apne student ko "bhai" ya uske naam se bulao. Tu bahut motivating hai, real examples deta hai, aur CET ke liye practical tips deta hai. Agar student demotivated ho toh usse fire laga de. Agar koi concept pooche toh simple language mein samjha. Hamesha short, punchy aur energetic reh. Student ka question hai: `;
    const fullQuery = encodeURIComponent(studyContext + query);
    const res = await fetch(`https://api.safone.dev/chatbot?query=${fullQuery}`);
    const data = await res.json();
    if (typing) typing.remove();
    const reply = data.response || data.message || data.text || 'Sorry, I could not get a response. Try again!';
    appendChatMsg('bot', reply);
  } catch(e) {
    if (typing) typing.remove();
    appendChatMsg('bot', 'Oops! Could not connect to AI. Check your internet and try again. Meanwhile, here\'s a tip: Focus on your weakest subject first every day! 💪');
  }
}

// ===== FOCUS MODE =====
function toggleFocusFullscreen() {
  const overlay = document.getElementById('fullscreen-overlay');
  if (overlay) overlay.classList.add('active');
  if (Notification.permission === 'default') Notification.requestPermission();
}

function exitFullscreen() {
  const overlay = document.getElementById('fullscreen-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ===== MUSIC PLAYER (JioSaavn API) =====
let playlist = [];
let currentTrack = -1;
let isPlaying = false;
let audio = null;

function getAudio() {
  if (!audio) {
    audio = document.getElementById('audio-player');
    if (audio) {
      audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
          const pct = (audio.currentTime / audio.duration) * 100;
          const prog = document.getElementById('player-progress');
          if (prog) prog.value = pct;
          const cur = document.getElementById('player-current');
          if (cur) cur.textContent = fmtAudioTime(audio.currentTime);
        }
      });
      audio.addEventListener('loadedmetadata', () => {
        const dur = document.getElementById('player-duration');
        if (dur) dur.textContent = fmtAudioTime(audio.duration);
      });
      audio.addEventListener('ended', () => { nextSong(); });
      audio.addEventListener('error', () => {
        isPlaying = false;
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.textContent = '▶';
        const art = document.getElementById('player-art');
        if (art) art.classList.remove('playing');
      });
    }
  }
  return audio;
}

async function searchMusic() {
  const query = document.getElementById('music-search').value.trim();
  if (!query) return;
  const resultsEl = document.getElementById('search-results');
  if (resultsEl) resultsEl.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text-muted)">🔍 Searching...</div>';

  // YOUR VERCEL URL — update this after deploying
  // YOUR VERCEL URL — update this after deploying
  const API_BASE = window.YT_API || 'https://yt-api-theta.vercel.app';

  try {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=12`);
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    const songs = data.results || [];
    playlist = songs;

    if (!resultsEl) return;
    if (playlist.length === 0) {
      resultsEl.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text-muted)">No results found.</div>';
      return;
    }
    resultsEl.innerHTML = playlist.map((s, i) => `
      <div class="search-result-item" onclick="playSong(${i})">
        <img src="${s.thumbnail || 'https://placehold.co/36x36/667eea/fff?text=♪'}"
             alt="" onerror="this.src='https://placehold.co/36x36/667eea/fff?text=♪'"/>
        <div class="search-result-info">
          <div class="search-result-name">${s.title}</div>
          <div class="search-result-artist">${s.artist} • ${s.duration}</div>
        </div>
        <span style="color:var(--accent);font-size:1.1rem">▶</span>
      </div>`).join('');
  } catch(e) {
    console.error('Music search error:', e);
    if (resultsEl) resultsEl.innerHTML = `<div style="text-align:center;padding:10px;color:#ef4444">Search failed: ${e.message}</div>`;
  }
}

async function playSong(index) {
  if (index < 0 || index >= playlist.length) return;
  currentTrack = index;
  const song = playlist[index];
  const a = getAudio();
  if (!a) return;

  document.querySelectorAll('.search-result-item').forEach((el, i) => {
    el.style.background = i === index ? 'rgba(102,126,234,0.25)' : '';
  });
  document.getElementById('player-title').textContent = '⏳ Loading...';
  document.getElementById('player-artist').textContent = song.artist || '';

  try {
    // Go through our Vercel proxy — no CORS issues
    const API_BASE = 'https://yt-api-theta.vercel.app';
    const res = await fetch(`${API_BASE}/api/stream?id=${song.id}`);
    if (!res.ok) throw new Error('Proxy error ' + res.status);
    const data = await res.json();
    if (!data.success || !data.streamUrl) throw new Error(data.details || 'No stream URL');

    document.getElementById('player-title').textContent = data.title || song.title;
    document.getElementById('player-artist').textContent = song.artist || 'YouTube';
    const artEl = document.getElementById('player-art');
    artEl.src = data.thumbnail || song.thumbnail || 'https://placehold.co/100x100/667eea/fff?text=♪';

    a.src = data.streamUrl;
    a.load();
    a.play().then(() => {
      isPlaying = true;
      document.getElementById('play-pause-btn').textContent = '⏸';
      artEl.classList.add('playing');
    }).catch(() => {
      // Autoplay blocked — user must click play
      isPlaying = false;
      document.getElementById('play-pause-btn').textContent = '▶';
      document.getElementById('player-title').textContent = (data.title || song.title) + ' ← click ▶';
    });
  } catch(e) {
    console.error('Play error:', e);
    document.getElementById('player-title').textContent = '❌ ' + e.message;
  }
}

function togglePlay() {
  const a = getAudio();
  if (!a || !a.src) return;
  if (isPlaying) {
    a.pause();
    isPlaying = false;
    document.getElementById('play-pause-btn').textContent = '▶';
    document.getElementById('player-art').classList.remove('playing');
  } else {
    a.play();
    isPlaying = true;
    document.getElementById('play-pause-btn').textContent = '⏸';
    document.getElementById('player-art').classList.add('playing');
  }
}

function nextSong() {
  if (playlist.length === 0) return;
  playSong((currentTrack + 1) % playlist.length);
}

function prevSong() {
  if (playlist.length === 0) return;
  playSong((currentTrack - 1 + playlist.length) % playlist.length);
}

function seekSong(val) {
  const a = getAudio();
  if (a && a.duration) a.currentTime = (val / 100) * a.duration;
}

function fmtAudioTime(secs) {
  if (isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${pad(s)}`;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  loadState();

  // Apply saved settings
  if (state.settings.dark) document.body.classList.add('dark');
  if (state.settings.accent) document.documentElement.style.setProperty('--accent', state.settings.accent);

  // Init workers
  initWorker();
  initPomoWorker();

  // Init audio (must be after DOM ready)
  getAudio();

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Init dashboard
  initDashboard();

  // Render initial data
  renderFutureMsg();
  renderReflections();

  // Restore hardcore toggle
  const hcToggle = document.getElementById('hardcore-toggle');
  if (hcToggle) hcToggle.checked = state.hardcoreMode;
  const hcLabel = document.getElementById('hardcore-label');
  if (hcLabel) hcLabel.textContent = state.hardcoreMode ? 'ON 🔥' : 'OFF';
  const hcMsg = document.getElementById('hardcore-msg');
  if (hcMsg) hcMsg.style.display = state.hardcoreMode ? 'block' : 'none';

  // Rotate quote
  quoteIdx = Math.floor(Math.random() * QUOTES.length);

  // ── Event listeners (safe — DOM is ready) ──
  // AI Chat: Enter key + Send button
  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
  const chatSendBtn = document.getElementById('chat-send-btn');
  if (chatSendBtn) chatSendBtn.addEventListener('click', sendChat);

  // Music search: Enter key
  const musicSearch = document.getElementById('music-search');
  if (musicSearch) musicSearch.addEventListener('keydown', e => { if (e.key === 'Enter') searchMusic(); });

  // Task input: Enter key
  const taskInput = document.getElementById('task-input');
  if (taskInput) taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

  // Goal input: Enter key
  const goalInput = document.getElementById('goal-input');
  if (goalInput) goalInput.addEventListener('keydown', e => { if (e.key === 'Enter') addGoal(); });

  // Keyboard shortcut: Escape exits fullscreen
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') exitFullscreen();
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', e => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.menu-toggle');
    if (window.innerWidth <= 900 && sidebar && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && toggle && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });

  // Auto-save every 30 seconds
  setInterval(saveState, 30000);
  // Update today hours display every minute
  setInterval(updateTodayHours, 60000);

  console.log('🎯 MHT-CET 2027 Tracker loaded!');
});
