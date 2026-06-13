/**
 * Cloud Function (Gen 2) — Carbon Event Processor
 * Triggered by Pub/Sub: carbon-events topic
 * Inserts to BigQuery, generates AI insights, logs user activity
 */

'use strict';

const functions = require('@google-cloud/functions-framework');
const { BigQuery } = require('@google-cloud/bigquery');
const { Firestore } = require('@google-cloud/firestore');
const { VertexAI } = require('@google-cloud/vertexai');

const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const DATASET = process.env.BQ_DATASET || 'ecotrack_analytics';
const REGION = process.env.GCP_REGION || 'us-central1';

const bq = new BigQuery({ projectId: PROJECT_ID });
const db = new Firestore({ projectId: PROJECT_ID });

let generativeModel = null;
function getModel() {
  if (!generativeModel && PROJECT_ID) {
    const vertex = new VertexAI({ project: PROJECT_ID, location: REGION });
    generativeModel = vertex.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
  return generativeModel;
}

async function insertBigQuery(table, rows) {
  await bq.dataset(DATASET).table(table).insert(rows);
}

async function processCarbonRecord(data) {
  const { userId, activityId, category, subtype, co2eKg, value, unit, recordedAt } = data;

  await insertBigQuery('carbon_usage', [{
    id: activityId,
    user_id: userId,
    category,
    subtype,
    co2e_kg: co2eKg,
    value,
    unit,
    recorded_at: recordedAt || new Date().toISOString(),
  }]);

  await insertBigQuery('user_activity', [{
    user_id: userId,
    action: 'carbon_record_created',
    metadata: JSON.stringify({ category, co2eKg }),
    created_at: new Date().toISOString(),
  }]);

  const model = getModel();
  if (model) {
    try {
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `Brief carbon tip for ${category} activity (${co2eKg}kg CO2e). One sentence only.` }],
        }],
      });
      const tip = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || 'Keep tracking your progress!';

      await insertBigQuery('ai_recommendations', [{
        user_id: userId,
        insight_type: 'event_tip',
        content: tip,
        created_at: new Date().toISOString(),
      }]);

      await db.collection('ai_history').add({
        userId,
        type: 'event_tip',
        content: { tip, category, co2eKg },
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('AI insight generation failed:', err.message);
    }
  }

  console.log(`Processed carbon record: ${activityId} for user ${userId}`);
}

functions.cloudEvent('processCarbonEvent', async (cloudEvent) => {
  const data = cloudEvent.data?.message?.data
    ? JSON.parse(Buffer.from(cloudEvent.data.message.data, 'base64').toString())
  : cloudEvent.data;

  if (!data) {
    console.warn('No event data received');
    return;
  }

  console.log(`Event received: ${data.eventType}`);

  switch (data.eventType) {
    case 'carbon.record.created':
      await processCarbonRecord(data);
      break;
    case 'report.generated':
      await insertBigQuery('user_activity', [{
        user_id: data.userId,
        action: 'report_generated',
        metadata: JSON.stringify({ reportId: data.reportId }),
        created_at: new Date().toISOString(),
      }]);
      break;
    default:
      console.log(`Unhandled event type: ${data.eventType}`);
  }
});
