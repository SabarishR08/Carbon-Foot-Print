/**
 * Authentication: Firebase ID tokens + Google OAuth ID tokens + optional guest
 */

'use strict';

const { OAuth2Client } = require('google-auth-library');
const { getAuth } = require('../config/firebase');
const { getDb } = require('../config/firebase');
const { logger } = require('../config/logger');

const GUEST_ALLOWED = process.env.ALLOW_GUEST_ACCESS === 'true';
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_ID || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let oauthClient = null;
function getOAuthClient() {
  if (!oauthClient) oauthClient = new OAuth2Client();
  return oauthClient;
}

async function ensureUserProfile(user) {
  const ref = getDb().collection('users').doc(user.uid);
  const doc = await ref.get();
  if (!doc.exists) {
    await ref.set({
      uid: user.uid,
      email: user.email,
      displayName: user.name || user.email?.split('@')[0] || 'Eco User',
      role: 'user',
      authProvider: user.authProvider || 'unknown',
      createdAt: new Date().toISOString(),
    });
  }
  return ref;
}

async function resolveUserFromToken(idToken) {
  // 1) Firebase ID token (primary when Firebase Auth is linked)
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      emailVerified: decoded.email_verified || false,
      picture: decoded.picture || null,
      authProvider: decoded.firebase?.sign_in_provider || 'firebase',
      isGuest: false,
    };
  } catch (firebaseErr) {
    logger.debug(`Firebase token verify skipped: ${firebaseErr.message}`);
  }

  // 2) Google OAuth ID token (GIS / Google Sign-In)
  if (GOOGLE_CLIENT_IDS.length > 0) {
    const ticket = await getOAuthClient().verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_IDS,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error('Invalid Google token payload');

    const uid = `google_${payload.sub}`;
    const user = {
      uid,
      email: payload.email || null,
      name: payload.name || null,
      emailVerified: payload.email_verified || false,
      picture: payload.picture || null,
      authProvider: 'google.com',
      isGuest: false,
    };
    await ensureUserProfile(user);
    return user;
  }

  throw new Error('Token verification failed');
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Sign in required. Use Google or email/password.',
    });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    req.user = await resolveUserFromToken(idToken);
    req.traceId = req.user.uid;
    next();
  } catch (err) {
    logger.warn(`Auth failed: ${err.message}`, { path: req.path });

    if (err.message?.includes('expired')) {
      return res.status(401).json({ error: 'Token expired', message: 'Please sign in again.' });
    }
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired sign-in token.' });
  }
}

async function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    return authMiddleware(req, res, next);
  }

  if (GUEST_ALLOWED) {
    const guestId = (req.headers['x-guest-id'] || 'demo-user').toString().slice(0, 128);
    req.user = {
      uid: guestId.startsWith('guest_') ? guestId : `guest_${guestId}`,
      email: null,
      name: 'Guest User',
      emailVerified: false,
      isGuest: true,
      authProvider: 'guest',
    };
    req.traceId = req.user.uid;
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
}

module.exports = { authMiddleware, optionalAuthMiddleware, resolveUserFromToken };
