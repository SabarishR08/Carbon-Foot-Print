/**
 * BigQuery client — analytics and aggregate emissions data
 */

'use strict';

const { BigQuery } = require('@google-cloud/bigquery');
const { logger } = require('./logger');

let bqClient = null;

function getBigQuery() {
  if (bqClient) return bqClient;
  bqClient = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID,
    location: process.env.BQ_LOCATION || 'US',
  });
  logger.info('✅ BigQuery client initialized');
  return bqClient;
}

const DATASET = process.env.BQ_DATASET || 'ecotrack_analytics';
const TABLES = {
  ACTIVITIES: 'user_activities',
  EMISSIONS: 'emissions_log',
  INSIGHTS: 'ai_insights',
  GOALS: 'user_goals',
};

async function ensureDataset() {
  const bq = getBigQuery();
  const dataset = bq.dataset(DATASET);
  const [exists] = await dataset.exists();
  if (!exists) {
    await dataset.create({ location: process.env.BQ_LOCATION || 'US' });
    logger.info(`BigQuery dataset created: ${DATASET}`);
  }
  return dataset;
}

module.exports = { getBigQuery, DATASET, TABLES, ensureDataset };
