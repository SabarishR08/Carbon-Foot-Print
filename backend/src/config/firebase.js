/**
 * Firebase / Firestore initialization for Cloud Run
 * Uses Application Default Credentials (ADC) on GCP
 */

'use strict';

const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore: fbGetFirestore } = require('firebase-admin/firestore');
const { getAuth: fbGetAuth } = require('firebase-admin/auth');
const { getStorage: fbGetStorage } = require('firebase-admin/storage');
const { logger } = require('./logger');

let db = null;
let auth = null;
let storage = null;

function initFirebase() {
  if (getApps().length > 0) return;

  try {
    // On GCP (Cloud Run), ADC is used automatically.
    // Locally, set GOOGLE_APPLICATION_CREDENTIALS env var.
    const credential = process.env.FIREBASE_SERVICE_ACCOUNT
      ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      : applicationDefault();

    initializeApp({
      credential,
      projectId: process.env.GCP_PROJECT_ID,
      storageBucket: `${process.env.GCP_PROJECT_ID}.appspot.com`,
    });

    db = fbGetFirestore();
    auth = fbGetAuth();
    storage = fbGetStorage();

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

module.exports = { initFirebase, getDb, getAuth, getStorage };
