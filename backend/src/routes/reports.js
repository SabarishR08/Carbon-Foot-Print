'use strict';

const express = require('express');
const { generateReport, listReports } = require('../services/reportService');
const { publishCarbonEvent } = require('../services/pubsubService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const reports = await listReports(req.user.uid);
    res.json({ reports });
  } catch (err) {
    next(err);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const report = await generateReport(req.user.uid, req.user.email);
    try {
      await publishCarbonEvent('report.generated', {
        userId: req.user.uid,
        reportId: report.id,
      });
    } catch (pubsubErr) {
      // non-blocking: don't fail report generation if pubsub is unavailable
    }
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
