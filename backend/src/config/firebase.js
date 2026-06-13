/**
 * Firebase / Firestore initialization for Cloud Run
 * Uses Application Default Credentials (ADC) on GCP
 */

'use strict';

const admin = require('firebase-admin');
const { logger } = require('./logger');

let db = null;
let auth = null;
let storage = null;

function initFirebase() {
  if (admin.apps.length > 0) return;

  try {
    // On GCP (Cloud Run), ADC is used automatically.
    // Locally, set GOOGLE_APPLICATION_CREDENTIALS env var.
    const credential = process.env.FIREBASE_SERVICE_ACCOUNT
      ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      : admin.credential.applicationDefault();

    admin.initializeApp({
      credential,
      projectId: process.env.GCP_PROJECT_ID,
      storageBucket: `${process.env.GCP_PROJECT_ID}.appspot.com`,
    });

    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();

    // Firestore settings
    db.settings({ ignoreUndefinedProperties: true });

    logger.info('✅ Firebase Admin initialized');
  } catch (err) {
    logger.error('❌ Firebase init failed:', err.message);
    if (process.env.NODE_ENV !== 'test') process.exit(1);
  }
}

function getDb() {
  if (!db) throw new Error('Firestore not initialized. Call initFirebase() first.');
  return db;
}

function getAuth() {
  if (!auth) throw new Error('Firebase Auth not initialized.');
  return auth;
}

function getStorage() {
  if (!storage) throw new Error('Firebase Storage not initialized.');
  return storage;
}

module.exports = { initFirebase, getDb, getAuth, getStorage, admin };
