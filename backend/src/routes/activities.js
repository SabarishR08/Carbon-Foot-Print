'use strict';

const express = require('express');
const { randomUUID } = require('crypto');
const { getDb } = require('../config/firebase');
const { validate, activitySchema } = require('../middleware/validate');
const { calculateEmissions } = require('../services/carbonCalculator');
const { publishCarbonEvent } = require('../services/pubsubService');
const { awardPoints, updateStreak } = require('../services/gamificationService');
const { logger } = require('../config/logger');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;
    let query = getDb().collection('activities').where('userId', '==', req.user.uid);
    if (category) query = query.where('category', '==', category);
    const snap = await query.orderBy('date', 'desc').limit(Number(limit)).offset(Number(offset)).get();
    const activities = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ activities, count: activities.length });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(activitySchema), async (req, res, next) => {
  try {
    const { category, subtype, value, unit, date, notes, metadata } = req.body;
    const emission = calculateEmissions(category, subtype, value, unit);

    const activity = {
      id: randomUUID(),
      userId: req.user.uid,
      category,
      subtype,
      value,
      unit,
      date: date || new Date().toISOString(),
      notes: notes || '',
      metadata: metadata || {},
      co2e: emission.co2e,
      emissionDetails: emission,
      createdAt: new Date().toISOString(),
    };

    await getDb().collection('activities').doc(activity.id).set(activity);

    try {
      await publishCarbonEvent('carbon.record.created', {
        userId: req.user.uid,
        activityId: activity.id,
        category,
        subtype,
        co2eKg: emission.co2e,
        value,
        unit,
        recordedAt: activity.date,
      });
    } catch (pubsubErr) {
      logger.warn('Pub/Sub publish failed (non-blocking):', pubsubErr.message);
    }

    const streak = await updateStreak(req.user.uid);
    const level = await awardPoints(req.user.uid, 10, 'activity_logged');

    logger.info('Activity created', { uid: req.user.uid, category, co2e: emission.co2e });

    res.status(201).json({ activity, gamification: { streak, level } });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await getDb().collection('activities').doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.uid) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await getDb().collection('activities').doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.uid) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    await doc.ref.delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
