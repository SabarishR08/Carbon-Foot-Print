'use strict';

const express = require('express');
const { getDb } = require('../config/firebase');
const { computeCarbonScore, computeTrend } = require('../services/scoreService');
const { queryWeeklyTrends, queryCategoryBreakdown, queryAnonymousComparison } = require('../services/bigqueryService');
const { getAllFactors } = require('../services/carbonCalculator');

const router = express.Router();

async function getActivitiesByPeriod(userId, days) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const snap = await getDb().collection('activities')
    .where('userId', '==', userId)
    .where('date', '>=', since)
    .get();

  const byCategory = {};
  let total = 0;
  for (const doc of snap.docs) {
    const a = doc.data();
    byCategory[a.category] = (byCategory[a.category] || 0) + (a.co2e || 0);
    total += a.co2e || 0;
  }
  return { byCategory, total, count: snap.size };
}

router.get('/score', async (req, res, next) => {
  try {
    const days = Number(req.query.days) || 30;
    const { byCategory } = await getActivitiesByPeriod(req.user.uid, days);
    const score = computeCarbonScore(byCategory, days);
    res.json(score);
  } catch (err) {
    next(err);
  }
});

router.get('/trends', async (req, res, next) => {
  try {
    const current = await getActivitiesByPeriod(req.user.uid, 7);
    const previous = await getActivitiesByPeriod(req.user.uid, 14);
    const prevWeekKg = previous.total - current.total;
    const trend = computeTrend(current.total, prevWeekKg);

    let bqTrends = [];
    try {
      bqTrends = await queryWeeklyTrends(req.user.uid);
    } catch {
      bqTrends = [];
    }

    res.json({
      weekly: { totalKg: current.total, byCategory: current.byCategory, trend },
      monthly: await getActivitiesByPeriod(req.user.uid, 30),
      bigQueryTrends: bqTrends,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/breakdown', async (req, res, next) => {
  try {
    let breakdown = [];
    try {
      breakdown = await queryCategoryBreakdown(req.user.uid);
    } catch {
      const { byCategory } = await getActivitiesByPeriod(req.user.uid, 30);
      breakdown = Object.entries(byCategory).map(([category, total_kg]) => ({
        category, total_kg, record_count: 1,
      }));
    }
    res.json({ breakdown });
  } catch (err) {
    next(err);
  }
});

router.get('/comparison', async (req, res, next) => {
  try {
    const { total } = await getActivitiesByPeriod(req.user.uid, 30);
    let community = {};
    try {
      community = await queryAnonymousComparison();
    } catch {
      community = { median: 150, average: 180, p25: 80, p75: 250 };
    }
    res.json({
      yourMonthlyKg: parseFloat(total.toFixed(2)),
      communityStats: community,
      percentile: total < (community.p25 || 80) ? 'top_25' : total < (community.median || 150) ? 'above_average' : 'needs_improvement',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/factors', (req, res) => {
  res.json({ factors: getAllFactors() });
});

module.exports = router;
