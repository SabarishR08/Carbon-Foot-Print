'use strict';

const { createMockFirestore } = require('../helpers/mockFirestore');

const mockDb = createMockFirestore({
  gamification: {
    existing_user: { points: 250, streak: 6, lastLogDate: null, badges: [] },
  },
});

jest.mock('../../backend/src/config/firebase', () => ({
  getDb: () => mockDb,
}));

const {
  getLevel,
  getGamificationState,
  awardPoints,
  updateStreak,
  getLeaderboard,
  getChallenges,
  BADGES,
  LEVELS,
} = require('../../backend/src/services/gamificationService');

describe('Gamification Service', () => {
  test('getLevel returns Seedling for 0 points', () => {
    const level = getLevel(0);
    expect(level.name).toBe('Seedling');
    expect(level.nextLevel.pointsNeeded).toBe(100);
  });

  test('getLevel returns the highest matching level', () => {
    expect(getLevel(150).name).toBe('Sprout');
    expect(getLevel(999).name).toBe('Tree');
    expect(getLevel(5000).name).toBe('Guardian');
  });

  test('getLevel reports nextLevel as null at the max level', () => {
    const level = getLevel(LEVELS[LEVELS.length - 1].minPoints + 1);
    expect(level.nextLevel).toBeNull();
  });

  test('getGamificationState initializes a new user with zero points', async () => {
    const state = await getGamificationState('brand-new-user');
    expect(state.points).toBe(0);
    expect(state.level.name).toBe('Seedling');
    expect(state.availableBadges).toEqual(BADGES);
  });

  test('getGamificationState returns existing state with earned badges', async () => {
    const state = await getGamificationState('existing_user');
    expect(state.points).toBe(250);
    expect(state.level.name).toBe('Sprout');
  });

  test('awardPoints accumulates points for an existing user', async () => {
    const level = await awardPoints('existing_user', 100, 'test_award');
    expect(level.points).toBe(350);
  });

  test('awardPoints initializes points for a new user', async () => {
    const level = await awardPoints('fresh_user', 50, 'first_award');
    expect(level.points).toBe(50);
  });

  test('updateStreak starts a streak at 1 for a first-time log', async () => {
    const streak = await updateStreak('streak_user');
    expect(streak).toBe(1);
  });

  test('updateStreak does not increment twice on the same day', async () => {
    await updateStreak('same_day_user');
    const second = await updateStreak('same_day_user');
    expect(second).toBe(1);
  });

  test('getLeaderboard returns users ranked by points descending', async () => {
    await awardPoints('leader_x', 1000, 'seed');
    await awardPoints('leader_y', 10, 'seed');
    const leaderboard = await getLeaderboard(10);
    expect(leaderboard[0].points).toBeGreaterThanOrEqual(leaderboard[leaderboard.length - 1].points);
    expect(leaderboard[0]).toHaveProperty('anonymousId');
    expect(leaderboard[0]).toHaveProperty('rank', 1);
  });

  test('getChallenges returns a non-empty list with point values', async () => {
    const challenges = await getChallenges();
    expect(challenges.length).toBeGreaterThan(0);
    challenges.forEach((c) => {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('points');
    });
  });
});
