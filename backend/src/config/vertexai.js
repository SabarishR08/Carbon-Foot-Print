/**
 * Vertex AI (Gemini Pro) client configuration
 * Used for generating personalized carbon reduction insights
 */

'use strict';

const { VertexAI } = require('@google-cloud/vertexai');
const { logger } = require('./logger');

let vertexClient = null;
let generativeModel = null;

function getVertexAI() {
  if (vertexClient) return { vertexClient, generativeModel };

  const project = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_REGION || 'us-central1';

  if (!project) {
    logger.warn('GCP_PROJECT_ID not set — Vertex AI disabled');
    return { vertexClient: null, generativeModel: null };
  }

  vertexClient = new VertexAI({ project, location });

  generativeModel = vertexClient.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.4,
      topP: 0.9,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  });

  logger.info(`✅ Vertex AI initialized [project=${project}, region=${location}]`);
  return { vertexClient, generativeModel };
}

module.exports = { getVertexAI };
