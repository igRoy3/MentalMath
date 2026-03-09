import {
  achievementsCatalog,
  capitalize,
  formatNumber,
  getTodayKey,
  initShell,
  renderAchievementCards,
  renderLeaderboard,
  summarizeData,
} from './shared.js';

const data = initShell('progress');

const elements = {
  achievementSummary: document.getElementById('achievementSummary'),
  overviewMetrics: document.getElementById('overviewMetrics'),
  difficultyBars: document.getElementById('difficultyBars'),
  achievementList: document.getElementById('achievementList'),
  leaderboardList: document.getElementById('leaderboardList'),
  lastRunGrid: document.getElementById('lastRunGrid'),
};

function renderOverview() {
  const summary = summarizeData(data);
  elements.achievementSummary.textContent = `${summary.unlockedCount} unlocked`;

  elements.overviewMetrics.innerHTML = [
    { label: 'Total runs', value: summary.totalRuns },
    { label: 'Lifetime best', value: formatNumber(summary.lifetimeBest) },
    { label: 'Average top score', value: formatNumber(summary.averageScore) },
    { label: 'Daily best', value: formatNumber(data.dailyBest.date === getTodayKey() ? data.dailyBest.score : 0) },
  ]
    .map(
      (item) => `
        <article class="metric-card">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </article>
      `
    )
    .join('');
}

function renderDifficultyBars() {
  const maxValue = Math.max(data.bestScores.easy, data.bestScores.medium, data.bestScores.hard, 1);
  elements.difficultyBars.innerHTML = ['easy', 'medium', 'hard']
    .map((difficulty) => {
      const value = data.bestScores[difficulty];
      const width = Math.max((value / maxValue) * 100, value ? 8 : 0);
      return `
        <div class="bar-row">
          <div class="bar-row-header">
            <span>${capitalize(difficulty)}</span>
            <strong>${formatNumber(value)}</strong>
          </div>
          <div class="progress-track large">
            <div class="progress-fill xp-fill" style="width: ${width}%"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderLastRun() {
  if (!data.lastRun) {
    elements.lastRunGrid.innerHTML = '<p class="subtle">No recent session found.</p>';
    return;
  }

  elements.lastRunGrid.innerHTML = [
    { label: 'Score', value: formatNumber(data.lastRun.score) },
    { label: 'Accuracy', value: `${data.lastRun.accuracy.toFixed(0)}%` },
    { label: 'Answered', value: data.lastRun.totalAnswered },
    { label: 'Best streak', value: data.lastRun.bestStreak },
    { label: 'Avg. response', value: `${data.lastRun.averageTime.toFixed(1)}s` },
    { label: 'Mode', value: `${capitalize(data.lastRun.difficulty)} · ${capitalize(data.lastRun.mode)}` },
  ]
    .map(
      (item) => `
        <div>
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </div>
      `
    )
    .join('');
}

function init() {
  renderOverview();
  renderDifficultyBars();
  renderAchievementCards(elements.achievementList, data);
  renderLeaderboard(elements.leaderboardList, data, 10);
  renderLastRun();
}

init();
