'use strict';

const request = require('supertest');
const { createMockFirestore } = require('../helpers/mockFirestore');

const mockDb = createMockFirestore({
  users: {
    'uid-123': { uid: 'uid-123', email: 'known@example.com', displayName: 'Known User', role: 'user' },
  },
});

jest.mock('../../backend/src/config/firebase', () => ({
  initFirebase: jest.fn(),
  getDb: () => mockDb,
  getAuth: jest.fn(),
  getStorage: jest.fn(),
}));

const mockResolveUserFromToken = jest.fn();

jest.mock('../../backend/src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  optionalAuthMiddleware: (req, res, next) => next(),
  resolveUserFromToken: (...args) => mockResolveUserFromToken(...args),
}));

jest.mock('../../backend/src/services/pubsubService', () => ({
  publishCarbonEvent: jest.fn().mockResolvedValue('mock-message-id'),
  TOPIC: 'carbon-events',
}));

const app = require('../../backend/src/index');

describe('Auth API', () => {
  afterEach(() => {
    mockResolveUserFromToken.mockReset();
  });

  test('POST /api/v1/auth/verify returns 400 when idToken is missing', async () => {
    const res = await request(app).post('/api/v1/auth/verify').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('idToken required');
  });

  test('POST /api/v1/auth/verify returns the existing profile for a known user', async () => {
    mockResolveUserFromToken.mockResolvedValue({ uid: 'uid-123', email: 'known@example.com', authProvider: 'google.com' });

    const res = await request(app).post('/api/v1/auth/verify').send({ idToken: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.user.uid).toBe('uid-123');
    expect(res.body.user.displayName).toBe('Known User');
    expect(res.body.authProvider).toBe('google.com');
  });

  test('POST /api/v1/auth/verify returns the resolved profile for a new user', async () => {
    mockResolveUserFromToken.mockResolvedValue({ uid: 'uid-new', email: 'new@example.com', authProvider: 'firebase' });

    const res = await request(app).post('/api/v1/auth/verify').send({ idToken: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.user.uid).toBe('uid-new');
    expect(res.body.authProvider).toBe('firebase');
  });

  test('POST /api/v1/auth/verify returns 401 for an invalid token', async () => {
    mockResolveUserFromToken.mockRejectedValue(new Error('Token verification failed'));

    const res = await request(app).post('/api/v1/auth/verify').send({ idToken: 'bad-token' });

    expect(res.status).toBe(500);
  });
});
