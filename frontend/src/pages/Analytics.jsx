import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useApi } from '../hooks/useApi';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function Analytics() {
  const api = useApi();
  const [score, setScore] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [trends, setTrends] = useState(null);

  useEffect(() => {
    Promise.all([
      api('/api/v1/analytics/score'),
      api('/api/v1/analytics/breakdown'),
      api('/api/v1/analytics/comparison'),
      api('/api/v1/analytics/trends'),
    ]).then(([s, b, c, t]) => {
      setScore(s);
      setBreakdown(b.breakdown || []);
      setComparison(c);
      setTrends(t);
    }).catch(console.error);
  }, [api]);

  const pieData = breakdown.map((b) => ({ name: b.category, value: b.total_kg || 0 }));
  const barData = score?.categoryBreakdown
    ? Object.entries(score.categoryBreakdown).map(([k, v]) => ({ category: k, score: v.score, kg: v.kg }))
    : [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Analytics</h1>
      <p className="text-gray-500 mb-8">BigQuery-powered emissions insights</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-4">Category Breakdown</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v.toFixed(2)} kg`} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-12">No data yet</p>}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-4">Category Scores</h2>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <XAxis dataKey="category" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-center py-12">No data yet</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-2">Scoring Logic</h2>
          <p className="text-sm text-gray-600">{score?.scoringLogic?.description}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Global Average</p><p className="font-bold">{score?.scoringLogic?.globalAverageKg} kg/yr</p></div>
            <div><p className="text-gray-500">Paris Target</p><p className="font-bold">{score?.scoringLogic?.parisTargetKg} kg/yr</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-2">Community Comparison</h2>
          {comparison && (
            <div className="space-y-2 text-sm">
              <p>Your monthly: <strong>{comparison.yourMonthlyKg} kg</strong></p>
              <p>Community median: <strong>{comparison.communityStats?.median?.toFixed?.(0) || '—'} kg</strong></p>
              <p className="text-eco-600 font-medium capitalize">Status: {comparison.percentile?.replace(/_/g, ' ')}</p>
              {trends?.weekly?.trend && (
                <p>Weekly trend: <strong className="capitalize">{trends.weekly.trend.direction}</strong> ({trends.weekly.trend.percentChange}%)</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
