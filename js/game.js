/**
 * game.js – MentalMath Game Engine
 *
 * Modules (all plain classes / objects, no bundler needed):
 *   CONFIG            – global constants
 *   SeededRNG         – deterministic RNG for the Daily Challenge
 *   QuestionGenerator – generates math problems per difficulty
 *   ACHIEVEMENTS      – achievement definitions
 *   StorageManager    – localStorage wrapper
 *   GameState         – mutable state for a single game session
 *   MentalMathGame    – main controller wiring everything together
 */

'use strict';

/* ============================================================
   CONFIG
   ============================================================ */
const CONFIG = {
  GAME_DURATION:      60,   // seconds for Classic mode
  BASE_SCORE:         100,  // base points per correct answer
  TIME_BONUS_MAX:     50,   // maximum bonus points for fast answers
  STREAK_MULTIPLIER:  3,    // streak threshold before x2 multiplier starts
  MAX_ANSWER_LENGTH:  6,    // maximum digits the player can type
};

/* ============================================================
   SEEDED RANDOM NUMBER GENERATOR
   Used for Daily Challenge so every player gets the same problems.
   Algorithm: linear congruential generator (LCG)
   ============================================================ */
class SeededRNG {
  constructor(seed) {
    this.seed = seed >>> 0; // treat as 32-bit unsigned integer
  }

  /** Returns a float in [0, 1). */
  next() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Returns a random integer in [min, max] (inclusive). */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a random element from an array. */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/* ============================================================
   QUESTION GENERATOR
   Generates arithmetic problems tailored to each difficulty and
   in-game level. The level parameter (1–10) gradually increases
   operand sizes and introduces harder operations.
   ============================================================ */
class QuestionGenerator {
  /**
   * @param {'easy'|'medium'|'hard'} difficulty
   * @param {number|null} seed – pass a numeric seed for Daily mode
   */
  constructor(difficulty, seed = null) {
    this.difficulty = difficulty;
    this.rng = seed !== null ? new SeededRNG(seed) : null;
  }

  // ── Helpers ─────────────────────────────────────────────────

  _rand(min, max) {
    return this.rng ? this.rng.nextInt(min, max) : Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _pick(arr) {
    return this.rng ? this.rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)];
  }

  /** Convert internal operator symbols to display characters. */
  static _displayOp(op) {
    return op === '*' ? '×' : op === '/' ? '÷' : op;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Generate one question object.
   * @param {number} level – current in-game level (1–10)
   * @returns {{ question: string, answer: number }}
   */
  generate(level = 1) {
    switch (this.difficulty) {
      case 'medium': return this._medium(level);
      case 'hard':   return this._hard(level);
      default:       return this._easy(level);
    }
  }

  // ── Easy: addition & subtraction, small numbers ─────────────
  _easy(level) {
    const max = Math.min(10 + level * 4, 50);
    const op  = this._pick(['+', '-']);
    let a = this._rand(1, max);
    let b = this._rand(1, max);
    if (op === '-' && a < b) [a, b] = [b, a]; // keep result ≥ 0
    const answer = op === '+' ? a + b : a - b;
    return { question: `${a} ${op} ${b}`, answer };
  }

  // ── Medium: all four operations, moderate numbers ────────────
  _medium(level) {
    // Unlock division once level ≥ 3
    const ops  = level >= 3 ? ['+', '-', '×', '÷'] : ['+', '-', '×'];
    const opSym = this._pick(ops);
    let a, b, answer;

    if (opSym === '×') {
      a = this._rand(2, Math.min(12, 8 + level));
      b = this._rand(2, Math.min(12, 8 + level));
      answer = a * b;
    } else if (opSym === '÷') {
      b      = this._rand(2, 12);
      answer = this._rand(2, 12);
      a      = b * answer; // guarantees integer result
    } else {
      const max = Math.min(20 + level * 8, 150);
      a = this._rand(1, max);
      b = this._rand(1, max);
      if (opSym === '-' && a < b) [a, b] = [b, a];
      answer = opSym === '+' ? a + b : a - b;
    }

    return { question: `${a} ${opSym} ${b}`, answer };
  }

  // ── Hard: larger numbers + 3-term expressions ───────────────
  _hard(level) {
    // Mix of 2-term and 3-term based on level
    const useThree = level >= 3 || this._rand(0, 1) === 1;
    return useThree ? this._hardThreeTerm(level) : this._hardTwoTerm(level);
  }

  _hardTwoTerm(level) {
    const opSym = this._pick(['+', '-', '×', '÷']);
    const max   = Math.min(30 + level * 15, 500);
    let a, b, answer;

    if (opSym === '×') {
      a = this._rand(10, Math.min(50, 20 + level * 5));
      b = this._rand(2, 15);
      answer = a * b;
    } else if (opSym === '÷') {
      b      = this._rand(2, 20);
      answer = this._rand(5, 25);
      a      = b * answer;
    } else {
      a = this._rand(50, max);
      b = this._rand(50, max);
      if (opSym === '-' && a < b) [a, b] = [b, a];
      answer = opSym === '+' ? a + b : a - b;
    }

    return { question: `${a} ${opSym} ${b}`, answer };
  }

  /**
   * Generates a 3-term expression following standard operator precedence:
   *   (a × b) +/- c  or  a +/- b +/- c
   * The displayed expression is correct under PEMDAS/BODMAS.
   */
  _hardThreeTerm(level) {
    const op1Sym = this._pick(['+', '-', '×']);
    const op2Sym = this._pick(['+', '-']); // second op is always +/−
    let a, b, c, intermediate;

    if (op1Sym === '×') {
      a            = this._rand(2, 12 + level);
      b            = this._rand(2, 12 + level);
      intermediate = a * b;
    } else {
      const max = Math.min(30 + level * 10, 200);
      a = this._rand(10, max);
      b = this._rand(10, max);
      if (op1Sym === '-' && a < b) [a, b] = [b, a];
      intermediate = op1Sym === '+' ? a + b : a - b;
    }

    c = this._rand(1, Math.max(1, Math.floor(intermediate / 2)));
    if (op2Sym === '-' && intermediate < c) c = this._rand(1, Math.max(1, intermediate));
    const answer = op2Sym === '+' ? intermediate + c : intermediate - c;

    const question = `${a} ${op1Sym} ${b} ${op2Sym} ${c}`;
    return { question, answer };
  }
}

/* ============================================================
   ACHIEVEMENTS
   Each achievement has a unique id, display info, and a
   condition function that receives the end-of-game stats object.
   ============================================================ */
const ACHIEVEMENTS = [
  {
    id: 'first_correct',
    name: 'First Steps',
    desc: 'Get your first correct answer',
    icon: '🎯',
    condition: s => s.totalCorrect >= 1,
  },
  {
    id: 'streak_5',
    name: 'On Fire!',
    desc: 'Reach a streak of 5',
    icon: '🔥',
    condition: s => s.bestStreak >= 5,
  },
  {
    id: 'streak_10',
    name: 'Blazing!',
    desc: 'Reach a streak of 10',
    icon: '🌟',
    condition: s => s.bestStreak >= 10,
  },
  {
    id: 'streak_20',
    name: 'Unstoppable!',
    desc: 'Reach a streak of 20',
    icon: '⚡',
    condition: s => s.bestStreak >= 20,
  },
  {
    id: 'score_500',
    name: 'Good Start',
    desc: 'Score 500 points in one game',
    icon: '💯',
    condition: s => s.gameScore >= 500,
  },
  {
    id: 'score_1000',
    name: 'Math Wizard',
    desc: 'Score 1,000 points in one game',
    icon: '🧙',
    condition: s => s.gameScore >= 1000,
  },
  {
    id: 'score_2000',
    name: 'Grand Master',
    desc: 'Score 2,000 points in one game',
    icon: '👑',
    condition: s => s.gameScore >= 2000,
  },
  {
    id: 'accuracy_100',
    name: 'Perfectionist',
    desc: '100% accuracy (10+ questions)',
    icon: '💎',
    condition: s => s.accuracy === 100 && s.totalAnswered >= 10,
  },
  {
    id: 'accuracy_90',
    name: 'Sharpshooter',
    desc: '90%+ accuracy (10+ questions)',
    icon: '🎖️',
    condition: s => s.accuracy >= 90 && s.totalAnswered >= 10,
  },
  {
    id: 'correct_20',
    name: 'Speed Demon',
    desc: 'Answer 20 questions correctly in one game',
    icon: '💨',
    condition: s => s.totalCorrect >= 20,
  },
  {
    id: 'correct_50',
    name: 'Machine',
    desc: 'Answer 50 questions correctly in one game',
    icon: '🤖',
    condition: s => s.totalCorrect >= 50,
  },
  {
    id: 'hard_complete',
    name: 'Brave',
    desc: 'Complete a game on Hard difficulty',
    icon: '🦁',
    condition: s => s.difficulty === 'hard' && s.totalAnswered > 0,
  },
  {
    id: 'daily_complete',
    name: 'Daily Grind',
    desc: 'Complete a Daily Challenge',
    icon: '📅',
    condition: s => s.mode === 'daily' && s.totalAnswered > 0,
  },
  {
    id: 'endless_100',
    name: 'Marathon',
    desc: 'Answer 100 questions in Endless mode',
    icon: '🏃',
    condition: s => s.mode === 'endless' && s.totalAnswered >= 100,
  },
];

/* ============================================================
   STORAGE MANAGER
   Thin wrapper around localStorage with JSON serialisation.
   ============================================================ */
class StorageManager {
  constructor() {
    this._prefix = 'mentalmath_';
  }

  _key(k)  { return this._prefix + k; }

  get(key) {
    try {
      const v = localStorage.getItem(this._key(key));
      return v ? JSON.parse(v) : null;
    } catch (_) { return null; }
  }

  set(key, value) {
    try {
      localStorage.setItem(this._key(key), JSON.stringify(value));
    } catch (_) { /* storage full – silently ignore */ }
  }

  // ── High Scores ────────────────────────────────────────────

  getHighScores(difficulty) {
    return this.get(`scores_${difficulty}`) || [];
  }

  /**
   * Add a score entry and keep the top-10.
   * @returns {boolean} true if it's a new #1 record
   */
  addHighScore(difficulty, score, meta) {
    if (score <= 0) return false;
    const scores = this.getHighScores(difficulty);
    scores.push({
      score,
      accuracy: meta.accuracy,
      streak:   meta.bestStreak,
      correct:  meta.totalCorrect,
      mode:     meta.mode,
      date:     new Date().toLocaleDateString(),
    });
    scores.sort((a, b) => b.score - a.score);
    scores.splice(10); // keep top-10
    this.set(`scores_${difficulty}`, scores);
    return scores[0].score === score;
  }

  // ── Achievements ───────────────────────────────────────────

  getUnlockedAchievements() {
    return this.get('achievements') || [];
  }

  /**
   * Mark an achievement as unlocked.
   * @returns {boolean} true if it was newly unlocked
   */
  unlockAchievement(id) {
    const list = this.getUnlockedAchievements();
    if (list.includes(id)) return false;
    list.push(id);
    this.set('achievements', list);
    return true;
  }

  // ── Settings ───────────────────────────────────────────────

  getSettings() {
    return this.get('settings') || { theme: 'dark', sound: true };
  }

  saveSettings(settings) {
    this.set('settings', settings);
  }

  // ── Daily Challenge ────────────────────────────────────────

  getDailyProgress() {
    const today = new Date().toDateString();
    return this.get(`daily_${today}`) || null;
  }

  saveDailyProgress(score) {
    const today = new Date().toDateString();
    this.set(`daily_${today}`, { score, completed: true });
  }

  // ── Global Stats (all-time) ────────────────────────────────

  getGlobalStats() {
    return this.get('global_stats') || {
      gamesPlayed:    0,
      totalCorrect:   0,
      totalAnswered:  0,
      bestScore:      0,
      bestStreak:     0,
    };
  }

  updateGlobalStats(gs) {
    const s = this.getGlobalStats();
    s.gamesPlayed   += 1;
    s.totalCorrect  += gs.totalCorrect;
    s.totalAnswered += gs.totalAnswered;
    s.bestScore      = Math.max(s.bestScore,  gs.gameScore);
    s.bestStreak     = Math.max(s.bestStreak, gs.bestStreak);
    this.set('global_stats', s);
  }
}

/* ============================================================
   GAME STATE
   Holds all mutable data for one active game session.
   ============================================================ */
class GameState {
  constructor() { this.reset(); }

  reset() {
    this.score            = 0;
    this.streak           = 0;
    this.bestStreak       = 0;
    this.level            = 1;
    this.totalCorrect     = 0;
    this.totalAnswered    = 0;
    this.totalTimeMs      = 0;   // sum of milliseconds spent answering
    this.questionStartMs  = 0;
    this.currentAnswer    = '';
    this.timeLeft         = CONFIG.GAME_DURATION;
    this.isPlaying        = false;
    this.difficulty       = 'easy';
    this.mode             = 'classic';
    this.newUnlocks       = [];
  }

  /** Accuracy as an integer percentage (0–100). */
  get accuracy() {
    if (this.totalAnswered === 0) return 0;
    return Math.round((this.totalCorrect / this.totalAnswered) * 100);
  }

  /** Average seconds per answer, formatted to one decimal. */
  get avgTime() {
    if (this.totalAnswered === 0) return '0.0';
    return (this.totalTimeMs / this.totalAnswered / 1000).toFixed(1);
  }

  /**
   * Current score multiplier based on streak length:
   *   streak < STREAK_MULTIPLIER → 1×
   *   streak >= STREAK_MULTIPLIER → 2×
   *   streak >= 2×STREAK_MULTIPLIER → 3×
   *   streak >= 4×STREAK_MULTIPLIER → 4×
   */
  get multiplier() {
    const t = CONFIG.STREAK_MULTIPLIER;
    if (this.streak >= t * 4) return 4;
    if (this.streak >= t * 2) return 3;
    if (this.streak >= t)     return 2;
    return 1;
  }

  /**
   * Compute points for a single correct answer.
   * Faster answers earn a time bonus; the whole result is scaled
   * by the current streak multiplier.
   * @param {number} timeTakenMs
   * @returns {number}
   */
  pointsFor(timeTakenMs) {
    const timeBonus = Math.max(0, CONFIG.TIME_BONUS_MAX - Math.floor(timeTakenMs / 200));
    return Math.round((CONFIG.BASE_SCORE + timeBonus) * this.multiplier);
  }
}

/* ============================================================
   MENTAL MATH GAME  – main controller
   ============================================================ */
class MentalMathGame {
  constructor() {
    this.state     = new GameState();
    this.storage   = new StorageManager();
    this.sound     = new SoundManager(); // defined in sounds.js

    /** @type {QuestionGenerator|null} */
    this.generator = null;

    /** @type {{ question: string, answer: number }|null} */
    this.currentQ  = null;

    /** @type {number|null} – setInterval id for the countdown timer */
    this._timerID  = null;

    this._loadSettings();
    this._bindEvents();
    this._showScreen('home');
    this._refreshHomeMeta();
  }

  /* ==========================================================
     INITIALISATION
     ========================================================== */

  /** Apply persisted theme / sound state. */
  _loadSettings() {
    const s = this.storage.getSettings();
    document.body.setAttribute('data-theme', s.theme);
    this.sound.toggle(s.sound);
    this._setThemeIcon(s.theme);
    this._setSoundIcon(s.sound);
  }

  _setThemeIcon(theme) {
    const btn = document.getElementById('btn-toggle-theme');
    if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  _setSoundIcon(enabled) {
    const btn = document.getElementById('btn-toggle-sound');
    if (btn) btn.textContent = enabled ? '🔊' : '🔇';
  }

  /* ==========================================================
     EVENT BINDING
     ========================================================== */
  _bindEvents() {
    // ── Mode buttons ──────────────────────────────────────────
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.mode = btn.dataset.mode;
        this._refreshHomeMeta();
      });
    });

    // ── Difficulty buttons ────────────────────────────────────
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.difficulty = btn.dataset.diff;
        this._refreshHomeMeta();
      });
    });

    // ── Home actions ──────────────────────────────────────────
    document.getElementById('btn-start')
      .addEventListener('click', () => { this.sound.playClick(); this._startGame(); });

    document.getElementById('btn-leaderboard')
      .addEventListener('click', () => { this.sound.playClick(); this._openLeaderboard(); });

    document.getElementById('btn-achievements')
      .addEventListener('click', () => { this.sound.playClick(); this._openAchievements(); });

    document.getElementById('btn-analytics')
      .addEventListener('click', () => { this.sound.playClick(); this._openAnalytics(); });

    document.getElementById('btn-toggle-theme')
      .addEventListener('click', () => { this.sound.playClick(); this._toggleTheme(); });

    document.getElementById('btn-toggle-sound')
      .addEventListener('click', () => this._toggleSound());

    // ── Keypad ────────────────────────────────────────────────
    document.querySelectorAll('.key-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this._handleKey(btn.dataset.key);
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 150);
      });
    });

    // ── Physical keyboard ─────────────────────────────────────
    document.addEventListener('keydown', e => this._handleKeyboard(e));

    // ── Game controls ─────────────────────────────────────────
    document.getElementById('btn-quit')
      .addEventListener('click', () => { this.sound.playClick(); this._endGame(); });

    // ── Results buttons ───────────────────────────────────────
    document.getElementById('btn-play-again')
      .addEventListener('click', () => { this.sound.playClick(); this._startGame(); });

    document.getElementById('btn-home')
      .addEventListener('click', () => { this.sound.playClick(); this._showScreen('home'); this._refreshHomeMeta(); });

    // ── Leaderboard tabs ──────────────────────────────────────
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._renderLeaderboard(btn.dataset.tab);
      });
    });

    // ── Close buttons ─────────────────────────────────────────
    document.getElementById('btn-close-leaderboard')
      .addEventListener('click', () => { this.sound.playClick(); this._showScreen('home'); });

    document.getElementById('btn-close-achievements')
      .addEventListener('click', () => { this.sound.playClick(); this._showScreen('home'); });

    document.getElementById('btn-close-analytics')
      .addEventListener('click', () => { this.sound.playClick(); this._showScreen('home'); });
  }

  /** Route physical keyboard events to the same handler as the keypad. */
  _handleKeyboard(e) {
    if (!this.state.isPlaying) return;
    if (e.key >= '0' && e.key <= '9') {
      this._handleKey(e.key);
      this._flashKeyBtn(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      this._handleKey('back');
      this._flashKeyBtn('back');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this._handleKey('submit');
      this._flashKeyBtn('submit');
    }
  }

  _flashKeyBtn(key) {
    const btn = document.querySelector(`.key-btn[data-key="${key}"]`);
    if (!btn) return;
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 150);
  }

  /* ==========================================================
     GAME FLOW
     ========================================================== */

  _startGame() {
    this.state.reset();

    // Read current UI selections
    const diffBtn = document.querySelector('.diff-btn.active');
    const modeBtn = document.querySelector('.mode-btn.active');
    this.state.difficulty = diffBtn ? diffBtn.dataset.diff : 'easy';
    this.state.mode       = modeBtn ? modeBtn.dataset.mode : 'classic';

    // Build question generator (daily mode uses a date-derived seed)
    let seed = null;
    if (this.state.mode === 'daily') {
      const d = new Date();
      seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    }
    this.generator = new QuestionGenerator(this.state.difficulty, seed);

    this._showScreen('game');
    this._startCountdown();
  }

  _startCountdown() {
    const overlay = document.getElementById('countdown-overlay');
    const label   = document.getElementById('countdown-number');
    overlay.classList.remove('hidden');

    let count = 3;
    label.classList.remove('go');
    label.textContent = count;
    this.sound.playCountdown();

    const tick = setInterval(() => {
      count--;
      if (count > 0) {
        label.textContent = count;
        // Re-trigger animation
        label.classList.remove('countdown-anim');
        void label.offsetWidth;
        label.classList.add('countdown-anim');
        this.sound.playCountdown();
      } else if (count === 0) {
        label.textContent = 'GO!';
        label.classList.add('go');
        this.sound.playCountdownGo();
      } else {
        clearInterval(tick);
        label.classList.remove('go');
        overlay.classList.add('hidden');
        this._beginPlay();
      }
    }, 700);
  }

  _beginPlay() {
    this.state.isPlaying = true;

    // Show/hide the timer depending on mode
    const timerEl = document.getElementById('timer-container');
    if (this.state.mode === 'endless') {
      timerEl.style.display = 'none';
    } else {
      timerEl.style.display = '';
      this._startTimer();
    }

    this._nextQuestion();
  }

  _startTimer() {
    this.state.timeLeft = CONFIG.GAME_DURATION;
    this._updateTimerUI();

    this._timerID = setInterval(() => {
      this.state.timeLeft--;
      this._updateTimerUI();

      // Visual urgency when time is low
      if (this.state.timeLeft <= 10) {
        document.getElementById('timer-bar').classList.add('urgent');
        if (this.state.timeLeft <= 5) this.sound.playCountdown();
      }

      if (this.state.timeLeft <= 0) this._endGame();
    }, 1000);
  }

  _updateTimerUI() {
    const pct  = (this.state.timeLeft / CONFIG.GAME_DURATION) * 100;
    const bar  = document.getElementById('timer-bar');
    const text = document.getElementById('timer-text');

    bar.style.width = `${pct}%`;
    text.textContent = this.state.timeLeft;

    if      (this.state.timeLeft <= 10) bar.style.background = 'var(--color-error)';
    else if (this.state.timeLeft <= 20) bar.style.background = 'var(--color-warning)';
    else                                bar.style.background = 'var(--color-primary)';
  }

  _nextQuestion() {
    this.currentQ              = this.generator.generate(this.state.level);
    this.state.currentAnswer   = '';
    this.state.questionStartMs = Date.now();

    // Animate question in
    const qEl = document.getElementById('question-display');
    qEl.classList.remove('question-enter');
    void qEl.offsetWidth; // force reflow to restart animation
    qEl.classList.add('question-enter');
    qEl.textContent = `${this.currentQ.question} = ?`;

    this._updateAnswerUI();
    this._updateStatsUI();

    // Hide leftover feedback / multiplier badges
    document.getElementById('feedback-display').classList.add('hidden');
    document.getElementById('multiplier-display').classList.add('hidden');
  }

  /* ==========================================================
     INPUT HANDLING
     ========================================================== */

  _handleKey(key) {
    if (!this.state.isPlaying) return;

    if (key === 'back') {
      this.state.currentAnswer = this.state.currentAnswer.slice(0, -1);
      this._updateAnswerUI();
    } else if (key === 'submit') {
      this._submitAnswer();
    } else if (/^\d$/.test(key)) {
      if (this.state.currentAnswer.length < CONFIG.MAX_ANSWER_LENGTH) {
        this.state.currentAnswer += key;
        this._updateAnswerUI();
      }
    }
  }

  _submitAnswer() {
    const raw = this.state.currentAnswer;
    if (raw === '' || raw === '-') return;

    const userAnswer    = parseInt(raw, 10);
    const correctAnswer = this.currentQ.answer;
    const timeTaken     = Date.now() - this.state.questionStartMs;

    this.state.totalAnswered++;
    this.state.totalTimeMs += timeTaken;

    if (userAnswer === correctAnswer) {
      this._onCorrect(timeTaken);
    } else {
      this._onIncorrect(correctAnswer);
    }
  }

  /* ==========================================================
     CORRECT / INCORRECT HANDLERS
     ========================================================== */

  _onCorrect(timeTaken) {
    this.state.totalCorrect++;
    this.state.streak++;
    this.state.bestStreak = Math.max(this.state.bestStreak, this.state.streak);

    const points = this.state.pointsFor(timeTaken);
    this.state.score += points;

    // Level up every 10 correct answers (cap at 10)
    if (this.state.totalCorrect % 10 === 0 && this.state.level < 10) {
      this.state.level++;
      this._triggerLevelUpFX();
    }

    this._showFeedback(true, `+${points}`);
    this._animateScoreBump();
    this._updateStreakUI();

    // Sound: streak fanfare at milestones, otherwise normal correct chime
    const t = CONFIG.STREAK_MULTIPLIER;
    if (this.state.streak === t || this.state.streak % (t * 2) === 0) {
      this.sound.playStreak();
      this._showMultiplierBadge();
    } else {
      this.sound.playCorrect();
    }

    setTimeout(() => this._nextQuestion(), 400);
  }

  _onIncorrect(correctAnswer) {
    this.state.streak = 0;
    this._showFeedback(false, `${correctAnswer}`);
    this._shakeQuestion();
    this._updateStreakUI();
    this.sound.playWrong();
    setTimeout(() => this._nextQuestion(), 900);
  }

  _endGame() {
    clearInterval(this._timerID);
    this._timerID      = null;
    this.state.isPlaying = false;

    // Persist results
    const isNewBest = this.storage.addHighScore(
      this.state.difficulty,
      this.state.score,
      {
        accuracy:     this.state.accuracy,
        bestStreak:   this.state.bestStreak,
        totalCorrect: this.state.totalCorrect,
        mode:         this.state.mode,
      }
    );

    this.storage.updateGlobalStats({
      totalCorrect:  this.state.totalCorrect,
      totalAnswered: this.state.totalAnswered,
      gameScore:     this.state.score,
      bestStreak:    this.state.bestStreak,
    });

    if (this.state.mode === 'daily') {
      this.storage.saveDailyProgress(this.state.score);
    }

    this._checkAchievements();

    this.sound.playGameOver();
    if (isNewBest && this.state.score > 0) {
      setTimeout(() => this.sound.playNewHighScore(), 600);
    }

    this._showResults(isNewBest);
  }

  /* ==========================================================
     ACHIEVEMENTS
     ========================================================== */

  _checkAchievements() {
    const stats = {
      totalCorrect:  this.state.totalCorrect,
      totalAnswered: this.state.totalAnswered,
      bestStreak:    this.state.bestStreak,
      gameScore:     this.state.score,
      accuracy:      this.state.accuracy,
      difficulty:    this.state.difficulty,
      mode:          this.state.mode,
    };

    this.state.newUnlocks = [];
    ACHIEVEMENTS.forEach(a => {
      if (a.condition(stats) && this.storage.unlockAchievement(a.id)) {
        this.state.newUnlocks.push(a);
      }
    });
  }

  /* ==========================================================
     UI HELPERS
     ========================================================== */

  _showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active', 'slide-in');
    });
    const screen = document.getElementById(`screen-${name}`);
    if (!screen) return;
    screen.classList.add('active');
    // Trigger entrance animation on next frame
    requestAnimationFrame(() => screen.classList.add('slide-in'));
  }

  _updateAnswerUI() {
    document.getElementById('answer-value').textContent =
      this.state.currentAnswer || '_';
  }

  _updateStatsUI() {
    document.getElementById('display-score').textContent  = this.state.score.toLocaleString();
    document.getElementById('display-streak').textContent = this.state.streak;
    document.getElementById('display-level').textContent  = this.state.level;
    document.getElementById('questions-counter').textContent = `Q: ${this.state.totalAnswered}`;
  }

  _updateStreakUI() {
    document.getElementById('display-streak').textContent = this.state.streak;
    const flame = document.getElementById('streak-flame');
    if (this.state.streak >= CONFIG.STREAK_MULTIPLIER) {
      flame.classList.remove('hidden');
    } else {
      flame.classList.add('hidden');
    }
  }

  /**
   * Show "✓ Correct! +N" or "✗ Answer: N" beneath the question.
   * Auto-fades after ~700 ms.
   */
  _showFeedback(isCorrect, text) {
    const el = document.getElementById('feedback-display');
    el.textContent = isCorrect ? `✓ Correct!  ${text}` : `✗ Answer: ${text}`;
    el.className   = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 700);
  }

  /** Pop-up badge showing the active score multiplier. */
  _showMultiplierBadge() {
    const el = document.getElementById('multiplier-display');
    el.textContent = `${this.state.multiplier}× Multiplier!`;
    el.classList.remove('hidden', 'bounce-in');
    void el.offsetWidth;
    el.classList.add('bounce-in');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 800);
  }

  _animateScoreBump() {
    const el = document.getElementById('display-score');
    el.classList.remove('score-bump');
    void el.offsetWidth;
    el.classList.add('score-bump');
  }

  _shakeQuestion() {
    const q = document.getElementById('question-display');
    q.classList.remove('shake');
    void q.offsetWidth;
    q.classList.add('shake');

    const ans = document.getElementById('answer-display');
    ans.classList.remove('wrong-flash');
    void ans.offsetWidth;
    ans.classList.add('wrong-flash');
  }

  _triggerLevelUpFX() {
    this.sound.playLevelUp();
    const el = document.getElementById('display-level');
    el.classList.remove('level-up');
    void el.offsetWidth;
    el.classList.add('level-up');
  }

  /* ==========================================================
     RESULTS SCREEN
     ========================================================== */

  _showResults(isNewBest) {
    this._showScreen('results');

    // Scores
    document.getElementById('results-score').textContent = this.state.score.toLocaleString();
    document.getElementById('res-correct').textContent   = this.state.totalCorrect;
    document.getElementById('res-accuracy').textContent  = `${this.state.accuracy}%`;
    document.getElementById('res-streak').textContent    = this.state.bestStreak;
    document.getElementById('res-avg-time').textContent  = `${this.state.avgTime}s`;

    // Rank badge
    const rank = this._getRank(this.state.score, this.state.accuracy);
    document.getElementById('results-rank').textContent  = rank.icon;
    document.getElementById('results-title').textContent = rank.title;

    // New high-score banner
    const hsEl = document.getElementById('new-high-score');
    if (isNewBest && this.state.score > 0) {
      hsEl.classList.remove('hidden');
    } else {
      hsEl.classList.add('hidden');
    }

    // Achievement unlock badges
    const unlocksEl = document.getElementById('achievement-unlocks');
    unlocksEl.innerHTML = this.state.newUnlocks
      .map(a => `<div class="unlock-badge">${a.icon} <strong>${a.name}</strong> unlocked!</div>`)
      .join('');
  }

  _getRank(score, accuracy) {
    if (score >= 2000 && accuracy >= 90) return { icon: '👑',      title: 'Grand Master!' };
    if (score >= 1500)                   return { icon: '⭐⭐⭐', title: 'Excellent!' };
    if (score >= 1000)                   return { icon: '⭐⭐',   title: 'Great Job!' };
    if (score >= 500)                    return { icon: '⭐',      title: 'Good Work!' };
    if (score > 0)                       return { icon: '👍',      title: 'Keep Practicing!' };
    return                                      { icon: '😅',      title: 'Try Again!' };
  }

  /* ==========================================================
     HOME META (best score + daily indicator)
     ========================================================== */

  _refreshHomeMeta() {
    const diff   = (document.querySelector('.diff-btn.active') || {}).dataset?.diff || 'easy';
    const scores = this.storage.getHighScores(diff);
    const best   = scores.length > 0 ? scores[0].score : 0;
    const el     = document.getElementById('best-score-display');

    if (best > 0) {
      el.innerHTML = `Best Score (${diff}): <strong>${best.toLocaleString()}</strong>`;
    } else {
      el.innerHTML = 'No scores yet – start playing!';
    }

    // Daily challenge status
    const dailyBtn = document.querySelector('[data-mode="daily"]');
    if (dailyBtn) {
      const dp = this.storage.getDailyProgress();
      dailyBtn.querySelector('.mode-desc').textContent =
        dp?.completed ? `✓ Score: ${dp.score}` : "Today's challenge";
    }
  }

  /* ==========================================================
     LEADERBOARD
     ========================================================== */

  _openLeaderboard() {
    this._showScreen('leaderboard');
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'easy';
    this._renderLeaderboard(activeTab);
  }

  _renderLeaderboard(difficulty) {
    const scores = this.storage.getHighScores(difficulty);
    const el     = document.getElementById('leaderboard-list');

    if (scores.length === 0) {
      el.innerHTML = '<div class="empty-state">No scores yet! Start playing to set records.</div>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    el.innerHTML = scores
      .map((s, i) => `
        <div class="score-entry ${i === 0 ? 'top-score' : ''}">
          <span class="score-rank">${medals[i] ?? `#${i + 1}`}</span>
          <span class="score-points">${s.score.toLocaleString()}</span>
          <span class="score-meta">${s.accuracy}% acc · ${s.streak}🔥</span>
          <span class="score-date">${s.date}</span>
        </div>`)
      .join('');
  }

  /* ==========================================================
     ACHIEVEMENTS
     ========================================================== */

  _openAchievements() {
    this._showScreen('achievements');
    this._renderAchievements();
  }

  _renderAchievements() {
    const unlocked = this.storage.getUnlockedAchievements();

    // Progress summary
    document.getElementById('achievements-progress').innerHTML =
      `Unlocked: <strong>${unlocked.length} / ${ACHIEVEMENTS.length}</strong>`;

    // Grid
    document.getElementById('achievements-grid').innerHTML = ACHIEVEMENTS
      .map(a => {
        const done = unlocked.includes(a.id);
        return `
          <div class="achievement-card ${done ? 'unlocked' : 'locked'}">
            <div class="achievement-icon">${done ? a.icon : '🔒'}</div>
            <div class="achievement-name">${a.name}</div>
            <div class="achievement-desc">${done ? a.desc : '???'}</div>
          </div>`;
      })
      .join('');
  }

  /* ==========================================================
     ANALYTICS
     ========================================================== */

  _openAnalytics() {
    this._showScreen('analytics');
    this._renderAnalytics();
  }

  _renderAnalytics() {
    const gs  = this.storage.getGlobalStats();
    const acc = gs.totalAnswered > 0
      ? Math.round((gs.totalCorrect / gs.totalAnswered) * 100)
      : 0;

    const cards = [
      { label: 'Games Played',   value: gs.gamesPlayed },
      { label: 'Best Score',     value: gs.bestScore.toLocaleString() },
      { label: 'Best Streak',    value: `${gs.bestStreak} 🔥` },
      { label: 'All-Time Accuracy', value: `${acc}%` },
      { label: 'Total Correct',  value: gs.totalCorrect.toLocaleString() },
      { label: 'Total Answered', value: gs.totalAnswered.toLocaleString() },
    ];

    document.getElementById('analytics-content').innerHTML = cards
      .map(c => `
        <div class="analytics-card">
          <div class="analytics-value">${c.value}</div>
          <div class="analytics-label">${c.label}</div>
        </div>`)
      .join('');
  }

  /* ==========================================================
     SETTINGS
     ========================================================== */

  _toggleTheme() {
    const current  = document.body.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    this._setThemeIcon(newTheme);
    const s = this.storage.getSettings();
    s.theme = newTheme;
    this.storage.saveSettings(s);
  }

  _toggleSound() {
    const enabled = this.sound.toggle();
    this._setSoundIcon(enabled);
    if (enabled) this.sound.playClick(); // audible confirmation
    const s = this.storage.getSettings();
    s.sound = enabled;
    this.storage.saveSettings(s);
  }
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  window.game = new MentalMathGame();
});
