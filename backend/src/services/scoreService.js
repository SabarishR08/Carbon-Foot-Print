'use strict';

const { PARIS_TARGET_KG_ANNUAL, GLOBAL_ANNUAL_AVERAGES_KG } = require('./carbonCalculator');

/**
 * Carbon Score Engine (0-100, higher = better/sustainable)
 * Formula: 100 - (annualized_emissions / global_avg * 50), capped 0-100
 */
function computeCarbonScore(activitiesByCategory, periodDays = 30) {
  const totalKg = Object.values(activitiesByCategory).reduce((a, b) => a + b, 0);
  const annualizedKg = (totalKg / periodDays) * 365;

  const ratio = annualizedKg / GLOBAL_ANNUAL_AVERAGES_KG.total;
  const rawScore = Math.max(0, Math.min(100, Math.round(100 - ratio * 50)));

  const categoryBreakdown = {};
  for (const [cat, kg] of Object.entries(activitiesByCategory)) {
    const annualCat = (kg / periodDays) * 365;
    const catAvg = GLOBAL_ANNUAL_AVERAGES_KG[cat] || 1;
    categoryBreakdown[cat] = {
      kg: parseFloat(kg.toFixed(2)),
      annualizedKg: parseFloat(annualCat.toFixed(2)),
      percentOfCategoryAvg: parseFloat(((annualCat / catAvg) * 100).toFixed(1)),
      score: Math.max(0, Math.min(100, Math.round(100 - (annualCat / catAvg) * 50))),
    };
  }

  const parisProgress = Math.min(100, parseFloat(((annualizedKg / PARIS_TARGET_KG_ANNUAL) * 100).toFixed(1)));

  return {
    score: rawScore,
    grade: rawScore >= 80 ? 'A' : rawScore >= 65 ? 'B' : rawScore >= 50 ? 'C' : rawScore >= 35 ? 'D' : 'F',
    annualizedKg: parseFloat(annualizedKg.toFixed(2)),
    parisTargetProgress: parisProgress,
    onTrack: annualizedKg <= PARIS_TARGET_KG_ANNUAL,
    categoryBreakdown,
    scoringLogic: {
      description: 'Score = 100 - (annualized_emissions / global_average * 50). Higher is more sustainable.',
      globalAverageKg: GLOBAL_ANNUAL_AVERAGES_KG.total,
      parisTargetKg: PARIS_TARGET_KG_ANNUAL,
      periodDays,
    },
  };
}

function computeTrend(currentPeriodKg, previousPeriodKg) {
  if (previousPeriodKg === 0) return { change: 0, direction: 'stable', percentChange: 0 };
  const change = currentPeriodKg - previousPeriodKg;
  const percentChange = parseFloat(((change / previousPeriodKg) * 100).toFixed(1));
  return {
    change: parseFloat(change.toFixed(2)),
    percentChange,
    direction: change < -1 ? 'improving' : change > 1 ? 'worsening' : 'stable',
  };
}

module.exports = { computeCarbonScore, computeTrend };
