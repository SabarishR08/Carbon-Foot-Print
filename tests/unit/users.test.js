'use strict';

const request = require('supertest');
const { createMockFirestore } = require('../helpers/mockFirestore');

const TEST_UID = 'test-user-1';

const mockDb = createMockFirestore({
  users: {
    [TEST_UID]: {
      uid: TEST_UID,
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'user',
      createdAt: '2026-06-01T00:00:00.000Z',
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

describe('Users API (regular user)', () => {
  test('GET /api/v1/users/me returns the current user profile', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe(TEST_UID);
    expect(res.body.role).toBe('user');
  });

  test('PATCH /api/v1/users/me updates allowed profile fields', async () => {
    const res = await request(app).patch('/api/v1/users/me').send({
      displayName: 'Updated Name',
      householdSize: 3,
      dietType: 'vegan',
    });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Updated Name');
    expect(res.body.householdSize).toBe(3);
    expect(res.body.dietType).toBe('vegan');
  });

  test('PATCH /api/v1/users/me rejects an invalid dietType', async () => {
    const res = await request(app).patch('/api/v1/users/me').send({ dietType: 'carnivore-extreme' });
    expect(res.status).toBe(400);
  });

  test('GET /api/v1/users returns 403 for a non-admin user (RBAC)', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });
});
