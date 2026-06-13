'use strict';

const express = require('express');
const { getGamificationState, getLeaderboard, getChallenges } = require('../services/gamificationService');

const router = express.Router();

router.get('/state', async (req, res, next) => {
  try {
    const state = await getGamificationState(req.user.uid);
    res.json(state);
  } catch (err) {
    next(err);
  }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    const leaderboard = await getLeaderboard(20);
    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
});

router.get('/challenges', async (req, res, next) => {
  try {
    const challenges = await getChallenges();
    res.json({ challenges });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
