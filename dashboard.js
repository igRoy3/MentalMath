import {
  achievementsCatalog,
  buildPlayUrl,
  capitalize,
  formatNumber,
  getTodayKey,
  initShell,
  playTone,
  renderAchievementCards,
  renderLeaderboard,
  saveAppData,
  summarizeData,
  triggerHaptics,
} from './shared.js';

const data = initShell();

const elements = {
  dailySeedLabel: document.getElementById('dailySeedLabel'),
  totalRuns: document.getElementById('totalRuns'),
  lifetimeBest: document.getElementById('lifetimeBest'),
  dailyBest: document.getElementById('dailyBest'),
  unlockedCount: document.getElementById('unlockedCount'),
  quickDifficulty: document.getElementById('quickDifficulty'),
  quickMode: document.getElementById('quickMode'),
  startClassicLink: document.getElementById('startClassicLink'),
  startDailyLink: document.getElementById('startDailyLink'),
  startSelectedLink: document.getElementById('startClassicLinkDuplicate'),
  quickDifficultyLabel: document.getElementById('quickDifficultyLabel'),
  lastRunCard: document.getElementById('lastRunCard'),
  leaderboardList: document.getElementById('leaderboardList'),
  achievementList: document.getElementById('achievementList'),
  dailyChallengeCard: document.getElementById('dailyChallengeCard'),
};

const quickState = {
  difficulty: data.settings.lastDifficulty,
  mode: data.settings.lastMode,
};

function syncQuickSelectors() {
  elements.quickDifficulty.querySelectorAll('[data-difficulty]').forEach((button) => {
    button.classList.toggle('active', button.dataset.difficulty === quickState.difficulty);
  });

  elements.quickMode.querySelectorAll('[data-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === quickState.mode);
  });

  elements.quickDifficultyLabel.textContent = capitalize(quickState.difficulty);
  elements.startClassicLink.href = buildPlayUrl(quickState.difficulty, 'classic');
  elements.startDailyLink.href = buildPlayUrl(quickState.difficulty, 'daily');
  elements.startSelectedLink.href = buildPlayUrl(quickState.difficulty, quickState.mode);
  elements.startSelectedLink.textContent = `Open ${capitalize(quickState.mode)} play screen`;
}

function giveUiFeedback(type = 'tap') {
  playTone(data.settings.soundEnabled, type === 'success' ? 'success' : 'tap');
  triggerHaptics(type === 'success' ? 'soft' : 'tap');
}

function renderOverview() {
  const summary = summarizeData(data);
  elements.dailySeedLabel.textContent = `Daily seed · ${getTodayKey()}`;
  elements.totalRuns.textContent = String(summary.totalRuns);
  elements.lifetimeBest.textContent = formatNumber(summary.lifetimeBest);
  elements.dailyBest.textContent = formatNumber(data.dailyBest.date === getTodayKey() ? data.dailyBest.score : 0);
  elements.unlockedCount.textContent = `${summary.unlockedCount}/${achievementsCatalog.length}`;

  if (!data.lastRun) {
    elements.lastRunCard.innerHTML = `
      <p class="subtle">No completed sessions yet. Start a challenge to populate this panel.</p>
    `;
  } else {
    elements.lastRunCard.innerHTML = `
      <div class="stats-grid">
        <div>
          <span>Score</span>
          <strong>${formatNumber(data.lastRun.score)}</strong>
        </div>
        <div>
          <span>Accuracy</span>
          <strong>${data.lastRun.accuracy.toFixed(0)}%</strong>
        </div>
        <div>
          <span>Answered</span>
          <strong>${data.lastRun.totalAnswered}</strong>
        </div>
        <div>
          <span>Best streak</span>
          <strong>${data.lastRun.bestStreak}</strong>
        </div>
      </div>
      <p class="subtle last-run-meta">${capitalize(data.lastRun.difficulty)} · ${capitalize(data.lastRun.mode)} · ${data.lastRun.date}</p>
    `;
  }

  elements.dailyChallengeCard.innerHTML = `
    <p class="subtle">Daily mode uses a deterministic seed based on today's date and the selected difficulty.</p>
    <div class="challenge-meta">
      <span>Today's best</span>
      <strong>${formatNumber(data.dailyBest.date === getTodayKey() ? data.dailyBest.score : 0)}</strong>
    </div>
    <a class="primary-button link-button js-feedback" href="${buildPlayUrl(quickState.difficulty, 'daily')}">Play daily challenge</a>
  `;
}

function bindEvents() {
  elements.quickDifficulty.addEventListener('click', (event) => {
    const button = event.target.closest('[data-difficulty]');
    if (!button) {
      return;
    }

    giveUiFeedback('tap');
    quickState.difficulty = button.dataset.difficulty;
    data.settings.lastDifficulty = quickState.difficulty;
    saveAppData(data);
    syncQuickSelectors();
    renderOverview();
  });

  elements.quickMode.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button) {
      return;
    }

    giveUiFeedback('tap');
    quickState.mode = button.dataset.mode;
    data.settings.lastMode = quickState.mode;
    saveAppData(data);
    syncQuickSelectors();
  });

  document.querySelectorAll('.js-feedback').forEach((element) => {
    element.addEventListener('click', () => {
      giveUiFeedback('success');
    });
  });

  elements.dailyChallengeCard.addEventListener('click', (event) => {
    if (event.target.closest('.js-feedback')) {
      giveUiFeedback('success');
    }
  });
}

function init() {
  syncQuickSelectors();
  renderOverview();
  renderLeaderboard(elements.leaderboardList, data, 5);
  renderAchievementCards(elements.achievementList, data);
  bindEvents();
}

init();
