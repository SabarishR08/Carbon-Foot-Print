import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';

const SCENARIOS = [
  'What if I stop using a car?',
  'What if I eat less meat?',
  'What if I work remotely 3 days a week?',
  'What if I switch to renewable energy?',
];

export default function CarbonCoach() {
  const api = useApi();
  const [tips, setTips] = useState(null);
  const [scenario, setScenario] = useState('');
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadTips = async () => {
    setLoading(true);
    try {
      const data = await api('/api/v1/insights/tips');
      setTips(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const runScenario = async (text) => {
    setLoading(true);
    setScenario(text);
    try {
      const data = await api('/api/v1/insights/scenario', { method: 'POST', body: { scenario: text } });
      setSimResult(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Carbon Coach AI</h1>
      <p className="text-gray-500 mb-8">Powered by Vertex AI (Gemini)</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-4">Personalized Tips</h2>
          <button onClick={loadTips} disabled={loading}
            className="bg-eco-600 text-white px-6 py-2 rounded-lg hover:bg-eco-700 disabled:opacity-50 mb-4">
            {loading ? 'Generating...' : 'Get AI Tips'}
          </button>
          {tips && (
            <div className="space-y-3">
              <p className="text-sm bg-eco-50 p-3 rounded-lg">{tips.weeklyInsight}</p>
              <ul className="space-y-2">
                {(tips.tips || []).map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm"><span>💡</span>{typeof t === 'string' ? t : JSON.stringify(t)}</li>
                ))}
              </ul>
              {tips.goalSuggestions?.length > 0 && (
                <div className="mt-4">
                  <p className="font-medium text-sm">Suggested Goals:</p>
                  <ul className="text-sm text-gray-600 mt-1">{tips.goalSuggestions.map((g, i) => <li key={i}>• {g}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-4">Scenario Simulator</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {SCENARIOS.map((s) => (
              <button key={s} onClick={() => runScenario(s)}
                className="text-sm border rounded-full px-3 py-1 hover:bg-eco-50 hover:border-eco-500 transition">
                {s}
              </button>
            ))}
          </div>
          <textarea value={scenario} onChange={(e) => setScenario(e.target.value)} placeholder="Or type your own scenario..."
            className="w-full border rounded-lg px-4 py-2 mb-3" rows={2} />
          <button onClick={() => runScenario(scenario)} disabled={!scenario || loading}
            className="bg-eco-600 text-white px-6 py-2 rounded-lg hover:bg-eco-700 disabled:opacity-50">
            Simulate
          </button>
          {simResult && (
            <div className="mt-4 bg-blue-50 p-4 rounded-lg space-y-2">
              <p className="font-medium">{simResult.summary}</p>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-white rounded p-2"><p className="text-gray-500">Reduction</p><p className="font-bold text-eco-700">{simResult.reductionKgMonthly} kg/mo</p></div>
                <div className="bg-white rounded p-2"><p className="text-gray-500">Score Impact</p><p className="font-bold">+{simResult.scoreImpact}</p></div>
                <div className="bg-white rounded p-2"><p className="text-gray-500">Savings</p><p className="font-bold">{simResult.monthlySavings}</p></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
