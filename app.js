import {
  GAME_DURATION_MS,
  QUESTIONS_PER_LEVEL,
  capitalize,
  chooseOne,
  createDailyRng,
  formatNumber,
  getQueryGameConfig,
  getTodayKey,
  initShell,
  playTone,
  randomInt,
  recordRun,
  renderAchievementCards,
  renderLeaderboard,
  saveAppData,
  triggerHaptics,
} from './shared.js';

const data = initShell();
const queryConfig = getQueryGameConfig();

const state = {
  difficulty: queryConfig.difficulty || data.settings.lastDifficulty,
  mode: queryConfig.mode || data.settings.lastMode,
  isRunning: false,
  currentInput: '',
  currentQuestion: null,
  questionStartedAt: 0,
  sessionStartedAt: 0,
  timerInterval: null,
  seededRng: null,
  lastRunWasBest: false,
  stats: createFreshStats(queryConfig.mode || data.settings.lastMode),
};

const elements = {
  dailySeedLabel: document.getElementById('dailySeedLabel'),
  startButton: document.getElementById('startButton'),
  quitButton: document.getElementById('quitButton'),
  playAgainButton: document.getElementById('playAgainButton'),
  closeSummaryButton: document.getElementById('closeSummaryButton'),
  difficultySelector: document.getElementById('difficultySelector'),
  modeSelector: document.getElementById('modeSelector'),
  bestScore: document.getElementById('bestScore'),
  dailyBest: document.getElementById('dailyBest'),
  timerDisplay: document.getElementById('timerDisplay'),
  timerFill: document.getElementById('timerFill'),
  scoreDisplay: document.getElementById('scoreDisplay'),
  streakDisplay: document.getElementById('streakDisplay'),
  levelDisplay: document.getElementById('levelDisplay'),
  questionCounter: document.getElementById('questionCounter'),
  comboText: document.getElementById('comboText'),
  xpFill: document.getElementById('xpFill'),
  questionLabel: document.getElementById('questionLabel'),
  questionCard: document.getElementById('questionCard'),
  answerDisplay: document.getElementById('answerDisplay'),
  feedbackMessage: document.getElementById('feedbackMessage'),
  keypad: document.getElementById('keypad'),
  accuracyDisplay: document.getElementById('accuracyDisplay'),
  avgTimeDisplay: document.getElementById('avgTimeDisplay'),
  correctDisplay: document.getElementById('correctDisplay'),
  bestStreakDisplay: document.getElementById('bestStreakDisplay'),
  leaderboardList: document.getElementById('leaderboardList'),
  achievementList: document.getElementById('achievementList'),
  summaryModal: document.getElementById('summaryModal'),
  summaryTitle: document.getElementById('summaryTitle'),
  summaryScore: document.getElementById('summaryScore'),
  summaryAccuracy: document.getElementById('summaryAccuracy'),
  summaryAnswered: document.getElementById('summaryAnswered'),
  summaryStreak: document.getElementById('summaryStreak'),
};

function createFreshStats(mode = 'classic') {
  return {
    score: 0,
    streak: 0,
    bestStreak: 0,
    totalAnswered: 0,
    correctAnswers: 0,
    accuracy: 0,
    averageTime: 0,
    responseTimes: [],
    level: 1,
    difficulty: data.settings.lastDifficulty,
    mode,
    finished: false,
  };
}

function setFeedback(message, type = 'info') {
  elements.feedbackMessage.textContent = message;
  elements.feedbackMessage.className = `feedback ${type}`;
}

function resetQuestionCardAnimation(className) {
  elements.questionCard.classList.remove('flash-correct', 'flash-wrong', 'pulse');
  void elements.questionCard.offsetWidth;
  if (className) {
    elements.questionCard.classList.add(className);
  }
}

function updateAnswerDisplay() {
  elements.answerDisplay.textContent = state.currentInput || '0';
}

function syncSelectors() {
  elements.difficultySelector.querySelectorAll('[data-difficulty]').forEach((button) => {
    button.classList.toggle('active', button.dataset.difficulty === state.difficulty);
  });

  elements.modeSelector.querySelectorAll('[data-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === state.mode);
  });
}

function updateScoreboard() {
  elements.scoreDisplay.textContent = formatNumber(state.stats.score);
  elements.streakDisplay.textContent = String(state.stats.streak);
  elements.levelDisplay.textContent = String(state.stats.level);
  elements.correctDisplay.textContent = String(state.stats.correctAnswers);
  elements.bestStreakDisplay.textContent = String(state.stats.bestStreak);
  elements.questionCounter.textContent = `${state.stats.totalAnswered} answered`;

  state.stats.accuracy = state.stats.totalAnswered
    ? (state.stats.correctAnswers / state.stats.totalAnswered) * 100
    : 0;
  elements.accuracyDisplay.textContent = `${state.stats.accuracy.toFixed(0)}%`;

  state.stats.averageTime = state.stats.responseTimes.length
    ? state.stats.responseTimes.reduce((sum, value) => sum + value, 0) / state.stats.responseTimes.length
    : 0;
  elements.avgTimeDisplay.textContent = `${state.stats.averageTime.toFixed(1)}s`;

  const comboMultiplier = 1 + Math.min(state.stats.streak, 12) * 0.12;
  elements.comboText.textContent = `Combo x${comboMultiplier.toFixed(1)}`;

  const progressInLevel = state.stats.correctAnswers % QUESTIONS_PER_LEVEL;
  elements.xpFill.style.width = `${(progressInLevel / QUESTIONS_PER_LEVEL) * 100}%`;
}

function updateTimer(remainingMs) {
  const clamped = Math.max(remainingMs, 0);
  elements.timerDisplay.textContent = `${(clamped / 1000).toFixed(1)}s`;
  elements.timerFill.style.width = `${(clamped / GAME_DURATION_MS) * 100}%`;
}

function updatePersistentViews() {
  elements.bestScore.textContent = formatNumber(data.bestScores[state.difficulty] || 0);
  elements.dailyBest.textContent = formatNumber(data.dailyBest.date === getTodayKey() ? data.dailyBest.score : 0);
  elements.dailySeedLabel.textContent = state.mode === 'daily' ? `Daily seed · ${getTodayKey()}` : 'Classic free play';
  renderLeaderboard(elements.leaderboardList, data, 5);
  renderAchievementCards(elements.achievementList, data);
}

function computeLevel() {
  return Math.floor(state.stats.correctAnswers / QUESTIONS_PER_LEVEL) + 1;
}

function getRng() {
  if (state.mode === 'daily') {
    if (!state.seededRng) {
      state.seededRng = createDailyRng(state.difficulty);
    }
    return state.seededRng;
  }
  return Math.random;
}

function buildEasyQuestion(level, rng) {
  const operation = chooseOne(['+', '-', '×', '÷', 'square', 'root'], rng);
  const range = Math.min(10 + level * 2, 18);

  if (operation === '+') {
    const left = randomInt(1, range, rng);
    const right = randomInt(1, range, rng);
    return { prompt: `${left} + ${right}`, answer: left + right };
  }

  if (operation === '-') {
    let left = randomInt(3, range + 4, rng);
    let right = randomInt(1, range, rng);
    if (right > left) {
      [left, right] = [right, left];
    }
    return { prompt: `${left} - ${right}`, answer: left - right };
  }

  if (operation === '×') {
    const left = randomInt(2, Math.min(6 + level, 10), rng);
    const right = randomInt(2, Math.min(6 + level, 10), rng);
    return { prompt: `${left} × ${right}`, answer: left * right };
  }

  if (operation === '÷') {
    const divisor = randomInt(2, Math.min(5 + level, 9), rng);
    const quotient = randomInt(2, Math.min(6 + level, 10), rng);
    return { prompt: `${divisor * quotient} ÷ ${divisor}`, answer: quotient };
  }

  if (operation === 'square') {
    const value = randomInt(2, Math.min(6 + level, 12), rng);
    return { prompt: `${value}²`, answer: value * value };
  }

  const root = randomInt(2, Math.min(6 + level, 12), rng);
  return { prompt: `√${root * root}`, answer: root };
}

function buildMediumQuestion(level, rng) {
  const operation = chooseOne(['+', '-', '×', '÷', 'square', 'root'], rng);
  const base = Math.min(20 + level * 4, 75);

  if (operation === '+') {
    const left = randomInt(10, base, rng);
    const right = randomInt(5, base, rng);
    return { prompt: `${left} + ${right}`, answer: left + right };
  }

  if (operation === '-') {
    let left = randomInt(15, base + 20, rng);
    let right = randomInt(5, base, rng);
    if (right > left) {
      [left, right] = [right, left];
    }
    return { prompt: `${left} - ${right}`, answer: left - right };
  }

  if (operation === '×') {
    const left = randomInt(3, Math.min(9 + level, 15), rng);
    const right = randomInt(4, Math.min(12 + level, 16), rng);
    return { prompt: `${left} × ${right}`, answer: left * right };
  }

  if (operation === 'square') {
    const value = randomInt(5, Math.min(10 + level, 18), rng);
    return { prompt: `${value}²`, answer: value * value };
  }

  if (operation === 'root') {
    const root = randomInt(4, Math.min(10 + level, 18), rng);
    return { prompt: `√${root * root}`, answer: root };
  }

  const divisor = randomInt(2, Math.min(10 + level, 15), rng);
  const quotient = randomInt(2, Math.min(12 + level, 18), rng);
  return { prompt: `${divisor * quotient} ÷ ${divisor}`, answer: quotient };
}

function buildHardQuestion(level, rng) {
  const template = chooseOne(['mix-1', 'mix-2', 'mix-3', 'mix-4', 'mix-5', 'mix-6'], rng);
  const scale = Math.min(level, 10);

  if (template === 'mix-1') {
    const a = randomInt(6, 12 + scale, rng);
    const b = randomInt(4, 10 + scale, rng);
    const c = randomInt(12, 32 + scale * 2, rng);
    return { prompt: `${a}² + ${b} × ${c}`, answer: a * a + b * c };
  }

  if (template === 'mix-2') {
    const root = randomInt(6, 12 + scale, rng);
    const multiplier = randomInt(3, 8 + Math.floor(scale / 2), rng);
    const addend = randomInt(10, 28 + scale * 2, rng);
    return {
      prompt: `√${root * root} × ${multiplier} + ${addend}`,
      answer: root * multiplier + addend,
    };
  }

  if (template === 'mix-3') {
    const a = randomInt(8, 16 + scale, rng);
    const b = randomInt(6, 14 + scale, rng);
    const c = randomInt(4, 9 + Math.floor(scale / 2), rng);
    return { prompt: `(${a} + ${b}) × ${c} - ${c}²`, answer: (a + b) * c - c * c };
  }

  if (template === 'mix-4') {
    const divisor = randomInt(2, 6 + Math.floor(scale / 2), rng);
    const quotient = randomInt(8, 18 + scale, rng);
    const root = randomInt(5, 11 + scale, rng);
    return {
      prompt: `${divisor * quotient} ÷ ${divisor} + √${root * root}`,
      answer: quotient + root,
    };
  }

  if (template === 'mix-5') {
    const divisor = randomInt(3, 7 + Math.floor(scale / 2), rng);
    const quotient = randomInt(10, 20 + scale, rng);
    const subtractor = randomInt(12, 30 + scale * 2, rng);
    return {
      prompt: `(${divisor * quotient} ÷ ${divisor}) + ${quotient} - ${subtractor}`,
      answer: quotient + quotient - subtractor,
    };
  }

  const square = randomInt(7, 13 + scale, rng);
  const root = randomInt(6, 12 + scale, rng);
  const subtractor = randomInt(20, 45 + scale * 2, rng);
  return {
    prompt: `${square}² - √${root * root} - ${subtractor}`,
    answer: square * square - root - subtractor,
  };
}

function generateQuestion() {
  const rng = getRng();
  const level = Math.max(state.stats.level, 1);
  const question =
    state.difficulty === 'easy'
      ? buildEasyQuestion(level, rng)
      : state.difficulty === 'medium'
        ? buildMediumQuestion(level, rng)
        : buildHardQuestion(level, rng);

  state.currentQuestion = question;
  state.currentInput = '';
  state.questionStartedAt = performance.now();

  elements.questionLabel.textContent = `${capitalize(state.difficulty)} · ${capitalize(state.mode)} mode`;
  elements.questionCard.textContent = question.prompt;
  updateAnswerDisplay();
  setFeedback('Enter your answer using the keypad.', 'info');
  resetQuestionCardAnimation('pulse');
}

function awardPoints(responseTimeSeconds) {
  const difficultyBonus = { easy: 45, medium: 85, hard: 130 }[state.difficulty];
  const speedBonus = Math.max(0, Math.round((6 - responseTimeSeconds) * 22));
  const comboMultiplier = 1 + Math.min(state.stats.streak, 12) * 0.12;
  return Math.round((100 + difficultyBonus + speedBonus) * comboMultiplier);
}

function handleCorrectAnswer(responseTimeSeconds) {
  const points = awardPoints(responseTimeSeconds);
  state.stats.streak += 1;
  state.stats.correctAnswers += 1;
  state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.streak);
  state.stats.score += points;
  state.stats.level = computeLevel();

  setFeedback(`Correct! +${points} points`, 'success');
  resetQuestionCardAnimation('flash-correct');
  playTone(data.settings.soundEnabled, 'success');
  triggerHaptics('success');
}

function handleWrongAnswer() {
  state.stats.streak = 0;
  setFeedback(`Not quite. Correct answer: ${state.currentQuestion.answer}`, 'error');
  resetQuestionCardAnimation('flash-wrong');
  playTone(data.settings.soundEnabled, 'error');
  triggerHaptics('error');
}

function submitAnswer() {
  if (!state.isRunning || !state.currentQuestion) {
    return;
  }

  if (state.currentInput === '' || state.currentInput === '-') {
    setFeedback('Enter a value before submitting.', 'error');
    return;
  }

  const submitted = Number(state.currentInput);
  const responseTimeSeconds = (performance.now() - state.questionStartedAt) / 1000;
  state.stats.totalAnswered += 1;
  state.stats.responseTimes.push(responseTimeSeconds);

  if (submitted === state.currentQuestion.answer) {
    handleCorrectAnswer(responseTimeSeconds);
  } else {
    handleWrongAnswer();
  }

  updateScoreboard();

  window.setTimeout(() => {
    if (state.isRunning) {
      generateQuestion();
    }
  }, 360);
}

function handleInput(value) {
  if (!state.isRunning) {
    setFeedback('Press start to begin a session.', 'info');
    return;
  }

  if (value === 'clear') {
    state.currentInput = '';
  } else if (value === 'backspace') {
    state.currentInput = state.currentInput.slice(0, -1);
  } else if (value === 'toggle-negative') {
    state.currentInput = state.currentInput.startsWith('-') ? state.currentInput.slice(1) : `-${state.currentInput || ''}`;
  } else if (value === 'submit') {
    submitAnswer();
    return;
  } else if (/^\d$/.test(value)) {
    state.currentInput = `${state.currentInput}${value}`.replace(/^(-?)0+(\d)/, '$1$2');
  }

  updateAnswerDisplay();
  playTone(data.settings.soundEnabled, 'tap');
  triggerHaptics('tap');
}

function startGame() {
  clearInterval(state.timerInterval);
  state.isRunning = true;
  state.currentInput = '';
  state.currentQuestion = null;
  state.stats = createFreshStats(state.mode);
  state.stats.difficulty = state.difficulty;
  state.stats.mode = state.mode;
  state.stats.finished = false;
  state.sessionStartedAt = performance.now();
  state.seededRng = state.mode === 'daily' ? createDailyRng(state.difficulty) : null;
  state.lastRunWasBest = state.stats.score > (data.bestScores[state.difficulty] || 0);

  elements.summaryModal.classList.add('hidden');
  elements.startButton.textContent = 'Restart challenge';
  setFeedback('Game on. Keep the combo alive.', 'info');
  updateScoreboard();
  updateTimer(GAME_DURATION_MS);
  generateQuestion();

  state.timerInterval = window.setInterval(() => {
    const remaining = GAME_DURATION_MS - (performance.now() - state.sessionStartedAt);
    updateTimer(remaining);

    if (remaining <= 0) {
      finishGame();
    }
  }, 100);
}

function finishGame() {
  clearInterval(state.timerInterval);
  state.isRunning = false;
  state.stats.finished = true;
  state.stats.difficulty = state.difficulty;
  state.stats.mode = state.mode;
  updateScoreboard();
  updateTimer(0);
  playTone(data.settings.soundEnabled, 'finish');
  triggerHaptics('finish');

  const previousBest = data.bestScores[state.difficulty] || 0;
  state.lastRunWasBest = state.stats.score > previousBest;
  recordRun(data, state.stats);
  updatePersistentViews();
  openSummary();

  elements.questionLabel.textContent = 'Session finished';
  elements.questionCard.textContent = 'Time!';
  state.currentInput = '';
  updateAnswerDisplay();
  setFeedback('Challenge over. Review your stats and go again.', 'info');
}

function openSummary() {
  elements.summaryTitle.textContent = state.lastRunWasBest ? 'New personal best!' : 'Great run!';
  elements.summaryScore.textContent = formatNumber(state.stats.score);
  elements.summaryAccuracy.textContent = `${state.stats.accuracy.toFixed(0)}%`;
  elements.summaryAnswered.textContent = String(state.stats.totalAnswered);
  elements.summaryStreak.textContent = String(state.stats.bestStreak);
  elements.summaryModal.classList.remove('hidden');
}

function closeSummary() {
  elements.summaryModal.classList.add('hidden');
}

function quitToDashboard() {
  if (state.isRunning) {
    const shouldQuit = window.confirm('Quit the current run and return to the dashboard?');
    if (!shouldQuit) {
      return;
    }
  }

  clearInterval(state.timerInterval);
  state.isRunning = false;
  state.currentQuestion = null;
  state.currentInput = '';
  elements.summaryModal.classList.add('hidden');
  playTone(data.settings.soundEnabled, 'error');
  triggerHaptics('soft');
  window.location.href = 'index.html';
}

function onKeypadClick(event) {
  const button = event.target.closest('button');
  if (!button) {
    return;
  }

  handleInput(button.dataset.action || button.dataset.value);
}

function onKeyboardPress(event) {
  if (event.key >= '0' && event.key <= '9') {
    handleInput(event.key);
  } else if (event.key === 'Enter') {
    handleInput('submit');
  } else if (event.key === 'Backspace') {
    handleInput('backspace');
  } else if (event.key === 'Escape') {
    handleInput('clear');
  } else if (event.key === '-') {
    handleInput('toggle-negative');
  }
}

function bindControls() {
  elements.startButton.addEventListener('click', startGame);
  elements.quitButton.addEventListener('click', quitToDashboard);
  elements.playAgainButton.addEventListener('click', startGame);
  elements.closeSummaryButton.addEventListener('click', closeSummary);
  elements.keypad.addEventListener('click', onKeypadClick);
  document.addEventListener('keydown', onKeyboardPress);

  elements.difficultySelector.addEventListener('click', (event) => {
    const button = event.target.closest('[data-difficulty]');
    if (!button || state.isRunning) {
      return;
    }

    state.difficulty = button.dataset.difficulty;
    data.settings.lastDifficulty = state.difficulty;
    saveAppData(data);
    triggerHaptics('soft');
    playTone(data.settings.soundEnabled, 'tap');
    syncSelectors();
    updatePersistentViews();
  });

  elements.modeSelector.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button || state.isRunning) {
      return;
    }

    state.mode = button.dataset.mode;
    data.settings.lastMode = state.mode;
    saveAppData(data);
    triggerHaptics('soft');
    playTone(data.settings.soundEnabled, 'tap');
    syncSelectors();
    updatePersistentViews();
  });

  document.querySelectorAll('.js-feedback').forEach((element) => {
    element.addEventListener('click', () => {
      playTone(data.settings.soundEnabled, 'tap');
      triggerHaptics('soft');
    });
  });
}

function init() {
  data.settings.lastDifficulty = state.difficulty;
  data.settings.lastMode = state.mode;
  saveAppData(data);
  syncSelectors();
  updateTimer(GAME_DURATION_MS);
  updateScoreboard();
  updateAnswerDisplay();
  updatePersistentViews();
  bindControls();
  setFeedback('Choose a difficulty and start the clock.', 'info');
}

init();
