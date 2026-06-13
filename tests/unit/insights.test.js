'use strict';

const request = require('supertest');
const { createMockFirestore } = require('../helpers/mockFirestore');

const TEST_UID = 'test-user-1';

const mockDb = createMockFirestore({
  users: {
    [TEST_UID]: { uid: TEST_UID, email: 'test@example.com', dietType: 'vegetarian' },
  },
  activities: {
    a1: { userId: TEST_UID, category: 'transport', subtype: 'car_petrol', co2e: 5, date: '2026-06-10T00:00:00.000Z' },
  },
  ai_history: {
    h1: { userId: TEST_UID, type: 'personalized_tips', content: { tips: ['Old tip'] }, createdAt: '2026-06-01T00:00:00.000Z' },
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

jest.mock('../../backend/src/services/aiService', () => ({
  getPersonalizedTips: jest.fn().mockResolvedValue({
    tips: ['Use public transit twice a week'],
    weeklyInsight: 'Transport is your biggest category',
    behavioralAnalysis: 'Consistent logging is helping you improve.',
    goalSuggestions: ['Reduce car trips by 20%'],
  }),
  runScenarioSimulation: jest.fn().mockResolvedValue({
    reductionKgMonthly: 45,
    scoreImpact: 12,
    monthlySavings: '$120',
    summary: 'Switching to cycling could meaningfully cut your footprint.',
    tips: ['Start with short trips', 'Track progress weekly', 'Use a bike-friendly route'],
  }),
  getAiHistory: jest.fn().mockResolvedValue([
    { id: 'h1', userId: TEST_UID, type: 'personalized_tips', content: { tips: ['Old tip'] } },
  ]),
}));

const app = require('../../backend/src/index');

describe('AI Insights API', () => {
  test('GET /api/v1/insights/tips returns personalized AI tips', async () => {
    const res = await request(app).get('/api/v1/insights/tips');
    expect(res.status).toBe(200);
    expect(res.body.tips).toContain('Use public transit twice a week');
    expect(res.body.weeklyInsight).toBeDefined();
  });

  test('POST /api/v1/insights/scenario runs a what-if simulation', async () => {
    const res = await request(app)
      .post('/api/v1/insights/scenario')
      .send({ scenario: 'What if I cycled to work instead of driving?' });

    expect(res.status).toBe(200);
    expect(res.body.reductionKgMonthly).toBe(45);
    expect(res.body.tips.length).toBeGreaterThan(0);
  });

  test('POST /api/v1/insights/scenario rejects a too-short scenario', async () => {
    const res = await request(app).post('/api/v1/insights/scenario').send({ scenario: 'Hi' });
    expect(res.status).toBe(400);
  });

  test('GET /api/v1/insights/history returns past AI interactions', async () => {
    const res = await request(app).get('/api/v1/insights/history');
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].type).toBe('personalized_tips');
  });
});
