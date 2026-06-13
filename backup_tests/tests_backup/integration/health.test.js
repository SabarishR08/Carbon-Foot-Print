const request = require('supertest');

jest.mock('../../backend/src/config/firebase', () => ({
  initFirebase: jest.fn(),
  getDb: jest.fn(),
  getAuth: jest.fn(),
  getStorage: jest.fn(),
}));

const app = require('../../backend/src/index');

describe('Health Endpoints', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('carbon-footprint-api');
  });

  test('GET /health/ready returns 200', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  test('GET /unknown returns 404', async () => {
    const res = await request(app).get('/api/v1/unknown');
    expect(res.status).toBe(404);
  });
});
