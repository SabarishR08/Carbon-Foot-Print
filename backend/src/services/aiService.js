'use strict';

const { getVertexAI } = require('../config/vertexai');
const { getDb } = require('../config/firebase');
const { logger } = require('../config/logger');

const SYSTEM_PROMPT = `You are Carbon Coach, an expert sustainability advisor. Provide concise, actionable, personalized carbon reduction advice. Use kg CO2e units. Be encouraging but honest. Format responses as JSON when requested.`;

async function generateContent(prompt) {
  const { generativeModel } = getVertexAI();
  if (!generativeModel) {
    return fallbackResponse(prompt);
  }

  const start = Date.now();
  const result = await generativeModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
  });
  const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  logger.info('Vertex AI request completed', { latencyMs: Date.now() - start, chars: text.length });
  return text;
}

function fallbackResponse(prompt) {
  logger.warn('Vertex AI unavailable — using rule-based fallback');
  if (prompt.toLowerCase().includes('scenario') || prompt.toLowerCase().includes('what if') || prompt.toLowerCase().includes('simulation')) {
    return JSON.stringify({
      reductionKgMonthly: 45,
      scoreImpact: 12,
      monthlySavings: '$120',
      summary: 'Based on emission factors, this change could significantly reduce your carbon footprint.',
      tips: ['Start gradually', 'Track progress weekly', 'Share goals with household'],
    });
  }
  return JSON.stringify({
    tips: [
      'Switch to public transit 2 days per week to cut transport emissions ~25%.',
      'Reduce meat consumption to 3 meals/week — saves ~15kg CO2e monthly.',
      'Enable smart thermostat scheduling to lower energy use by 10%.',
    ],
    weeklyInsight: 'Your transport category shows the highest reduction potential.',
    behavioralAnalysis: 'Consistent logging correlates with 18% better outcomes.',
    goalSuggestions: [],
  });
}

async function getPersonalizedTips(userId, profile, recentActivities) {
  const prompt = `User profile: ${JSON.stringify(profile)}. Recent activities (last 10): ${JSON.stringify(recentActivities)}.
Return JSON: { "tips": string[], "weeklyInsight": string, "behavioralAnalysis": string, "goalSuggestions": string[] }`;

  const raw = await generateContent(prompt);
  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = { tips: [raw], weeklyInsight: 'Keep tracking your activities.', behavioralAnalysis: 'N/A', goalSuggestions: [] };
  }

  await saveAiHistory(userId, 'personalized_tips', parsed);
  return parsed;
}

async function runScenarioSimulation(userId, scenario) {
  const prompt = `Scenario simulation: "${scenario}"
Estimate CO2 reduction in kg/month, score impact (0-100), monthly cost savings, and 3 actionable tips.
Return JSON: { "reductionKgMonthly": number, "scoreImpact": number, "monthlySavings": string, "summary": string, "tips": string[] }`;

  const raw = await generateContent(prompt);
  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = JSON.parse(fallbackResponse(prompt));
  }

  await saveAiHistory(userId, 'scenario', { scenario, ...parsed });
  return parsed;
}

async function saveAiHistory(userId, type, content) {
  await getDb().collection('ai_history').add({
    userId,
    type,
    content,
    createdAt: new Date().toISOString(),
  });
}

async function getAiHistory(userId, limit = 20) {
  const snap = await getDb().collection('ai_history')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

module.exports = {
  generateContent,
  getPersonalizedTips,
  runScenarioSimulation,
  getAiHistory,
  saveAiHistory,
};
