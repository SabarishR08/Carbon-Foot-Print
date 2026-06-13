const {
  calculateEmissions,
  calculateTotalEmissions,
  getParisTargetProgress,
  getAllFactors,
} = require('../../backend/src/services/carbonCalculator');

describe('Carbon Calculator', () => {
  test('calculates transport emissions correctly', () => {
    const result = calculateEmissions('transport', 'car_petrol', 100, 'km');
    expect(result.co2e).toBeCloseTo(19.2, 1);
    expect(result.tier).toBe('measured');
  });

  test('calculates food emissions', () => {
    const result = calculateEmissions('food', 'meal_vegan', 7, 'meal');
    expect(result.co2e).toBeCloseTo(10.5, 1);
  });

  test('calculates water emissions', () => {
    const result = calculateEmissions('water', 'tap', 1000, 'litre');
    expect(result.co2e).toBeCloseTo(0.3, 2);
  });

  test('calculates total emissions for multiple activities', () => {
    const activities = [
      { category: 'transport', subtype: 'bus', value: 50, unit: 'km' },
      { category: 'food', subtype: 'meal_vegetarian', value: 3, unit: 'meal' },
    ];
    const result = calculateTotalEmissions(activities);
    expect(result.total).toBeGreaterThan(0);
    expect(result.byCategory.transport).toBeDefined();
    expect(result.byCategory.food).toBeDefined();
  });

  test('Paris target progress calculation', () => {
    const progress = getParisTargetProgress(3000);
    expect(progress.status).toBe('above_target');
    expect(progress.targetKg).toBe(2300);
  });

  test('returns all emission factors', () => {
    const factors = getAllFactors();
    expect(factors.transport).toBeDefined();
    expect(factors.water).toBeDefined();
  });

  test('handles unknown subtype with fallback', () => {
    const result = calculateEmissions('transport', 'unknown_type', 10, 'km');
    expect(result.tier).toBe('estimated');
    expect(result.co2e).toBeGreaterThan(0);
  });
});
