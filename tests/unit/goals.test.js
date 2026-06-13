'use strict';

const request = require('supertest');
const { createMockFirestore } = require('../helpers/mockFirestore');

const TEST_UID = 'test-user-1';

const mockDb = createMockFirestore({
  goals: {
    goal_1: {
      id: 'goal_1',
      userId: TEST_UID,
      title: 'Cut transport emissions',
      category: 'transport',
      targetReduction: 20,
      targetDate: '2026-12-31T00:00:00.000Z',
      status: 'active',
      progress: 0,
      createdAt: '2026-06-01T00:00:00.000Z',
    },
    goal_other: {
      id: 'goal_other',
      userId: 'someone-else',
      title: 'Not yours',
      category: 'food',
      targetReduction: 10,
      targetDate: '2026-12-31T00:00:00.000Z',
      status: 'active',
      progress: 0,
      createdAt: '2026-06-01T00:00:00.000Z',
    },
  },
  gamification: {},
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

describe('Goals API', () => {
  test('GET /api/v1/goals returns only the current user goals', async () => {
    const res = await request(app).get('/api/v1/goals');
    expect(res.status).toBe(200);
    expect(res.body.goals).toHaveLength(1);
    expect(res.body.goals[0].userId).toBe(TEST_UID);
  });

  test('POST /api/v1/goals creates a new goal', async () => {
    const res = await request(app).post('/api/v1/goals').send({
      title: 'Reduce food emissions',
      category: 'food',
      targetReduction: 15,
      targetDate: '2027-01-01T00:00:00.000Z',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.progress).toBe(0);
    expect(res.body.userId).toBe(TEST_UID);
  });

  test('POST /api/v1/goals rejects invalid targetReduction (> 100)', async () => {
    const res = await request(app).post('/api/v1/goals').send({
      title: 'Impossible goal',
      category: 'food',
      targetReduction: 200,
      targetDate: '2027-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/v1/goals rejects too-short title', async () => {
    const res = await request(app).post('/api/v1/goals').send({
      title: 'a',
      category: 'food',
      targetReduction: 10,
      targetDate: '2027-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(400);
  });

  test('PATCH /api/v1/goals/:id/complete marks a goal completed and awards points', async () => {
    const res = await request(app).patch('/api/v1/goals/goal_1/complete');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.progress).toBe(100);
    expect(res.body.completedAt).toBeDefined();
  });

  test('PATCH /api/v1/goals/:id/complete returns 404 for another user goal', async () => {
    const res = await request(app).patch('/api/v1/goals/goal_other/complete');
    expect(res.status).toBe(404);
  });

  test('PATCH /api/v1/goals/:id/complete returns 404 for unknown goal', async () => {
    const res = await request(app).patch('/api/v1/goals/does-not-exist/complete');
    expect(res.status).toBe(404);
  });
});
