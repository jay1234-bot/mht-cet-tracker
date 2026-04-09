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

// ===== CONFIG =====
const API_BASE = 'https://yt-api-theta.vercel.app';
// Simple UID — stored in localStorage, same across sessions on same browser
// For cross-device sync, user sets their own UID in settings
function getUID() {
  let uid = localStorage.getItem('cet_uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('cet_uid', uid);
  }
  return uid;
}
const DB_NAME = 'CETTrackerDB';
let db = null;

function initIndexedDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('state')) d.createObjectStore('state', { keyPath: 'id' });
    };
    req.onsuccess = e => { db = e.target.result; resolve(); };
    req.onerror = () => resolve();
  });
}

function saveToIndexedDB() {
  if (!db) return;
  try {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({ id: 'main', data: JSON.stringify(state), savedAt: Date.now() });
  } catch(e) {}
}

function loadState() {
  const saved = localStorage.getItem('cetTrackerState');
  if (saved) {
    try { state = { ...state, ...JSON.parse(saved) }; } catch(e) {}
  }
}

let saveCloudTimer = null;
function saveState() {
  localStorage.setItem('cetTrackerState', JSON.stringify(state));
  saveToIndexedDB();
  // Debounced cloud save — 3 seconds after last change
  clearTimeout(saveCloudTimer);
  saveCloudTimer = setTimeout(saveToCloud, 3000);
}

async function saveToCloud() {
  try {
    await fetch(`${API_BASE}/api/user?uid=${getUID()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
  } catch(e) { /* silent fail — localStorage is backup */ }
}

async function loadFromCloud() {
  try {
    const res = await fetch(`${API_BASE}/api/user?uid=${getUID()}`);
    const json = await res.json();
    if (json.success && json.data) {
      // Merge cloud data — cloud wins for XP/streak, keep local sessions if more
      const cloud = json.data;
      if ((cloud.xp || 0) >= (state.xp || 0)) {
        state = { ...state, ...cloud };
        localStorage.setItem('cetTrackerState', JSON.stringify(state));
      }
      return true;
    }
  } catch(e) {}
  return false;
}

// ===== ACHIEVEMENT POPUP =====
function showAchievementPopup(title, desc, icon = '🏆') {
  const existing = document.getElementById('ach-popup');
  if (existing) existing.remove();
  const popup = document.createElement('div');
  popup.id = 'ach-popup';
  popup.innerHTML = `<span style="font-size:2rem">${icon}</span><div><div style="font-weight:800;font-size:0.95rem">${title}</div><div style="font-size:0.8rem;opacity:0.85;margin-top:2px">${desc}</div></div>`;
  Object.assign(popup.style, {
    position:'fixed', bottom:'24px', right:'24px', zIndex:'9999',
    background:'linear-gradient(135deg,rgba(102,126,234,0.97),rgba(118,75,162,0.97))',
    backdropFilter:'blur(20px)', color:'#fff', borderRadius:'16px',
    padding:'16px 20px', display:'flex', alignItems:'center', gap:'14px',
    boxShadow:'0 8px 32px rgba(102,126,234,0.5)', maxWidth:'320px',
    border:'1px solid rgba(255,255,255,0.2)',
    transform:'translateX(120%)', transition:'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)'
  });
  document.body.appendChild(popup);
  setTimeout(() => popup.style.transform = 'translateX(0)', 50);
  setTimeout(() => { popup.style.transform = 'translateX(120%)'; setTimeout(() => popup.remove(), 400); }, 4000);
}

// ===== MONTHLY REPORT =====
function generateMonthlyReport(year, month) {
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const sessions = state.sessions.filter(s => s.date?.startsWith(monthKey));
  const totalSecs = sessions.reduce((a, s) => a + (s.duration || 0), 0);
  const activeDays = new Set(sessions.map(s => s.date)).size;
  const subjectMap = {};
  sessions.forEach(s => { subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.duration / 3600; });
  const sorted = Object.entries(subjectMap).sort((a, b) => b[1] - a[1]);
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return {
    month: monthNames[month], year, monthKey,
    totalHours: (totalSecs / 3600).toFixed(1),
    activeDays, sessions: sessions.length,
    subjects: subjectMap,
    bestSubject: sorted[0]?.[0] || '—',
    weakSubject: sorted[sorted.length - 1]?.[0] || '—',
    avgHoursPerDay: activeDays > 0 ? (totalSecs / 3600 / activeDays).toFixed(1) : 0
  };
}

function renderMonthlyReports() {
  const el = document.getElementById('monthly-reports');
  if (!el) return;
  const now = new Date();
  const reports = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    reports.push(generateMonthlyReport(d.getFullYear(), d.getMonth()));
  }
  el.innerHTML = reports.map(r => {
    const maxHrs = Math.max(...Object.values(r.subjects), 0.1);
    return `<div class="report-card glass card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-weight:800;font-size:1rem">${r.month} ${r.year}</span>
        <span style="font-size:1.4rem;font-weight:900;color:var(--accent)">${r.totalHours}h</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
        <div style="text-align:center;padding:8px;background:rgba(102,126,234,0.1);border-radius:10px"><div style="font-weight:800;font-size:1.1rem;color:var(--accent)">${r.activeDays}</div><div style="font-size:0.72rem;color:var(--text-muted)">Active Days</div></div>
        <div style="text-align:center;padding:8px;background:rgba(102,126,234,0.1);border-radius:10px"><div style="font-weight:800;font-size:1.1rem;color:var(--accent)">${r.sessions}</div><div style="font-size:0.72rem;color:var(--text-muted)">Sessions</div></div>
        <div style="text-align:center;padding:8px;background:rgba(102,126,234,0.1);border-radius:10px"><div style="font-weight:800;font-size:1.1rem;color:var(--accent)">${r.avgHoursPerDay}h</div><div style="font-size:0.72rem;color:var(--text-muted)">Daily Avg</div></div>
      </div>
      ${Object.entries(r.subjects).map(([sub, hrs]) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:0.82rem">
          <span style="width:80px;flex-shrink:0">${sub}</span>
          <div style="flex:1;height:6px;background:rgba(102,126,234,0.15);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${Math.round((hrs/maxHrs)*100)}%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:99px"></div>
          </div>
          <span style="width:36px;text-align:right;font-weight:700">${hrs.toFixed(1)}h</span>
        </div>`).join('')}
      ${r.weakSubject !== '—' ? `<div style="margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.1);border-radius:10px;font-size:0.8rem;color:#ef4444">⚠️ Weak: <strong>${r.weakSubject}</strong> — isko aur time do!</div>` : ''}
    </div>`;
  }).join('');
}

// ===== LEVELS — 50 levels, June 2027 tak khatam nahi hoga =====
const LEVELS = [
  { name: 'Naya Shuruat', min: 0 },
  { name: 'Curious Learner', min: 200 },
  { name: 'Padhai Starter', min: 500 },
  { name: 'Focus Seeker', min: 900 },
  { name: 'Consistent One', min: 1400 },
  { name: 'Rising Star', min: 2000 },
  { name: 'Grinder', min: 2700 },
  { name: 'Daily Warrior', min: 3500 },
  { name: 'Knowledge Hunter', min: 4400 },
  { name: 'Study Machine', min: 5400 },
  { name: 'Formula Master', min: 6500 },
  { name: 'Concept King', min: 7700 },
  { name: 'PYQ Crusher', min: 9000 },
  { name: 'Mock Test Hero', min: 10400 },
  { name: 'Physics Warrior', min: 11900 },
  { name: 'Chem Wizard', min: 13500 },
  { name: 'Math Ninja', min: 15200 },
  { name: 'Bio Expert', min: 17000 },
  { name: 'Topper Candidate', min: 18900 },
  { name: 'Rank Chaser', min: 20900 },
  { name: 'Elite Grinder', min: 23000 },
  { name: 'Unstoppable', min: 25200 },
  { name: 'CET Aspirant', min: 27500 },
  { name: 'Score Hunter', min: 29900 },
  { name: 'Percentile Seeker', min: 32400 },
  { name: 'Top 10% Target', min: 35000 },
  { name: 'Revision King', min: 37700 },
  { name: 'Speed Solver', min: 40500 },
  { name: 'Accuracy Master', min: 43400 },
  { name: 'Time Manager', min: 46400 },
  { name: 'Exam Ready', min: 49500 },
  { name: 'Beast Mode', min: 52700 },
  { name: 'Topper', min: 56000 },
  { name: 'Legend', min: 59400 },
  { name: 'CET Dominator', min: 62900 },
  { name: 'Rank 1 Mindset', min: 66500 },
  { name: 'Diamond Grinder', min: 70200 },
  { name: 'Platinum Scholar', min: 74000 },
  { name: 'Gold Medallist', min: 77900 },
  { name: 'Hall of Fame', min: 81900 },
  { name: 'Mythic Learner', min: 86000 },
  { name: 'Legendary Topper', min: 90200 },
  { name: 'CET Slayer', min: 94500 },
  { name: 'Supreme Scholar', min: 98900 },
  { name: 'Invincible', min: 103400 },
  { name: 'God Mode', min: 108000 },
  { name: 'Immortal Grinder', min: 112700 },
  { name: 'CET Champion', min: 117500 },
  { name: 'Ultimate Topper', min: 122400 },
  { name: '95%ile Achieved 🏆', min: 127400 },
];
function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) return i;
  }
  return 0;
}
function getLevelProgress(xp) {
  const idx = getLevel(xp);
  if (idx >= LEVELS.length - 1) return 100;
  const cur = LEVELS[idx].min;
  const next = LEVELS[idx + 1].min;
  return Math.min(100, ((xp - cur) / (next - cur)) * 100);
}
function getNextLevelXP(xp) {
  const idx = getLevel(xp);
  if (idx >= LEVELS.length - 1) return 0;
  return LEVELS[idx + 1].min - xp;
}

// ===== BADGES =====
const BADGES = [
  { id: 'first_session', icon: '🎯', name: 'First Step', desc: 'Complete first session', check: s => s.sessions.length >= 1 },
  { id: 'streak3', icon: '🔥', name: 'On Fire', desc: '3-day streak', check: s => s.streak >= 3 },
  { id: 'streak7', icon: '⚡', name: 'Week Warrior', desc: '7-day streak', check: s => s.streak >= 7 },
  { id: 'streak14', icon: '💪', name: 'Fortnight Fighter', desc: '14-day streak', check: s => s.streak >= 14 },
  { id: 'streak30', icon: '🏅', name: 'Monthly Legend', desc: '30-day streak', check: s => s.streak >= 30 },
  { id: 'streak60', icon: '👑', name: 'Unstoppable', desc: '60-day streak', check: s => s.streak >= 60 },
  { id: 'streak100', icon: '🌟', name: 'Century Grinder', desc: '100-day streak', check: s => s.streak >= 100 },
  { id: 'xp500', icon: '⭐', name: 'XP Hunter', desc: 'Earn 500 XP', check: s => s.xp >= 500 },
  { id: 'xp2000', icon: '💎', name: 'Diamond Grind', desc: 'Earn 2,000 XP', check: s => s.xp >= 2000 },
  { id: 'xp10000', icon: '🔮', name: 'XP Master', desc: 'Earn 10,000 XP', check: s => s.xp >= 10000 },
  { id: 'xp50000', icon: '🌈', name: 'XP God', desc: 'Earn 50,000 XP', check: s => s.xp >= 50000 },
  { id: 'sessions10', icon: '📚', name: 'Bookworm', desc: '10 sessions done', check: s => s.sessions.length >= 10 },
  { id: 'sessions50', icon: '📖', name: 'Scholar', desc: '50 sessions done', check: s => s.sessions.length >= 50 },
  { id: 'sessions100', icon: '🎓', name: 'Graduate', desc: '100 sessions done', check: s => s.sessions.length >= 100 },
  { id: 'hours10', icon: '⏰', name: 'Time Lord', desc: '10 hours total', check: () => getTotalHours() >= 10 },
  { id: 'hours50', icon: '🏆', name: 'Champion', desc: '50 hours total', check: () => getTotalHours() >= 50 },
  { id: 'hours100', icon: '💯', name: 'Century Club', desc: '100 hours total', check: () => getTotalHours() >= 100 },
  { id: 'hours500', icon: '🚀', name: 'Rocket Scholar', desc: '500 hours total', check: () => getTotalHours() >= 500 },
  { id: 'all_subjects', icon: '🌍', name: 'All Rounder', desc: 'Study all 4 subjects', check: s => new Set(s.sessions.map(x => x.subject)).size >= 4 },
  { id: 'level10', icon: '🎮', name: 'Level 10', desc: 'Reach Level 10', check: s => getLevel(s.xp) >= 9 },
  { id: 'level25', icon: '🎯', name: 'Level 25', desc: 'Reach Level 25', check: s => getLevel(s.xp) >= 24 },
  { id: 'level50', icon: '🏆', name: 'Max Level!', desc: 'Reach Level 50', check: s => getLevel(s.xp) >= 49 },
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
  if (name === 'reports') renderMonthlyReports();
  if (name === 'gallery') renderGallery();
  if (name === 'dashboard') { initDashboard(); }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
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
  const toNext = getNextLevelXP(state.xp);

  const fill = document.getElementById('sb-xp-fill');
  const lvlEl = document.getElementById('sb-level');
  const xpEl = document.getElementById('sb-xp');
  if (fill) fill.style.width = pct + '%';
  if (lvlEl) lvlEl.textContent = `Lv.${lvlIdx + 1} ${lvl.name}`;
  if (xpEl) xpEl.textContent = state.xp.toLocaleString() + ' XP';

  const dashXp = document.getElementById('dash-xp');
  if (dashXp) dashXp.textContent = state.xp.toLocaleString();

  // Update dash level card if exists
  const dashLvl = document.getElementById('dash-level-name');
  if (dashLvl) dashLvl.textContent = `Lv.${lvlIdx + 1} — ${lvl.name}`;
  const dashNext = document.getElementById('dash-xp-next');
  if (dashNext) dashNext.textContent = toNext > 0 ? `${toNext.toLocaleString()} XP to next level` : '🏆 Max Level!';
  const dashPct = document.getElementById('dash-xp-fill');
  if (dashPct) dashPct.style.width = pct + '%';
}

// ===== STREAK — Grace period system =====
function updateStreak() {
  const today = todayStr();
  if (state.lastStudyDate === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];
  let streak = state.streak || 0;

  if (state.lastStudyDate === yesterday) {
    streak++;
    state.streakFreezeUsed = false;
  } else if (state.lastStudyDate === twoDaysAgo && !state.streakFreezeUsed) {
    streak++;
    state.streakFreezeUsed = true;
    showAchievementPopup('🧊 Streak Freeze Used!', 'Ek din miss hua but streak bachi!', '🧊');
  } else if (!state.lastStudyDate) {
    streak = 1;
  } else {
    if (streak >= 3) showAchievementPopup('💔 Streak Broken', `${streak} din ki streak toot gayi. Naya shuru kar!`, '😤');
    streak = 1;
    state.streakFreezeUsed = false;
  }

  if (streak > (state.longestStreak || 0)) state.longestStreak = streak;
  state.streak = streak;
  state.lastStudyDate = today;
  saveState();
  const el = document.getElementById('dash-streak');
  if (el) el.textContent = streak;
}

function checkStreakOnLoad() {
  if (!state.lastStudyDate) return;
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];
  if (state.lastStudyDate < twoDaysAgo && !state.streakFreezeUsed) {
    if (state.streak > 0) {
      state.streak = 0;
      state.streakFreezeUsed = false;
      saveState();
    }
  }
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
  const earned = state.earnedBadges || [];
  el.innerHTML = BADGES.map(b => {
    const isEarned = b.check(state);
    if (isEarned && !earned.includes(b.id)) {
      earned.push(b.id);
      state.earnedBadges = earned;
      setTimeout(() => showAchievementPopup(`${b.name}`, b.desc, b.icon), 500);
      saveState();
    }
    return `<div class="badge-item ${isEarned ? 'earned' : ''}" title="${b.desc}">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-name">${b.name}</div>
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
    <div class="session-history-item">
      <span class="session-subject-tag">${s.subject}</span>
      <div class="session-info">
        <div class="session-topic-text">${s.topic || 'General'}</div>
        <div class="session-meta">${s.date} ${s.time || ''}</div>
      </div>
      <div style="text-align:right">
        <div class="session-duration">${fmtTime(s.duration)}</div>
        <div style="font-size:0.75rem;color:var(--amber);font-weight:700">+${s.xp} XP</div>
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
  const uid = document.getElementById('setting-uid');
  if (uid) uid.value = getUID();
}

function updateUID(val) {
  if (val.trim().length > 3) {
    localStorage.setItem('cet_uid', val.trim());
    // Reload from cloud with new UID
    loadFromCloud().then(synced => {
      if (synced) { initDashboard(); updateXPUI(); showAchievementPopup('🔄 Synced!', 'Data loaded from cloud', '☁️'); }
    });
  }
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

    // Format hours nicely: show Xh Ym or just day number
    let hrsLabel = '';
    if (hrs > 0) {
      const h = Math.floor(hrs);
      const m = Math.round((hrs - h) * 60);
      hrsLabel = h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;
    }

    html += `<div class="${cls}" title="${dateStr}${hrs > 0 ? ' — ' + hrsLabel + ' studied' : ''}">
      <span class="cal-day-num">${d}</span>
      ${hrsLabel ? `<span class="cal-day-hrs">${hrsLabel}</span>` : ''}
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
      <div class="task-checkbox ${t.done ? 'done' : ''}" onclick="toggleTask(${t.id})">${t.done ? '✓' : ''}</div>
      <span class="task-text">${t.text}</span>
      <span class="priority-tag ${t.priority}">${t.priority}</span>
      <button class="task-delete" onclick="deleteTask(${t.id})">✕</button>
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
        <div class="mistake-text">${m.text}</div>
        <div class="mistake-date">${m.date}</div>
      </div>
      <span class="mistake-subject-tag">${m.subject}</span>
      <button class="task-delete" onclick="deleteMistake(${m.id})" style="margin-left:8px">✕</button>
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
      <div class="goal-icon">🎯</div>
      <div class="goal-info">
        <div class="goal-text" style="${g.done ? 'text-decoration:line-through;opacity:0.5' : ''}">${g.text}</div>
        ${g.target ? `<div class="goal-target">Target: ${g.target}</div>` : ''}
      </div>
      <div class="task-checkbox ${g.done ? 'done' : ''}" onclick="toggleGoal(${g.id})" style="cursor:pointer">${g.done ? '✓' : ''}</div>
      <button class="task-delete" onclick="deleteGoal(${g.id})">✕</button>
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
    const ph = document.getElementById('vision-placeholder');
    if (ph) ph.style.display = 'none';
    if (vd && !vd.querySelector('img')) {
      const img = document.createElement('img');
      img.src = state.visionImage;
      img.style.cssText = 'width:100%;height:200px;object-fit:cover;border-radius:12px;display:block;';
      vd.appendChild(img);
    }
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
    const ph = document.getElementById('vision-placeholder');
    if (ph) ph.style.display = 'none';
    if (vd) {
      // Remove old img if any
      const old = vd.querySelector('img');
      if (old) old.remove();
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:100%;height:200px;object-fit:cover;border-radius:12px;display:block;';
      vd.appendChild(img);
    }
    showAchievementPopup('📸 Vision saved!', 'Roz dekh isko — yaad rakhega kyun padh raha hai', '❤️');
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
  if (resultsEl) resultsEl.innerHTML = `
    <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.85rem;">
      <div style="font-size:1.5rem;margin-bottom:8px;">🔍</div>Searching...
    </div>`;

  const API_BASE = 'https://yt-api-theta.vercel.app';

  try {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=12`);
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    const songs = data.results || [];
    playlist = songs;

    if (!resultsEl) return;
    if (!playlist.length) {
      resultsEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.85rem;">No results found. Try another search.</div>`;
      return;
    }

    resultsEl.innerHTML = playlist.map((s, i) => `
      <div id="result-${i}" onclick="playSong(${i})" style="
        display:flex;align-items:center;gap:10px;padding:10px 12px;
        border-radius:10px;cursor:pointer;transition:background 0.15s;
        border-bottom:1px solid var(--border);
      " onmouseover="this.style.background='var(--bg-hover)'" onmouseout="if(currentTrack!==${i})this.style.background='transparent'">
        <img src="${s.thumbnail || 'https://placehold.co/44x44/6366f1/fff?text=♪'}"
          onerror="this.src='https://placehold.co/44x44/6366f1/fff?text=♪'"
          style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;"/>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text);">${s.title}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${s.artist} · ${s.duration}</div>
        </div>
        <span style="color:var(--accent);font-size:1rem;flex-shrink:0;">▶</span>
      </div>`).join('');
  } catch(e) {
    console.error('Music search error:', e);
    if (resultsEl) resultsEl.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--danger);font-size:0.85rem;">
        ❌ Search failed: ${e.message}
      </div>`;
  }
}

async function playSong(index) {
  if (index < 0 || index >= playlist.length) return;
  currentTrack = index;
  const song = playlist[index];

  // Highlight selected row
  document.querySelectorAll('[id^="result-"]').forEach((el, i) => {
    el.style.background = i === index ? 'rgba(99,102,241,0.12)' : 'transparent';
  });

  // Update song info
  document.getElementById('player-title').textContent = song.title;
  document.getElementById('player-artist').textContent = song.artist + ' · ' + song.duration;

  // Load YouTube iframe
  const iframe = document.getElementById('yt-iframe');
  const wrap = document.getElementById('yt-player-wrap');
  if (iframe && wrap) {
    iframe.src = `https://www.youtube.com/embed/${song.id}?autoplay=1&rel=0&modestbranding=1`;
    wrap.style.display = 'block';
  }
  isPlaying = true;
}

function togglePlay() {
  // With iframe, user controls via YouTube player UI
  const wrap = document.getElementById('yt-player-wrap');
  if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
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

// ===== GALLERY =====
async function renderGallery() {
  const el = document.getElementById('gallery-grid');
  if (!el) return;
  el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted)">Loading...</div>`;
  try {
    const res = await fetch(`${API_BASE}/api/gallery?uid=${getUID()}`);
    const data = await res.json();
    const items = data.items || [];
    if (!items.length) {
      el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">
        <div style="font-size:2.5rem;margin-bottom:8px;">🖼️</div>
        <div style="font-weight:600;">No images yet</div>
        <div style="font-size:0.8rem;margin-top:4px;">Upload your first image above</div>
      </div>`;
      return;
    }
    el.innerHTML = items.map(item => `
      <div class="gallery-item" style="position:relative;border-radius:12px;overflow:hidden;background:var(--bg-hover);aspect-ratio:1;">
        <img src="${item.url}" alt="${item.caption || ''}"
          style="width:100%;height:100%;object-fit:cover;display:block;"/>
        ${item.caption ? `<div style="position:absolute;bottom:0;left:0;right:0;padding:8px 10px;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:#fff;font-size:0.75rem;font-weight:500;">${item.caption}</div>` : ''}
        <button onclick="deleteGalleryItem('${item._id}')" style="position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:0.8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--danger);">Failed to load: ${e.message}</div>`;
  }
}

async function uploadGalleryImage() {
  const fileInput = document.getElementById('gallery-upload');
  const caption = document.getElementById('gallery-caption').value.trim();
  const file = fileInput.files[0];
  if (!file) return;

  const btn = document.getElementById('gallery-upload-btn');
  btn.textContent = 'Uploading...';
  btn.disabled = true;

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      const mimeType = file.type;
      const res = await fetch(`${API_BASE}/api/gallery?uid=${getUID()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, caption, mimeType })
      });
      const data = await res.json();
      if (data.success) {
        fileInput.value = '';
        document.getElementById('gallery-caption').value = '';
        showAchievementPopup('📸 Image Saved!', 'Gallery mein add ho gaya', '🖼️');
        renderGallery();
      }
      btn.textContent = '📤 Upload';
      btn.disabled = false;
    };
    reader.readAsDataURL(file);
  } catch(e) {
    btn.textContent = '📤 Upload';
    btn.disabled = false;
    alert('Upload failed: ' + e.message);
  }
}

async function deleteGalleryItem(id) {
  if (!confirm('Delete this image?')) return;
  try {
    await fetch(`${API_BASE}/api/gallery?uid=${getUID()}&id=${id}`, { method: 'DELETE' });
    renderGallery();
  } catch(e) { alert('Delete failed'); }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async function() {
  await initIndexedDB();
  loadState();
  checkStreakOnLoad();

  // Try cloud sync
  loadFromCloud().then(synced => {
    if (synced) {
      initDashboard();
      updateXPUI();
    }
  });

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
