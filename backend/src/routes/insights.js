'use strict';

const express = require('express');
const Joi = require('joi');
const { getDb } = require('../config/firebase');
const { validate } = require('../middleware/validate');
const { getPersonalizedTips, runScenarioSimulation, getAiHistory } = require('../services/aiService');
const { awardPoints } = require('../services/gamificationService');

const router = express.Router();

const scenarioSchema = Joi.object({
  scenario: Joi.string().min(5).max(500).required(),
});

router.get('/tips', async (req, res, next) => {
  try {
    const userDoc = await getDb().collection('users').doc(req.user.uid).get();
    const profile = userDoc.exists ? userDoc.data() : {};

    const actSnap = await getDb().collection('activities')
      .where('userId', '==', req.user.uid)
      .orderBy('date', 'desc')
      .limit(10)
      .get();
    const recentActivities = actSnap.docs.map((d) => d.data());

    const tips = await getPersonalizedTips(req.user.uid, profile, recentActivities);
    try { await awardPoints(req.user.uid, 5, 'ai_tips'); } catch (_) { /* non-blocking */ }
    res.json(tips);
  } catch (err) {
    next(err);
  }
});

router.post('/scenario', validate(scenarioSchema), async (req, res, next) => {
  try {
    const result = await runScenarioSimulation(req.user.uid, req.body.scenario);
    try { await awardPoints(req.user.uid, 15, 'scenario_simulation'); } catch (_) { /* non-blocking */ }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const history = await getAiHistory(req.user.uid);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
