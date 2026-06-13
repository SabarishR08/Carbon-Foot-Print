'use strict';

const { validate, activitySchema, goalSchema, userProfileSchema } = require('../../backend/src/middleware/validate');

function runMiddleware(schema, body, target = 'body') {
  const req = { body, query: body, params: body };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  validate(schema, target)(req, res, next);
  return { req, res, nextCalled };
}

describe('Validation Middleware', () => {
  test('activitySchema accepts a valid activity', () => {
    const { nextCalled, res, req } = runMiddleware(activitySchema, {
      category: 'transport',
      subtype: 'car_petrol',
      value: 10,
      unit: 'km',
    });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBeNull();
    expect(req.body.category).toBe('transport');
  });

  test('activitySchema defaults the date field when missing', () => {
    const { req, nextCalled } = runMiddleware(activitySchema, {
      category: 'food',
      subtype: 'meal_vegan',
      value: 1,
      unit: 'meal',
    });
    expect(nextCalled).toBe(true);
    expect(req.body.date).toBeDefined();
  });

  test('activitySchema rejects an unknown category', () => {
    const { res, nextCalled } = runMiddleware(activitySchema, {
      category: 'spaceship',
      subtype: 'rocket',
      value: 1,
      unit: 'launch',
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  test('activitySchema rejects values over the max bound', () => {
    const { res } = runMiddleware(activitySchema, {
      category: 'transport',
      subtype: 'car_petrol',
      value: 999999,
      unit: 'km',
    });
    expect(res.statusCode).toBe(400);
  });

  test('activitySchema strips unknown fields', () => {
    const { req } = runMiddleware(activitySchema, {
      category: 'transport',
      subtype: 'bus',
      value: 5,
      unit: 'km',
      maliciousField: '<script>alert(1)</script>',
    });
    expect(req.body.maliciousField).toBeUndefined();
  });

  test('goalSchema accepts a valid goal', () => {
    const { nextCalled } = runMiddleware(goalSchema, {
      title: 'Reduce transport emissions',
      category: 'transport',
      targetReduction: 25,
      targetDate: '2027-01-01T00:00:00.000Z',
    });
    expect(nextCalled).toBe(true);
  });

  test('goalSchema rejects targetReduction above 100', () => {
    const { res } = runMiddleware(goalSchema, {
      title: 'Reduce transport emissions',
      category: 'transport',
      targetReduction: 150,
      targetDate: '2027-01-01T00:00:00.000Z',
    });
    expect(res.statusCode).toBe(400);
  });

  test('userProfileSchema accepts a partial profile update', () => {
    const { nextCalled, req } = runMiddleware(userProfileSchema, { dietType: 'vegan', householdSize: 2 });
    expect(nextCalled).toBe(true);
    expect(req.body.dietType).toBe('vegan');
  });

  test('userProfileSchema rejects an invalid vehicleType', () => {
    const { res } = runMiddleware(userProfileSchema, { vehicleType: 'rocket' });
    expect(res.statusCode).toBe(400);
  });

  test('validation error response lists every failing field', () => {
    const { res } = runMiddleware(activitySchema, {});
    expect(res.body.details.length).toBeGreaterThanOrEqual(3); // category, subtype, value, unit
  });
});
