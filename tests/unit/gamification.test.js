'use strict';

const request = require('supertest');
const { createMockFirestore } = require('../helpers/mockFirestore');

const TEST_UID = 'test-user-1';

const mockDb = createMockFirestore({
  gamification: {
    [TEST_UID]: { points: 120, streak: 3, lastLogDate: '2026-06-12', badges: ['first_log'] },
    leader_a: { points: 500, streak: 10, badges: [] },
    leader_b: { points: 50, streak: 1, badges: [] },
  },
});

jest.mock('../../backend/src/config/firebase', () => ({
  initFirebase: jest.fn(),
  getDb: () => mockDb,
  getAuth: jest.fn(),
  getStorage: jest.fn(),
}));

jest.mock('../../backend/src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { uid: TEST_UID, email: 'test@example.com', name: 'Test User' };
    next();
  },
  optionalAuthMiddleware: (req, res, next) => {
    req.user = { uid: TEST_UID, email: 'test@example.com', name: 'Test User' };
    next();
  },
  resolveUserFromToken: jest.fn(),
}));

jest.mock('../../backend/src/services/pubsubService', () => ({
  publishCarbonEvent: jest.fn().mockResolvedValue('mock-message-id'),
  TOPIC: 'carbon-events',
}));

const app = require('../../backend/src/index');

describe('Gamification API', () => {
  test('GET /api/v1/gamification/state returns level, points and badges', async () => {
    const res = await request(app).get('/api/v1/gamification/state');
    expect(res.status).toBe(200);
    expect(res.body.points).toBe(120);
    expect(res.body.level.name).toBeDefined();
    expect(res.body.availableBadges.length).toBeGreaterThan(0);
    expect(res.body.earnedBadges.some((b) => b.id === 'first_log')).toBe(true);
  });

  test('GET /api/v1/gamification/leaderboard returns ranked users', async () => {
    const res = await request(app).get('/api/v1/gamification/leaderboard');
    expect(res.status).toBe(200);
    expect(res.body.leaderboard[0].points).toBeGreaterThanOrEqual(res.body.leaderboard[1].points);
    expect(res.body.leaderboard[0].rank).toBe(1);
    expect(res.body.leaderboard[0].anonymousId).toMatch(/^EcoUser_/);
  });

  test('GET /api/v1/gamification/challenges returns a list of challenges', async () => {
    const res = await request(app).get('/api/v1/gamification/challenges');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.challenges)).toBe(true);
    expect(res.body.challenges.length).toBeGreaterThan(0);
    expect(res.body.challenges[0]).toHaveProperty('points');
  });
});
