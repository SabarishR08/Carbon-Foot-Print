'use strict';

const express = require('express');
const { resolveUserFromToken } = require('../middleware/auth');
const { getDb } = require('../config/firebase');

const router = express.Router();

/** Verify token and return user profile (Google or Firebase) */
router.post('/verify', async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const user = await resolveUserFromToken(idToken);
    const doc = await getDb().collection('users').doc(user.uid).get();

    res.json({
      user: doc.exists ? { id: doc.id, ...doc.data() } : user,
      authProvider: user.authProvider,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
