export const STORAGE_KEY = 'mentalmath-arcade-v2';
export const GAME_DURATION_MS = 60_000;
export const QUESTIONS_PER_LEVEL = 5;
export const LEADERBOARD_LIMIT = 10;

export const achievementsCatalog = [
  {
    id: 'first-correct',
    icon: '✨',
    title: 'First Spark',
    description: 'Get your first answer correct.',
    check: (stats) => stats.correctAnswers >= 1,
  },
  {
    id: 'streak-5',
    icon: '🔥',
    title: 'Heat Check',
    description: 'Reach a streak of 5.',
    check: (stats) => stats.bestStreak >= 5,
  },
  {
    id: 'streak-10',
    icon: '⚡',
    title: 'Combo Storm',
    description: 'Reach a streak of 10.',
    check: (stats) => stats.bestStreak >= 10,
  },
  {
    id: 'accuracy-ace',
    icon: '🎯',
    title: 'Accuracy Ace',
    description: 'Finish with at least 90% accuracy over 15 answers.',
    check: (stats) => stats.totalAnswered >= 15 && stats.accuracy >= 90,
  },
  {
    id: 'speed-runner',
    icon: '🏎️',
    title: 'Speed Runner',
    description: 'Average under 2.5 seconds per answer over 10 answers.',
    check: (stats) => stats.totalAnswered >= 10 && stats.averageTime > 0 && stats.averageTime <= 2.5,
  },
  {
    id: 'score-5000',
    icon: '👑',
    title: 'Score Surge',
    description: 'Score at least 5000 points in one run.',
    check: (stats) => stats.score >= 5000,
  },
  {
    id: 'daily-champion',
    icon: '📆',
    title: 'Daily Champion',
    description: 'Finish a daily challenge session.',
    check: (stats) => stats.mode === 'daily' && stats.finished,
  },
  {
    id: 'level-5',
    icon: '🧠',
    title: 'Mind Unlocked',
    description: 'Reach level 5 in a session.',
    check: (stats) => stats.level >= 5,
  },
];

const defaultData = {
  settings: {
    theme: 'dark',
    soundEnabled: true,
    lastDifficulty: 'easy',
    lastMode: 'classic',
  },
  leaderboard: [],
  achievements: [],
  bestScores: {
    easy: 0,
    medium: 0,
    hard: 0,
  },
  dailyBest: {
    date: '',
    score: 0,
  },
  lastRun: null,
};

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

export function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

export function hashString(value) {
  let hash = 1779033703 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

export function mulberry32(seed) {
  return function random() {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDailyRng(difficulty) {
  const seedFactory = hashString(`daily-${getTodayKey()}-${difficulty}`);
  return mulberry32(seedFactory());
}

export function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function chooseOne(items, rng = Math.random) {
  return items[randomInt(0, items.length - 1, rng)];
}

function normalizeEntry(entry, index) {
  return {
    score: Number(entry?.score) || 0,
    difficulty: ['easy', 'medium', 'hard'].includes(entry?.difficulty) ? entry.difficulty : 'easy',
    mode: entry?.mode === 'daily' ? 'daily' : 'classic',
    date: entry?.date || getTodayKey(),
    rank: index + 1,
  };
}

export function loadAppData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') {
      return structuredClone(defaultData);
    }

    return {
      settings: {
        theme: saved.settings?.theme === 'light' ? 'light' : 'dark',
        soundEnabled: saved.settings?.soundEnabled !== false,
        lastDifficulty: ['easy', 'medium', 'hard'].includes(saved.settings?.lastDifficulty)
          ? saved.settings.lastDifficulty
          : 'easy',
        lastMode: saved.settings?.lastMode === 'daily' ? 'daily' : 'classic',
      },
      leaderboard: Array.isArray(saved.leaderboard)
        ? saved.leaderboard.map(normalizeEntry).sort((left, right) => right.score - left.score).map(normalizeEntry)
        : [],
      achievements: Array.isArray(saved.achievements)
        ? saved.achievements.filter((id) => achievementsCatalog.some((achievement) => achievement.id === id))
        : [],
      bestScores: {
        easy: Number(saved.bestScores?.easy) || 0,
        medium: Number(saved.bestScores?.medium) || 0,
        hard: Number(saved.bestScores?.hard) || 0,
      },
      dailyBest: {
        date: saved.dailyBest?.date || '',
        score: Number(saved.dailyBest?.score) || 0,
      },
      lastRun: saved.lastRun
        ? {
            score: Number(saved.lastRun.score) || 0,
            accuracy: Number(saved.lastRun.accuracy) || 0,
            totalAnswered: Number(saved.lastRun.totalAnswered) || 0,
            bestStreak: Number(saved.lastRun.bestStreak) || 0,
            averageTime: Number(saved.lastRun.averageTime) || 0,
            difficulty: ['easy', 'medium', 'hard'].includes(saved.lastRun.difficulty)
              ? saved.lastRun.difficulty
              : 'easy',
            mode: saved.lastRun.mode === 'daily' ? 'daily' : 'classic',
            date: saved.lastRun.date || getTodayKey(),
          }
        : null,
    };
  } catch {
    return structuredClone(defaultData);
  }
}

export function saveAppData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export function updateToggleButtons(data) {
  const themeToggle = document.getElementById('themeToggle');
  const soundToggle = document.getElementById('soundToggle');

  if (themeToggle) {
    themeToggle.textContent = data.settings.theme === 'dark' ? '🌙' : '☀️';
  }

  if (soundToggle) {
    soundToggle.textContent = data.settings.soundEnabled ? '🔊' : '🔇';
  }
}

export function initShell(activeNav) {
  const data = loadAppData();
  applyTheme(data.settings.theme);
  updateToggleButtons(data);

  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === activeNav);
  });

  const themeToggle = document.getElementById('themeToggle');
  const soundToggle = document.getElementById('soundToggle');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      data.settings.theme = data.settings.theme === 'dark' ? 'light' : 'dark';
      applyTheme(data.settings.theme);
      updateToggleButtons(data);
      saveAppData(data);
    });
  }

  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      data.settings.soundEnabled = !data.settings.soundEnabled;
      updateToggleButtons(data);
      saveAppData(data);
    });
  }

  return data;
}

export function triggerHaptics(type = 'tap') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }

  const pattern = {
    tap: 10,
    soft: 16,
    success: [18, 24, 34],
    error: [28, 18, 28],
    finish: [20, 30, 20, 30, 42],
  }[type] || 10;

  navigator.vibrate(pattern);
}

export function buildPlayUrl(difficulty, mode) {
  const params = new URLSearchParams({ difficulty, mode });
  return `play.html?${params.toString()}`;
}

export function getQueryGameConfig() {
  const params = new URLSearchParams(window.location.search);
  const difficulty = params.get('difficulty');
  const mode = params.get('mode');
  return {
    difficulty: ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : null,
    mode: mode === 'daily' ? 'daily' : mode === 'classic' ? 'classic' : null,
  };
}

export function summarizeData(data) {
  const totalRuns = data.leaderboard.length;
  const lifetimeBest = data.leaderboard[0]?.score || 0;
  const averageScore = totalRuns
    ? Math.round(data.leaderboard.reduce((sum, entry) => sum + entry.score, 0) / totalRuns)
    : 0;

  return {
    totalRuns,
    lifetimeBest,
    averageScore,
    unlockedCount: data.achievements.length,
  };
}

export function renderAchievementCards(container, data) {
  if (!container) {
    return;
  }

  container.innerHTML = achievementsCatalog
    .map((achievement) => {
      const unlocked = data.achievements.includes(achievement.id);
      return `
        <article class="achievement ${unlocked ? '' : 'locked'}">
          <div class="achievement-icon">${achievement.icon}</div>
          <div>
            <strong>${achievement.title}</strong>
            <p class="subtle">${achievement.description}</p>
          </div>
        </article>
      `;
    })
    .join('');
}

export function renderLeaderboard(container, data, limit = LEADERBOARD_LIMIT) {
  if (!container) {
    return;
  }

  if (!data.leaderboard.length) {
    container.innerHTML = '<li class="subtle">No runs yet. Start your first challenge.</li>';
    return;
  }

  container.innerHTML = data.leaderboard
    .slice(0, limit)
    .map(
      (entry, index) => `
        <li>
          <div class="leaderboard-entry">
            <div>
              <strong>${formatNumber(entry.score)}</strong>
              <div class="leaderboard-meta">${capitalize(entry.difficulty)} · ${capitalize(entry.mode)} · ${entry.date}</div>
            </div>
            <span>#${index + 1}</span>
          </div>
        </li>
      `
    )
    .join('');
}

export function unlockAchievements(data, stats) {
  achievementsCatalog.forEach((achievement) => {
    if (!data.achievements.includes(achievement.id) && achievement.check(stats)) {
      data.achievements.push(achievement.id);
    }
  });
}

export function recordRun(data, stats) {
  if (stats.score > data.bestScores[stats.difficulty]) {
    data.bestScores[stats.difficulty] = stats.score;
  }

  if (stats.mode === 'daily') {
    const today = getTodayKey();
    if (today !== data.dailyBest.date || stats.score > data.dailyBest.score) {
      data.dailyBest = { date: today, score: stats.score };
    }
  }

  data.lastRun = {
    score: stats.score,
    accuracy: stats.accuracy,
    totalAnswered: stats.totalAnswered,
    bestStreak: stats.bestStreak,
    averageTime: stats.averageTime,
    difficulty: stats.difficulty,
    mode: stats.mode,
    date: getTodayKey(),
  };

  data.leaderboard = [...data.leaderboard, {
    score: stats.score,
    difficulty: stats.difficulty,
    mode: stats.mode,
    date: getTodayKey(),
  }]
    .sort((left, right) => right.score - left.score)
    .slice(0, LEADERBOARD_LIMIT)
    .map(normalizeEntry);

  unlockAchievements(data, stats);
  saveAppData(data);
}

export function playTone(soundEnabled, type) {
  if (!soundEnabled) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  if (!playTone.audioContext) {
    playTone.audioContext = new AudioContextClass();
  }

  const context = playTone.audioContext;
  if (context.state === 'suspended') {
    context.resume().catch(() => {});
  }
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const config = {
    tap: { frequency: 280, duration: 0.035, gain: 0.024, type: 'triangle', endFrequency: 220 },
    success: { frequency: 620, duration: 0.12, gain: 0.05, type: 'sine', endFrequency: 880 },
    error: { frequency: 190, duration: 0.16, gain: 0.038, type: 'sawtooth', endFrequency: 120 },
    finish: { frequency: 420, duration: 0.24, gain: 0.045, type: 'square', endFrequency: 680 },
  }[type];

  if (!config) {
    return;
  }

  oscillator.type = config.type;
  oscillator.frequency.setValueAtTime(config.frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(config.endFrequency, now + config.duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(config.gain, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + config.duration);
}
