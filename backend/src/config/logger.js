/**
 * Winston logger — outputs structured JSON for Cloud Logging
 * Log entries include severity, trace, and request context
 */

'use strict';

const { createLogger, format, transports } = require('winston');

const isProduction = process.env.NODE_ENV === 'production';

// Cloud Logging compatible JSON format
const gcpFormat = format.printf(({ level, message, timestamp, ...meta }) => {
  const entry = {
    severity: level.toUpperCase(),
    message,
    timestamp,
    ...meta,
    // Cloud Logging structured log fields
    'logging.googleapis.com/labels': {
      service: 'ecotrack-api',
      version: process.env.K_REVISION || 'local',
    },
  };
  return JSON.stringify(entry);
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    isProduction ? gcpFormat : format.combine(format.colorize(), format.simple()),
  ),
  transports: [new transports.Console()],
  exitOnError: false,
});

// Stream for Morgan HTTP logging
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = { logger };
