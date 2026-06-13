import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';

export default function Dashboard() {
  const api = useApi();
  const [score, setScore] = useState(null);
  const [activities, setActivities] = useState([]);
  const [gamification, setGamification] = useState(null);

  useEffect(() => {
    Promise.all([
      api('/api/v1/analytics/score'),
      api('/api/v1/activities?limit=5'),
      api('/api/v1/gamification/state'),
    ]).then(([s, a, g]) => { setScore(s); setActivities(a.activities); setGamification(g); })
      .catch(console.error);
  }, [api]);

  const gradeColor = { A: 'text-green-600', B: 'text-lime-600', C: 'text-yellow-600', D: 'text-orange-600', F: 'text-red-600' };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-500 mb-8">Your carbon footprint at a glance</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <p className="text-sm text-gray-500">Carbon Score</p>
          <p className="text-4xl font-bold mt-1">{score?.score ?? '—'}<span className="text-lg text-gray-400">/100</span></p>
          <p className={`text-lg font-semibold ${gradeColor[score?.grade] || ''}`}>Grade: {score?.grade ?? '—'}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <p className="text-sm text-gray-500">Annualized Emissions</p>
          <p className="text-4xl font-bold mt-1">{score?.annualizedKg ?? '—'}<span className="text-lg text-gray-400"> kg</span></p>
          <p className="text-sm text-gray-500 mt-1">{score?.onTrack ? '✅ On Paris track' : '⚠️ Above target'}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <p className="text-sm text-gray-500">Level & Streak</p>
          <p className="text-2xl font-bold mt-1">{gamification?.level?.name ?? 'Seedling'}</p>
          <p className="text-sm text-gray-500">🔥 {gamification?.streak ?? 0} day streak · {gamification?.points ?? 0} pts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Recent Activities</h2>
            <Link to="/log" className="text-eco-600 text-sm hover:underline">+ Log new</Link>
          </div>
          {activities.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No activities yet. <Link to="/log" className="text-eco-600">Log your first!</Link></p>
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <span className="font-medium capitalize">{a.category}</span>
                    <span className="text-gray-400 text-sm ml-2">{a.subtype}</span>
                  </div>
                  <span className="text-eco-700 font-mono text-sm">{a.co2e?.toFixed(2)} kg</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: '/log', label: 'Log Activity', icon: '✏️' },
              { to: '/coach', label: 'AI Coach', icon: '🤖' },
              { to: '/analytics', label: 'Analytics', icon: '📈' },
              { to: '/reports', label: 'Get Report', icon: '📄' },
            ].map(({ to, label, icon }) => (
              <Link key={to} to={to} className="flex flex-col items-center p-4 rounded-lg border hover:border-eco-500 hover:bg-eco-50 transition">
                <span className="text-2xl">{icon}</span>
                <span className="text-sm mt-1 font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
