'use strict';

const { getVertexAI } = require('../config/vertexai');
const { getDb } = require('../config/firebase');
const { logger } = require('../config/logger');

const SYSTEM_PROMPT = `You are Carbon Coach, an expert sustainability advisor. Provide concise, actionable, personalized carbon reduction advice. Use kg CO2e units. Be encouraging but honest. Format responses as JSON when requested.`;

async function generateContent(prompt, profile = {}, recentActivities = []) {
  const { generativeModel } = getVertexAI();
  if (!generativeModel) {
    return fallbackResponse(prompt, profile, recentActivities);
  }

  try {
    const start = Date.now();
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
    });
    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    logger.info('Vertex AI request completed', { latencyMs: Date.now() - start, chars: text.length });
    if (!text) return fallbackResponse(prompt, profile, recentActivities);
    return text;
  } catch (err) {
    logger.error('Vertex AI request failed, using fallback:', { error: err.message, stack: err.stack });
    return fallbackResponse(prompt, profile, recentActivities);
  }
}

function fallbackResponse(prompt, profile = {}, recentActivities = []) {
  logger.warn('Vertex AI unavailable — using dynamic rule-based fallback');
  const isScenario = prompt.toLowerCase().includes('scenario') || prompt.toLowerCase().includes('what if') || prompt.toLowerCase().includes('simulation');
  
  if (isScenario) {
    const text = prompt.toLowerCase();
    if (text.includes('car') || text.includes('drive') || text.includes('vehicle') || text.includes('transport') || text.includes('travel')) {
      return JSON.stringify({
        reductionKgMonthly: 135,
        scoreImpact: 18,
        monthlySavings: '$95',
        summary: 'Stopping or reducing car usage cuts fuel costs and emissions. Replacing car commutes with public transit or active travel has a massive impact.',
        tips: [
          'Walk or bike for short trips under 3 km.',
          'Utilize bus, train, or metro for your daily commutes.',
          'Consider carpooling or transitioning to an electric vehicle (EV).'
        ]
      });
    }
    if (text.includes('meat') || text.includes('beef') || text.includes('pork') || text.includes('food') || text.includes('diet') || text.includes('vegan') || text.includes('vegetarian')) {
      return JSON.stringify({
        reductionKgMonthly: 75,
        scoreImpact: 10,
        monthlySavings: '$55',
        summary: 'Transitioning to plant-based diets or substituting red meat with low-carbon options reduces agricultural methane and land footprint.',
        tips: [
          'Start with "Meatless Mondays" to build consistency.',
          'Substitute beef/lamb with chicken, sustainable fish, or legumes.',
          'Incorporate more organic, locally-sourced fruits and vegetables.'
        ]
      });
    }
    if (text.includes('renewable') || text.includes('solar') || text.includes('energy') || text.includes('electricity') || text.includes('wind') || text.includes('power')) {
      return JSON.stringify({
        reductionKgMonthly: 95,
        scoreImpact: 14,
        monthlySavings: '$75',
        summary: 'Switching home electricity to green power/tariffs or installing solar panels drastically offsets fossil-fuel-based grid emissions.',
        tips: [
          'Inquire with your utility provider about 100% renewable/solar tariffs.',
          'Unplug idle devices (phantom loads) and switch to energy-efficient LED bulbs.',
          'Use smart thermostats to optimize heating and cooling schedules.'
        ]
      });
    }
    if (text.includes('remote') || text.includes('work from home') || text.includes('telecommute') || text.includes('hybrid')) {
      return JSON.stringify({
        reductionKgMonthly: 65,
        scoreImpact: 9,
        monthlySavings: '$80',
        summary: 'Telecommuting eliminates transit fuel usage and lowers overall passenger transport emissions.',
        tips: [
          'Group chores and errands to minimize transit trips on in-office days.',
          'Use energy-saving settings on your computer and office monitors.',
          'Maximize natural light in your workspace to save daytime electricity.'
        ]
      });
    }
    
    // Default dynamic simulator fallback
    const hash = prompt.length || 10;
    return JSON.stringify({
      reductionKgMonthly: 40 + (hash % 30),
      scoreImpact: 8 + (hash % 10),
      monthlySavings: `$${50 + (hash % 50)}`,
      summary: `Implementing this scenario would lower your emissions and contribute to sustainable carbon reduction.`,
      tips: [
        'Set small milestone targets and review dashboard progress.',
        'Choose low-carbon alternatives in your daily routine.',
        'Share your carbon-saving activities to build community streaks.'
      ]
    });
  }
  
  // It is the personalized tips request
  let highestCategory = 'transport';
  let highestEmissions = 0;
  if (recentActivities && recentActivities.length > 0) {
    const sums = {};
    recentActivities.forEach(act => {
      sums[act.category] = (sums[act.category] || 0) + (act.co2e || 0);
    });
    for (const [cat, val] of Object.entries(sums)) {
      if (val > highestEmissions) {
        highestEmissions = val;
        highestCategory = cat;
      }
    }
  }
  
  const tipsMap = {
    transport: {
      tips: [
        'Your transport sector is the largest contributor. Opt for public transit, cycling, or walking for short distance travels.',
        'Maintain correct tire pressure and practice smooth acceleration to improve vehicle fuel efficiency by 3-5%.',
        'Consolidate multiple errands into single round trips to avoid cold starts.'
      ],
      weeklyInsight: 'Transport is currently your highest carbon emission source. Switching just 2 trips per week to transit can make a big difference.',
      behavioralAnalysis: 'Logging activities consistently correlates with a 15% reduction in overall transport emissions.'
    },
    food: {
      tips: [
        'Food emissions are high. Incorporating 3 vegetarian or vegan meals a week can save up to 20kg of CO2e monthly.',
        'Avoid food waste by planning meals and freezing leftovers. Landfilled food waste produces powerful methane emissions.',
        'Choose local and seasonal produce to minimize the emissions associated with food transport and storage.'
      ],
      weeklyInsight: 'Your food choices represent a major opportunity to lower emissions. Swapping beef/lamb for poultry or lentils yields immediate savings.',
      behavioralAnalysis: 'Your food footprint has been fluctuating. Tracking your meal types helps build sustainable dietary patterns.'
    },
    energy: {
      tips: [
        'Energy usage is your top emission source. Switching to LED lighting cuts lighting energy consumption by up to 75%.',
        'Set your heating thermostat 1 degree lower to reduce heating emissions and save up to 10% on energy bills.',
        'Clean or replace air filters in your heating/cooling system regularly to maximize operational efficiency.'
      ],
      weeklyInsight: 'Reducing home electricity and heating consumption is the most direct way to lower your energy carbon footprint.',
      behavioralAnalysis: 'Peak energy logging shows a pattern. Consider smart home scheduling to automate energy savings.'
    },
    shopping: {
      tips: [
        'Consumer goods have high embedded emissions. Consider buying second-hand clothing or furniture to extend product life cycles.',
        'Prioritize high-quality, durable goods over fast fashion or single-use items to reduce landfill waste and manufacturing footprint.',
        'Repair and maintain electronics to delay new purchases, as new laptop/phone production is extremely carbon-intensive.'
      ],
      weeklyInsight: 'Buying less and choosing second-hand items saves significant manufacturing and shipping emissions.',
      behavioralAnalysis: 'Tracking shopping items helps build circular economy habits.'
    },
    water: {
      tips: [
        'Shortening your daily showers by just 2 minutes saves water and the gas/electricity required to heat it.',
        'Always run full loads in washing machines and dishwashers to optimize water and energy consumption.',
        'Install low-flow aerators on taps and showerheads to reduce water volume usage by up to 30% without losing pressure.'
      ],
      weeklyInsight: 'Water conservation directly reduces municipal water treatment and home water heating energy.',
      behavioralAnalysis: 'Water logging highlights routine consumption. Small reductions add up to large annual savings.'
    },
    waste: {
      tips: [
        'Segregating recyclables and organic compostable waste prevents carbon and methane emissions from landfill disposal.',
        'Use reusable shopping bags, water bottles, and coffee cups to minimize plastic and paper waste.',
        'Buy food items in bulk or with minimal packaging to reduce overall packaging waste footprint.'
      ],
      weeklyInsight: 'Diverting waste from landfills via recycling and composting significantly reduces organic methane generation.',
      behavioralAnalysis: 'Consistent waste logging promotes zero-waste mindfulness.'
    }
  };
  
  const selection = tipsMap[highestCategory] || tipsMap.transport;
  return JSON.stringify({
    tips: selection.tips,
    weeklyInsight: selection.weeklyInsight,
    behavioralAnalysis: selection.behavioralAnalysis,
    goalSuggestions: [
      `Reduce ${highestCategory} activities by 15% this week`,
      `Log at least 3 low-carbon ${highestCategory} choices`
    ]
  });
}

async function getPersonalizedTips(userId, profile, recentActivities) {
  const prompt = `User profile: ${JSON.stringify(profile)}. Recent activities (last 10): ${JSON.stringify(recentActivities)}.
  Return JSON: { "tips": string[], "weeklyInsight": string, "behavioralAnalysis": string, "goalSuggestions": string[] }`;

  const raw = await generateContent(prompt, profile, recentActivities);
  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = JSON.parse(fallbackResponse(prompt, profile, recentActivities));
  }

  try { await saveAiHistory(userId, 'personalized_tips', parsed); } catch (_) { /* non-blocking */ }
  return parsed;
}

async function runScenarioSimulation(userId, scenario) {
  const prompt = `Scenario simulation: "${scenario}"
  Estimate CO2 reduction in kg/month, score impact (0-100), monthly cost savings, and 3 actionable tips.
  Return JSON: { "reductionKgMonthly": number, "scoreImpact": number, "monthlySavings": string, "summary": string, "tips": string[] }`;

  const raw = await generateContent(prompt, {}, []);
  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    parsed = JSON.parse(fallbackResponse(prompt, {}, []));
  }

  try { await saveAiHistory(userId, 'scenario', { scenario, ...parsed }); } catch (_) { /* non-blocking */ }
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
