/**
 * Global error handler — maps errors to HTTP responses
 * Reports to Cloud Error Reporting in production
 */

'use strict';

const { logger } = require('../config/logger');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log full error for Cloud Logging / Error Reporting
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    uid: req.user?.uid || 'anonymous',
    // Cloud Error Reporting format
    '@type': 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
  });

  // Joi validation error
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details?.map((d) => d.message) || [err.message],
    });
  }

  // Firestore permission denied
  if (err.code === 7 || err.message?.includes('PERMISSION_DENIED')) {
    return res.status(403).json({ error: 'Forbidden', message: 'Access denied.' });
  }

  // Firestore not found
  if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
    return res.status(404).json({ error: 'Not Found', message: err.message });
  }

  // Known HTTP errors
  if (err.statusCode || err.status) {
    const status = err.statusCode || err.status;
    return res.status(status).json({
      error: err.message || 'Request failed',
    });
  }

  // Unknown server error (don't leak details in production)
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: 'Internal Server Error',
    ...(isDev && { message: err.message, stack: err.stack }),
  });
}

module.exports = { errorHandler };
