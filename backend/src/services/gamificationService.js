'use strict';

const { getDb } = require('../config/firebase');

const BADGES = [
  { id: 'first_log', name: 'First Step', description: 'Log your first activity', threshold: 1 },
  { id: 'week_streak', name: 'Week Warrior', description: '7-day logging streak', threshold: 7 },
  { id: 'month_streak', name: 'Monthly Master', description: '30-day logging streak', threshold: 30 },
  { id: 'low_carbon_week', name: 'Green Week', description: 'Below-average emissions for a week', threshold: 1 },
  { id: 'goal_crusher', name: 'Goal Crusher', description: 'Complete a sustainability goal', threshold: 1 },
  { id: 'ai_explorer', name: 'AI Explorer', description: 'Use Carbon Coach 5 times', threshold: 5 },
];

const LEVELS = [
  { level: 1, name: 'Seedling', minPoints: 0 },
  { level: 2, name: 'Sprout', minPoints: 100 },
  { level: 3, name: 'Sapling', minPoints: 300 },
  { level: 4, name: 'Tree', minPoints: 600 },
  { level: 5, name: 'Forest', minPoints: 1000 },
  { level: 6, name: 'Guardian', minPoints: 2000 },
];

function getLevel(points) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (points >= lvl.minPoints) current = lvl;
  }
  const next = LEVELS.find((l) => l.minPoints > points);
  return {
    ...current,
    points,
    nextLevel: next ? { level: next.level, name: next.name, pointsNeeded: next.minPoints - points } : null,
  };
}

async function getGamificationState(userId) {
  const ref = getDb().collection('gamification').doc(userId);
  const doc = await ref.get();
  if (!doc.exists) {
    const initial = { points: 0, streak: 0, lastLogDate: null, badges: [], challengesCompleted: 0 };
    await ref.set(initial);
    return { ...initial, level: getLevel(0), availableBadges: BADGES };
  }
  const data = doc.data();
  return {
    ...data,
    level: getLevel(data.points || 0),
    availableBadges: BADGES,
    earnedBadges: BADGES.filter((b) => (data.badges || []).includes(b.id)),
  };
}

async function awardPoints(userId, points, reason) {
  const ref = getDb().collection('gamification').doc(userId);
  const doc = await ref.get();
  const current = doc.exists ? doc.data() : { points: 0, badges: [], streak: 0 };
  const newPoints = (current.points || 0) + points;
  await ref.set({
    ...current,
    points: newPoints,
    lastAwardReason: reason,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return getLevel(newPoints);
}

async function updateStreak(userId) {
  const ref = getDb().collection('gamification').doc(userId);
  const doc = await ref.get();
  const data = doc.exists ? doc.data() : { streak: 0, lastLogDate: null, badges: [], points: 0 };
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let streak = data.streak || 0;
  if (data.lastLogDate === today) {
    // already logged today
  } else if (data.lastLogDate === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }

  const badges = [...(data.badges || [])];
  if (streak >= 7 && !badges.includes('week_streak')) badges.push('week_streak');
  if (streak >= 30 && !badges.includes('month_streak')) badges.push('month_streak');

  await ref.set({ ...data, streak, lastLogDate: today, badges }, { merge: true });
  return streak;
}

async function getLeaderboard(limit = 10) {
  const snap = await getDb().collection('gamification')
    .orderBy('points', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((d, i) => ({
    rank: i + 1,
    anonymousId: `EcoUser_${d.id.slice(0, 6)}`,
    points: d.data().points || 0,
    level: getLevel(d.data().points || 0).name,
    streak: d.data().streak || 0,
  }));
}

async function getChallenges() {
  return [
    { id: 'no_car_week', title: 'Car-Free Week', description: 'Use no personal car for 7 days', points: 50 },
    { id: 'meatless_monday', title: 'Meatless Mondays', description: '4 meatless Mondays this month', points: 40 },
    { id: 'energy_saver', title: 'Energy Saver', description: 'Reduce electricity logs by 15%', points: 60 },
    { id: 'zero_waste_day', title: 'Zero Waste Day', description: 'Log zero landfill waste for a day', points: 30 },
  ];
}

module.exports = {
  BADGES,
  LEVELS,
  getGamificationState,
  awardPoints,
  updateStreak,
  getLeaderboard,
  getChallenges,
  getLevel,
};
