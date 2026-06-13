'use strict';

const express = require('express');
const { getDb } = require('../config/firebase');
const { validate, userProfileSchema } = require('../middleware/validate');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.get('/me', async (req, res, next) => {
  try {
    const ref = getDb().collection('users').doc(req.user.uid);
    const doc = await ref.get();
    if (!doc.exists) {
      const profile = {
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.name || 'Eco User',
        role: 'user',
        createdAt: new Date().toISOString(),
      };
      await ref.set(profile);
      return res.json(profile);
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', validate(userProfileSchema), async (req, res, next) => {
  try {
    const ref = getDb().collection('users').doc(req.user.uid);
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    await ref.set(updates, { merge: true });
    const doc = await ref.get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const snap = await getDb().collection('users').limit(100).get();
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ users, count: users.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
