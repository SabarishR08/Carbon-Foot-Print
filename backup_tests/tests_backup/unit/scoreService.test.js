const { computeCarbonScore, computeTrend } = require('../../backend/src/services/scoreService');

describe('Score Service', () => {
  test('computes carbon score from categories', () => {
    const score = computeCarbonScore({ transport: 50, food: 30, energy: 40 }, 30);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(score.grade).toMatch(/[A-F]/);
    expect(score.scoringLogic).toBeDefined();
  });

  test('category breakdown includes all categories', () => {
    const score = computeCarbonScore({ transport: 100, food: 50 }, 30);
    expect(score.categoryBreakdown.transport).toBeDefined();
    expect(score.categoryBreakdown.food).toBeDefined();
  });

  test('computeTrend detects improving direction', () => {
    const trend = computeTrend(80, 100);
    expect(trend.direction).toBe('improving');
    expect(trend.percentChange).toBeLessThan(0);
  });

  test('computeTrend detects worsening direction', () => {
    const trend = computeTrend(120, 100);
    expect(trend.direction).toBe('worsening');
  });

  test('zero previous period returns stable', () => {
    const trend = computeTrend(50, 0);
    expect(trend.direction).toBe('stable');
  });
});
