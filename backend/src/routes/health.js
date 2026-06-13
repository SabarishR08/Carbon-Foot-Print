'use strict';

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'carbon-footprint-api',
    version: process.env.K_REVISION || '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

router.get('/ready', async (req, res) => {
  res.status(200).json({ ready: true });
});

module.exports = router;
