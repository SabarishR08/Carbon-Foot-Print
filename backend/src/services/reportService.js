'use strict';

const PDFDocument = require('pdfkit');
const { Storage } = require('@google-cloud/storage');
const { getDb } = require('../config/firebase');
const { logger } = require('../config/logger');
const { computeCarbonScore } = require('./scoreService');

const BUCKET = process.env.REPORTS_BUCKET || `${process.env.GCP_PROJECT_ID}-carbon-reports`;

function getStorage() {
  return new Storage({ projectId: process.env.GCP_PROJECT_ID });
}

async function ensureBucket() {
  const storage = getStorage();
  const bucket = storage.bucket(BUCKET);
  const [exists] = await bucket.exists();
  if (!exists) {
    await storage.createBucket(BUCKET, { location: process.env.GCP_REGION || 'us-central1' });
    logger.info(`Created GCS bucket: ${BUCKET}`);
  }
  return bucket;
}

async function generateReport(userId, userEmail) {
  const db = getDb();

  const activitiesSnap = await db.collection('activities')
    .where('userId', '==', userId)
    .orderBy('date', 'desc')
    .limit(100)
    .get();

  const activities = activitiesSnap.docs.map((d) => d.data());
  const byCategory = {};
  for (const a of activities) {
    byCategory[a.category] = (byCategory[a.category] || 0) + (a.co2e || 0);
  }

  const score = computeCarbonScore(byCategory, 30);
  const insightsSnap = await db.collection('ai_history')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  const insights = insightsSnap.docs.map((d) => d.data());

  const pdfBuffer = await buildPdf(userEmail, score, byCategory, activities, insights);
  const bucket = await ensureBucket();
  const fileName = `reports/${userId}/${Date.now()}-sustainability-report.pdf`;
  const file = bucket.file(fileName);

  await file.save(pdfBuffer, {
    contentType: 'application/pdf',
    metadata: { cacheControl: 'private, max-age=3600' },
  });

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  const reportMeta = {
    userId,
    fileName,
    bucket: BUCKET,
    score: score.score,
    grade: score.grade,
    createdAt: new Date().toISOString(),
    downloadUrl: signedUrl,
  };

  const docRef = await db.collection('reports').add(reportMeta);
  return { id: docRef.id, ...reportMeta };
}

function buildPdf(email, score, byCategory, activities, insights) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(22).text('🌱 Sustainability Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`);
    doc.text(`User: ${email || 'EcoTrack User'}`);
    doc.moveDown();

    doc.fontSize(16).text('Carbon Score');
    doc.fontSize(12).text(`Score: ${score.score}/100 (Grade: ${score.grade})`);
    doc.text(`Annualized emissions: ${score.annualizedKg} kg CO₂e`);
    doc.text(`Paris target progress: ${score.parisTargetProgress}%`);
    doc.moveDown();

    doc.fontSize(16).text('Category Breakdown (30 days)');
    for (const [cat, kg] of Object.entries(byCategory)) {
      doc.fontSize(11).text(`  ${cat}: ${kg.toFixed(2)} kg CO₂e`);
    }
    doc.moveDown();

    doc.fontSize(16).text('Recent Activity Summary');
    doc.fontSize(10).text(`Total records: ${activities.length}`);
    doc.moveDown();

    doc.fontSize(16).text('AI Recommendations');
    if (insights.length === 0) {
      doc.fontSize(11).text('  No insights yet — use Carbon Coach for personalized tips.');
    } else {
      insights.forEach((ins, i) => {
        doc.fontSize(11).text(`  ${i + 1}. ${ins.type}: ${JSON.stringify(ins.content).slice(0, 120)}...`);
      });
    }
    doc.moveDown();

    doc.fontSize(16).text('Forecast');
    const trend = score.onTrack ? 'On track for Paris targets' : 'Above target — focus on transport and food';
    doc.fontSize(11).text(trend);
    doc.moveDown(2);
    doc.fontSize(9).text('EcoTrack Carbon Footprint Platform — Powered by Google Cloud', { align: 'center' });

    doc.end();
  });
}

async function listReports(userId) {
  const snap = await getDb().collection('reports')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

module.exports = { generateReport, listReports, BUCKET };
