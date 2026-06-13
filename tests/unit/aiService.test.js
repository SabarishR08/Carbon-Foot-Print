'use strict';

const { createMockFirestore } = require('../helpers/mockFirestore');

const mockDb = createMockFirestore({ ai_history: {} });

jest.mock('../../backend/src/config/firebase', () => ({
  getDb: () => mockDb,
}));

// Vertex AI is unavailable in the test environment (no GCP credentials) —
// the service must fall back to its rule-based responses.
jest.mock('../../backend/src/config/vertexai', () => ({
  getVertexAI: () => ({ vertexClient: null, generativeModel: null }),
}));

const {
  generateContent,
  getPersonalizedTips,
  runScenarioSimulation,
  getAiHistory,
} = require('../../backend/src/services/aiService');

describe('AI Service (fallback mode)', () => {
  test('generateContent returns rule-based tips JSON when Vertex AI is unavailable', async () => {
    const raw = await generateContent('Give me some tips');
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed.tips)).toBe(true);
    expect(parsed.tips.length).toBeGreaterThan(0);
  });

  test('generateContent returns a scenario-shaped fallback for "What if" prompts', async () => {
    const raw = await generateContent('What if I switched to an electric car?');
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('reductionKgMonthly');
    expect(parsed).toHaveProperty('scoreImpact');
    expect(parsed).toHaveProperty('tips');
  });

  test('getPersonalizedTips returns structured tips and persists AI history', async () => {
    const result = await getPersonalizedTips('user-1', { dietType: 'vegan' }, []);
    expect(Array.isArray(result.tips)).toBe(true);
    expect(result.weeklyInsight).toBeDefined();

    const history = await getAiHistory('user-1');
    expect(history.length).toBe(1);
    expect(history[0].type).toBe('personalized_tips');
  });

  test('runScenarioSimulation returns a quantified impact estimate', async () => {
    const result = await runScenarioSimulation('user-2', 'Switching to a plant-based diet');
    expect(typeof result.reductionKgMonthly).toBe('number');
    expect(typeof result.scoreImpact).toBe('number');
    expect(Array.isArray(result.tips)).toBe(true);
  });

  test('getAiHistory returns an empty array for a user with no history', async () => {
    const history = await getAiHistory('nobody');
    expect(history).toEqual([]);
  });
});
