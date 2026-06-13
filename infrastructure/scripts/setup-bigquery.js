'use strict';
const path = require('path');
const { BigQuery } = require(path.join(__dirname, '../../backend/node_modules/@google-cloud/bigquery'));

const PROJECT = process.env.GCP_PROJECT_ID || 'agentflow-prod-assistant';
const DATASET = 'ecotrack_analytics';

const bq = new BigQuery({ projectId: PROJECT });

const tables = {
  carbon_usage: [
    { name: 'id', type: 'STRING' }, { name: 'user_id', type: 'STRING' },
    { name: 'category', type: 'STRING' }, { name: 'subtype', type: 'STRING' },
    { name: 'co2e_kg', type: 'FLOAT64' }, { name: 'value', type: 'FLOAT64' },
    { name: 'unit', type: 'STRING' }, { name: 'recorded_at', type: 'TIMESTAMP' },
  ],
  user_activity: [
    { name: 'user_id', type: 'STRING' }, { name: 'action', type: 'STRING' },
    { name: 'metadata', type: 'STRING' }, { name: 'created_at', type: 'TIMESTAMP' },
  ],
  ai_recommendations: [
    { name: 'user_id', type: 'STRING' }, { name: 'insight_type', type: 'STRING' },
    { name: 'content', type: 'STRING' }, { name: 'created_at', type: 'TIMESTAMP' },
  ],
  emissions_trends: [
    { name: 'user_id', type: 'STRING' }, { name: 'week_start', type: 'DATE' },
    { name: 'total_co2e_kg', type: 'FLOAT64' }, { name: 'transport_kg', type: 'FLOAT64' },
    { name: 'food_kg', type: 'FLOAT64' }, { name: 'energy_kg', type: 'FLOAT64' },
    { name: 'water_kg', type: 'FLOAT64' }, { name: 'waste_kg', type: 'FLOAT64' },
    { name: 'shopping_kg', type: 'FLOAT64' },
  ],
};

async function main() {
  const [exists] = await bq.dataset(DATASET).exists();
  if (!exists) await bq.createDataset(DATASET, { location: 'US' });
  for (const [name, schema] of Object.entries(tables)) {
    const table = bq.dataset(DATASET).table(name);
    const [tExists] = await table.exists();
    if (!tExists) {
      await table.create({ schema });
      console.log(`Created ${DATASET}.${name}`);
    } else {
      console.log(`Exists ${DATASET}.${name}`);
    }
  }
  console.log('BigQuery setup complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
