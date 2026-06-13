'use strict';

const request = require('supertest');
const { createMockFirestore } = require('../helpers/mockFirestore');

const TEST_UID = 'test-user-1';

const now = Date.now();
const daysAgo = (n) => new Date(now - n * 86400000).toISOString();

const mockDb = createMockFirestore({
  activities: {
    a1: { userId: TEST_UID, category: 'transport', co2e: 10, date: daysAgo(1) },
    a2: { userId: TEST_UID, category: 'food', co2e: 5, date: daysAgo(3) },
    a3: { userId: TEST_UID, category: 'transport', co2e: 8, date: daysAgo(10) },
    a4: { userId: 'other-user', category: 'transport', co2e: 100, date: daysAgo(1) },
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

// BigQuery is unavailable in tests (no project credentials) — routes must
// gracefully fall back to Firestore-derived data.
jest.mock('../../backend/src/services/bigqueryService', () => ({
  queryWeeklyTrends: jest.fn().mockRejectedValue(new Error('BigQuery unavailable in test')),
  queryCategoryBreakdown: jest.fn().mockRejectedValue(new Error('BigQuery unavailable in test')),
  queryAnonymousComparison: jest.fn().mockRejectedValue(new Error('BigQuery unavailable in test')),
}));

const app = require('../../backend/src/index');

describe('Analytics API', () => {
  test('GET /api/v1/analytics/score returns a score within 0-100 for the user only', async () => {
    const res = await request(app).get('/api/v1/analytics/score');
    expect(res.status).toBe(200);
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
    expect(res.body.grade).toMatch(/[A-F]/);
  });

  test('GET /api/v1/analytics/trends falls back gracefully when BigQuery is unavailable', async () => {
    const res = await request(app).get('/api/v1/analytics/trends');
    expect(res.status).toBe(200);
    expect(res.body.weekly).toBeDefined();
    expect(res.body.monthly).toBeDefined();
    expect(res.body.bigQueryTrends).toEqual([]);
  });

  test('GET /api/v1/analytics/breakdown falls back to Firestore aggregation', async () => {
    const res = await request(app).get('/api/v1/analytics/breakdown');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.breakdown)).toBe(true);
    expect(res.body.breakdown.some((b) => b.category === 'transport')).toBe(true);
  });

  test('GET /api/v1/analytics/comparison returns a percentile classification', async () => {
    const res = await request(app).get('/api/v1/analytics/comparison');
    expect(res.status).toBe(200);
    expect(res.body.yourMonthlyKg).toBeGreaterThanOrEqual(0);
    expect(['top_25', 'above_average', 'needs_improvement']).toContain(res.body.percentile);
  });

  test('GET /api/v1/analytics/factors returns emission factor tables', async () => {
    const res = await request(app).get('/api/v1/analytics/factors');
    expect(res.status).toBe(200);
    expect(res.body.factors.transport).toBeDefined();
    expect(res.body.factors.food).toBeDefined();
  });

  test('GET /api/v1/analytics/score respects the days query param', async () => {
    const res7 = await request(app).get('/api/v1/analytics/score?days=7');
    const res90 = await request(app).get('/api/v1/analytics/score?days=90');
    expect(res7.status).toBe(200);
    expect(res90.status).toBe(200);
    expect(res7.body.scoringLogic.periodDays).toBe(7);
    expect(res90.body.scoringLogic.periodDays).toBe(90);
  });
});
