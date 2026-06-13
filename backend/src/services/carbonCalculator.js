/**
 * Carbon Emissions Calculation Service
 * Emission factors sourced from:
 *   - IPCC AR6 (2023)
 *   - EPA Emission Factors Hub (2023)
 *   - Our World in Data (2023)
 * Units: kg CO₂e per unit
 */

'use strict';

// ─── Emission Factors (kg CO₂e) ─────────────────────────────────────────────

const FACTORS = {
  transport: {
    // per km
    car_petrol:        0.192,
    car_diesel:        0.171,
    car_hybrid:        0.105,
    car_electric:      0.053,
    motorcycle:        0.114,
    bus:               0.089,
    train:             0.041,
    metro:             0.028,
    cycling:           0.0,
    walking:           0.0,
    // per km (aviation)
    flight_short:      0.255,   // <3h
    flight_medium:     0.195,   // 3-6h
    flight_long:       0.150,   // >6h
    ferry:             0.113,
  },
  food: {
    // per kg consumed
    beef:             27.0,
    lamb:             39.2,
    pork:              7.6,
    chicken:           6.9,
    fish_farmed:       5.1,
    fish_wild:         3.0,
    eggs:              4.5,
    dairy_milk:        3.2,
    dairy_cheese:     13.5,
    vegetables:        2.0,
    fruits:            1.1,
    legumes:           0.9,
    grains:            1.4,
    nuts:              2.5,
    processed_food:    7.0,
    // per meal
    meal_vegan:        1.5,
    meal_vegetarian:   2.5,
    meal_pescatarian:  3.2,
    meal_omnivore:     5.3,
    meal_beef_heavy:   9.2,
  },
  energy: {
    // per kWh
    electricity_grid:  0.233,   // global avg
    electricity_renewable: 0.020,
    electricity_solar: 0.041,
    electricity_wind:  0.011,
    // per litre
    natural_gas:       2.204,
    heating_oil:       2.520,
    lpg:               1.630,
    // per m3
    natural_gas_m3:    2.0,
  },
  shopping: {
    // per item/purchase
    clothing_new:      33.4,
    clothing_second_hand: 2.0,
    electronics_phone: 70.0,
    electronics_laptop: 422.0,
    electronics_tv:    350.0,
    furniture:         200.0,
    // per £/$/€ spent
    general_spending:  0.48,
    online_delivery:   0.15,
  },
  water: {
    // per litre (embedded energy + treatment)
    tap:               0.0003,
    bottled:           0.0005,
    hot_shower:        0.002,
    dishwasher_load:   0.5,
    laundry_load:      0.6,
    garden_irrigation: 0.001,
  },
  waste: {
    // per kg
    landfill_general:  0.468,
    landfill_food:     0.558,
    recycled:          0.021,
    composted:         0.010,
    // per bag
    rubbish_bag_landfill: 4.0,
    rubbish_bag_recycled: 0.2,
  },
};

// ─── Category Averages (for progress tracking) ─────────────────────────────

const GLOBAL_ANNUAL_AVERAGES_KG = {
  transport: 1800,
  food:      1500,
  energy:    2200,
  shopping:  800,
  water:     200,
  waste:     400,
  total:     6900,
};

const PARIS_TARGET_KG_ANNUAL = 2300; // ~2.3t CO₂e/yr per capita for 1.5°C target

// ─── Calculator ─────────────────────────────────────────────────────────────

/**
 * Calculate CO₂e (kg) for a given activity
 * @param {string} category - transport|food|energy|shopping|waste
 * @param {string} subtype - specific activity type
 * @param {number} value - amount
 * @param {string} unit - km|kg|kWh|item|bag|meal|litre|m3
 * @returns {{ co2e: number, unit: string, factor: number, tier: string }}
 */
function calculateEmissions(category, subtype, value, unit) {
  const categoryFactors = FACTORS[category];

  if (!categoryFactors) {
    throw new Error(`Unknown category: ${category}`);
  }

  const factor = categoryFactors[subtype];

  if (factor === undefined) {
    // Fallback: use average for category
    const avgFactor = Object.values(categoryFactors).reduce((a, b) => a + b, 0)
      / Object.values(categoryFactors).length;
    const co2e = parseFloat((avgFactor * value).toFixed(4));
    return { co2e, unit: 'kg CO₂e', factor: avgFactor, tier: 'estimated', subtype };
  }

  const co2e = parseFloat((factor * value).toFixed(4));

  return {
    co2e,
    unit: 'kg CO₂e',
    factor,
    tier: 'measured',
    subtype,
    category,
    comparisonToAvg: getComparisonToAverage(category, co2e),
  };
}

/**
 * Calculate total emissions for a set of activities
 * @param {Array<{category, subtype, value, unit}>} activities
 * @returns {{ total: number, byCategory: Object, breakdown: Array }}
 */
function calculateTotalEmissions(activities) {
  const byCategory = {};
  const breakdown = [];
  let total = 0;

  for (const activity of activities) {
    const result = calculateEmissions(
      activity.category,
      activity.subtype,
      activity.value,
      activity.unit,
    );

    total += result.co2e;

    if (!byCategory[activity.category]) byCategory[activity.category] = 0;
    byCategory[activity.category] += result.co2e;

    breakdown.push({
      ...activity,
      ...result,
    });
  }

  return {
    total: parseFloat(total.toFixed(4)),
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, parseFloat(v.toFixed(4))]),
    ),
    breakdown,
    parisTargetProgress: getParisTargetProgress(total),
    globalAvgComparison: getGlobalAvgComparison(total),
  };
}

/**
 * Get progress toward Paris Agreement target
 */
function getParisTargetProgress(annualKg) {
  const progress = Math.min(100, (annualKg / PARIS_TARGET_KG_ANNUAL) * 100);
  return {
    currentKg: annualKg,
    targetKg: PARIS_TARGET_KG_ANNUAL,
    percentOfTarget: parseFloat(progress.toFixed(1)),
    status: annualKg <= PARIS_TARGET_KG_ANNUAL ? 'on_track' : 'above_target',
    surplusKg: Math.max(0, parseFloat((annualKg - PARIS_TARGET_KG_ANNUAL).toFixed(2))),
  };
}

function getGlobalAvgComparison(annualKg) {
  const ratio = annualKg / GLOBAL_ANNUAL_AVERAGES_KG.total;
  return {
    globalAvgKg: GLOBAL_ANNUAL_AVERAGES_KG.total,
    ratio: parseFloat(ratio.toFixed(2)),
    percentOfGlobalAvg: parseFloat((ratio * 100).toFixed(1)),
    label: ratio < 0.5 ? 'Excellent' : ratio < 0.75 ? 'Good' : ratio < 1 ? 'Average' : ratio < 1.5 ? 'Above Average' : 'High',
  };
}

function getComparisonToAverage(category, co2eKg) {
  const avg = GLOBAL_ANNUAL_AVERAGES_KG[category];
  if (!avg) return null;
  // Normalize to monthly
  const monthlyAvg = avg / 12;
  const ratio = co2eKg / monthlyAvg;
  return {
    monthlyAverageKg: parseFloat(monthlyAvg.toFixed(2)),
    ratio: parseFloat(ratio.toFixed(2)),
    label: ratio < 0.5 ? 'Low' : ratio < 1 ? 'Below Average' : ratio < 1.5 ? 'Average' : 'High',
  };
}

/**
 * Get emission factors for a category (for frontend dropdowns)
 */
function getFactorsForCategory(category) {
  return FACTORS[category] || null;
}

function getAllFactors() {
  return FACTORS;
}

module.exports = {
  calculateEmissions,
  calculateTotalEmissions,
  getParisTargetProgress,
  getGlobalAvgComparison,
  getFactorsForCategory,
  getAllFactors,
  FACTORS,
  GLOBAL_ANNUAL_AVERAGES_KG,
  PARIS_TARGET_KG_ANNUAL,
};
