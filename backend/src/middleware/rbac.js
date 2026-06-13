'use strict';

const { getDb } = require('../config/firebase');
const { logger } = require('../config/logger');

async function getUserRole(uid) {
  const doc = await getDb().collection('users').doc(uid).get();
  if (!doc.exists) return 'user';
  return doc.data().role || 'user';
}

function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const role = await getUserRole(req.user.uid);
      req.user.role = role;
      if (!roles.includes(role)) {
        logger.warn(`RBAC denied: uid=${req.user.uid} role=${role} required=${roles.join('|')}`);
        return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions.' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { getUserRole, requireRole };
