const {
  calculateEmissions,
  calculateTotalEmissions,
  getParisTargetProgress,
  getGlobalAvgComparison,
  getFactorsForCategory,
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

  test('throws on an unknown category', () => {
    expect(() => calculateEmissions('teleportation', 'beam', 1, 'jump')).toThrow('Unknown category');
  });

  test('measured emissions include a comparisonToAvg block', () => {
    const result = calculateEmissions('energy', 'electricity_grid', 100, 'kWh');
    expect(result.comparisonToAvg).toBeDefined();
    expect(result.comparisonToAvg.label).toMatch(/Low|Below Average|Average|High/);
  });

  test('zero-emission activities (cycling/walking) return co2e of 0', () => {
    const cycling = calculateEmissions('transport', 'cycling', 50, 'km');
    const walking = calculateEmissions('transport', 'walking', 5, 'km');
    expect(cycling.co2e).toBe(0);
    expect(walking.co2e).toBe(0);
  });

  test('getGlobalAvgComparison labels low emissions as Excellent', () => {
    const comparison = getGlobalAvgComparison(1000);
    expect(comparison.label).toBe('Excellent');
    expect(comparison.ratio).toBeLessThan(0.5);
  });

  test('getGlobalAvgComparison labels high emissions as High', () => {
    const comparison = getGlobalAvgComparison(15000);
    expect(comparison.label).toBe('High');
  });

  test('getParisTargetProgress marks on_track for low emissions', () => {
    const progress = getParisTargetProgress(1000);
    expect(progress.status).toBe('on_track');
    expect(progress.surplusKg).toBe(0);
  });

  test('getFactorsForCategory returns null for an unknown category', () => {
    expect(getFactorsForCategory('teleportation')).toBeNull();
  });

  test('getFactorsForCategory returns factors for a known category', () => {
    const factors = getFactorsForCategory('waste');
    expect(factors.landfill_general).toBeDefined();
  });

  test('calculateTotalEmissions includes parisTargetProgress and globalAvgComparison', () => {
    const activities = [
      { category: 'energy', subtype: 'electricity_grid', value: 200, unit: 'kWh' },
      { category: 'waste', subtype: 'landfill_general', value: 5, unit: 'kg' },
    ];
    const result = calculateTotalEmissions(activities);
    expect(result.parisTargetProgress).toBeDefined();
    expect(result.globalAvgComparison).toBeDefined();
    expect(result.breakdown).toHaveLength(2);
  });
});
