'use strict';

const { getBigQuery, DATASET, TABLES } = require('../config/bigquery');
const { logger } = require('../config/logger');

const ANALYTICS_TABLES = {
  CARBON_USAGE: 'carbon_usage',
  USER_ACTIVITY: 'user_activity',
  AI_RECOMMENDATIONS: 'ai_recommendations',
  EMISSIONS_TRENDS: 'emissions_trends',
};

async function ensureTables() {
  const bq = getBigQuery();
  const dataset = bq.dataset(DATASET);
  const [dsExists] = await dataset.exists();
  if (!dsExists) {
    await dataset.create({ location: process.env.BQ_LOCATION || 'US' });
  }

  const schemas = {
    [ANALYTICS_TABLES.CARBON_USAGE]: [
      { name: 'id', type: 'STRING' },
      { name: 'user_id', type: 'STRING' },
      { name: 'category', type: 'STRING' },
      { name: 'subtype', type: 'STRING' },
      { name: 'co2e_kg', type: 'FLOAT64' },
      { name: 'value', type: 'FLOAT64' },
      { name: 'unit', type: 'STRING' },
      { name: 'recorded_at', type: 'TIMESTAMP' },
    ],
    [ANALYTICS_TABLES.USER_ACTIVITY]: [
      { name: 'user_id', type: 'STRING' },
      { name: 'action', type: 'STRING' },
      { name: 'metadata', type: 'STRING' },
      { name: 'created_at', type: 'TIMESTAMP' },
    ],
    [ANALYTICS_TABLES.AI_RECOMMENDATIONS]: [
      { name: 'user_id', type: 'STRING' },
      { name: 'insight_type', type: 'STRING' },
      { name: 'content', type: 'STRING' },
      { name: 'created_at', type: 'TIMESTAMP' },
    ],
    [ANALYTICS_TABLES.EMISSIONS_TRENDS]: [
      { name: 'user_id', type: 'STRING' },
      { name: 'week_start', type: 'DATE' },
      { name: 'total_co2e_kg', type: 'FLOAT64' },
      { name: 'transport_kg', type: 'FLOAT64' },
      { name: 'food_kg', type: 'FLOAT64' },
      { name: 'energy_kg', type: 'FLOAT64' },
      { name: 'water_kg', type: 'FLOAT64' },
      { name: 'waste_kg', type: 'FLOAT64' },
      { name: 'shopping_kg', type: 'FLOAT64' },
    ],
    [TABLES.ACTIVITIES]: [
      { name: 'id', type: 'STRING' },
      { name: 'user_id', type: 'STRING' },
      { name: 'category', type: 'STRING' },
      { name: 'co2e_kg', type: 'FLOAT64' },
      { name: 'recorded_at', type: 'TIMESTAMP' },
    ],
  };

  for (const [tableName, schema] of Object.entries(schemas)) {
    const table = dataset.table(tableName);
    const [exists] = await table.exists();
    if (!exists) {
      await table.create({ schema });
      logger.info(`BigQuery table created: ${DATASET}.${tableName}`);
    }
  }
}

async function queryWeeklyTrends(userId) {
  const bq = getBigQuery();
  const query = `
    SELECT week_start, total_co2e_kg,
      transport_kg, food_kg, energy_kg, water_kg, waste_kg, shopping_kg
    FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.${ANALYTICS_TABLES.EMISSIONS_TRENDS}\`
    WHERE user_id = @userId
    ORDER BY week_start DESC
    LIMIT 12
  `;
  const [rows] = await bq.query({ query, params: { userId } });
  return rows;
}

async function queryCategoryBreakdown(userId) {
  const bq = getBigQuery();
  const query = `
    SELECT category, SUM(co2e_kg) as total_kg, COUNT(*) as record_count
    FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.${ANALYTICS_TABLES.CARBON_USAGE}\`
    WHERE user_id = @userId
      AND recorded_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
    GROUP BY category
    ORDER BY total_kg DESC
  `;
  const [rows] = await bq.query({ query, params: { userId } });
  return rows;
}

async function queryAnonymousComparison() {
  const bq = getBigQuery();
  const query = `
    SELECT
      APPROX_QUANTILES(total_co2e_kg, 4)[OFFSET(1)] as p25,
      APPROX_QUANTILES(total_co2e_kg, 4)[OFFSET(2)] as median,
      APPROX_QUANTILES(total_co2e_kg, 4)[OFFSET(3)] as p75,
      AVG(total_co2e_kg) as average
    FROM (
      SELECT user_id, SUM(co2e_kg) as total_co2e_kg
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.${ANALYTICS_TABLES.CARBON_USAGE}\`
      WHERE recorded_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      GROUP BY user_id
    )
  `;
  const [rows] = await bq.query({ query });
  return rows[0] || {};
}

module.exports = {
  ANALYTICS_TABLES,
  ensureTables,
  queryWeeklyTrends,
  queryCategoryBreakdown,
  queryAnonymousComparison,
};
