'use strict';

const express = require('express');
const { randomUUID } = require('crypto');
const { getDb } = require('../config/firebase');
const { validate, goalSchema } = require('../middleware/validate');
const { awardPoints } = require('../services/gamificationService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const snap = await getDb().collection('goals')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ goals: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(goalSchema), async (req, res, next) => {
  try {
    const goal = {
      id: randomUUID(),
      userId: req.user.uid,
      ...req.body,
      status: 'active',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    await getDb().collection('goals').doc(goal.id).set(goal);
    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/complete', async (req, res, next) => {
  try {
    const ref = getDb().collection('goals').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().userId !== req.user.uid) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    await ref.update({ status: 'completed', progress: 100, completedAt: new Date().toISOString() });
    await awardPoints(req.user.uid, 50, 'goal_completed');
    const updated = await ref.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
