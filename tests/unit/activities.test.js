'use strict';

const request = require('supertest');
const { createMockFirestore } = require('../helpers/mockFirestore');

const TEST_UID = 'test-user-1';

const mockDb = createMockFirestore({
  activities: {
    seed_1: {
      id: 'seed_1',
      userId: TEST_UID,
      category: 'transport',
      subtype: 'car_petrol',
      value: 10,
      unit: 'km',
      co2e: 1.92,
      date: '2026-06-01T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
    },
    other_user: {
      id: 'other_user',
      userId: 'someone-else',
      category: 'food',
      subtype: 'meal_vegan',
      value: 1,
      unit: 'meal',
      co2e: 1.5,
      date: '2026-06-01T00:00:00.000Z',
    },
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
    req.user = { uid: 'test-user-1', email: 'test@example.com', name: 'Test User' };
    next();
  },
  optionalAuthMiddleware: (req, res, next) => {
    req.user = { uid: 'test-user-1', email: 'test@example.com', name: 'Test User' };
    next();
  },
  resolveUserFromToken: jest.fn(),
}));

jest.mock('../../backend/src/services/pubsubService', () => ({
  publishCarbonEvent: jest.fn().mockResolvedValue('mock-message-id'),
  TOPIC: 'carbon-events',
}));

const app = require('../../backend/src/index');

describe('Activities API', () => {
  test('GET /api/v1/activities returns only the current user activities', async () => {
    const res = await request(app).get('/api/v1/activities');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.activities[0].userId).toBe(TEST_UID);
  });

  test('GET /api/v1/activities filters by category', async () => {
    const res = await request(app).get('/api/v1/activities?category=transport');
    expect(res.status).toBe(200);
    expect(res.body.activities.every((a) => a.category === 'transport')).toBe(true);
  });

  test('POST /api/v1/activities creates an activity and returns computed emissions', async () => {
    const res = await request(app)
      .post('/api/v1/activities')
      .send({ category: 'transport', subtype: 'bus', value: 20, unit: 'km' });

    expect(res.status).toBe(201);
    expect(res.body.activity.co2e).toBeCloseTo(1.78, 2);
    expect(res.body.activity.userId).toBe(TEST_UID);
    expect(res.body.gamification).toBeDefined();
    expect(res.body.gamification.level).toBeDefined();
  });

  test('POST /api/v1/activities rejects invalid category', async () => {
    const res = await request(app)
      .post('/api/v1/activities')
      .send({ category: 'nonsense', subtype: 'x', value: 1, unit: 'km' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  test('POST /api/v1/activities rejects negative value', async () => {
    const res = await request(app)
      .post('/api/v1/activities')
      .send({ category: 'transport', subtype: 'bus', value: -5, unit: 'km' });

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/activities rejects missing required fields', async () => {
    const res = await request(app).post('/api/v1/activities').send({ category: 'transport' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  test('GET /api/v1/activities/:id returns 404 for another user activity', async () => {
    const res = await request(app).get('/api/v1/activities/other_user');
    expect(res.status).toBe(404);
  });

  test('GET /api/v1/activities/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/v1/activities/does-not-exist');
    expect(res.status).toBe(404);
  });

  test('GET /api/v1/activities/:id returns the activity for the owner', async () => {
    const res = await request(app).get('/api/v1/activities/seed_1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('seed_1');
  });

  test('DELETE /api/v1/activities/:id removes the activity for the owner', async () => {
    const res = await request(app).delete('/api/v1/activities/seed_1');
    expect(res.status).toBe(204);

    const after = await request(app).get('/api/v1/activities/seed_1');
    expect(after.status).toBe(404);
  });

  test('DELETE /api/v1/activities/:id returns 404 for another user activity', async () => {
    const res = await request(app).delete('/api/v1/activities/other_user');
    expect(res.status).toBe(404);
  });
});
