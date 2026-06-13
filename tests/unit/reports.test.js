'use strict';

const request = require('supertest');
const { createMockFirestore } = require('../helpers/mockFirestore');

const TEST_UID = 'test-user-1';

const mockDb = createMockFirestore({});

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

jest.mock('../../backend/src/services/reportService', () => ({
  generateReport: jest.fn().mockResolvedValue({
    id: 'report_1',
    userId: TEST_UID,
    fileName: 'reports/test-user-1/123-sustainability-report.pdf',
    bucket: 'demo-bucket',
    score: 78,
    grade: 'B',
    createdAt: '2026-06-12T00:00:00.000Z',
    downloadUrl: 'https://storage.googleapis.com/demo-bucket/report.pdf?signed=true',
  }),
  listReports: jest.fn().mockResolvedValue([
    { id: 'report_0', score: 70, grade: 'B', createdAt: '2026-06-01T00:00:00.000Z' },
  ]),
}));

const app = require('../../backend/src/index');
const { publishCarbonEvent } = require('../../backend/src/services/pubsubService');

describe('Reports API', () => {
  test('GET /api/v1/reports lists previously generated reports', async () => {
    const res = await request(app).get('/api/v1/reports');
    expect(res.status).toBe(200);
    expect(res.body.reports).toHaveLength(1);
  });

  test('POST /api/v1/reports/generate creates a PDF sustainability report', async () => {
    const res = await request(app).post('/api/v1/reports/generate');
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('report_1');
    expect(res.body.downloadUrl).toContain('https://');
    expect(res.body.grade).toBe('B');
    expect(publishCarbonEvent).toHaveBeenCalledWith('report.generated', expect.objectContaining({ userId: TEST_UID }));
  });
});
