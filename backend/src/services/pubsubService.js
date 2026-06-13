'use strict';

const { PubSub } = require('@google-cloud/pubsub');
const { logger } = require('../config/logger');

const TOPIC = process.env.PUBSUB_TOPIC || 'carbon-events';
let client = null;

function getClient() {
  if (!client) client = new PubSub({ projectId: process.env.GCP_PROJECT_ID });
  return client;
}

async function publishCarbonEvent(eventType, payload) {
  const message = {
    eventType,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  try {
    const topic = getClient().topic(TOPIC);
    const [exists] = await topic.exists();
    if (!exists) {
      await topic.create();
      logger.info(`Created Pub/Sub topic: ${TOPIC}`);
    }
    const messageId = await topic.publishMessage({ json: message });
    logger.info(`Published ${eventType} event`, { messageId, uid: payload.userId });
    return messageId;
  } catch (err) {
    logger.error(`Pub/Sub publish failed: ${err.message}`);
    throw err;
  }
}

module.exports = { publishCarbonEvent, TOPIC };
