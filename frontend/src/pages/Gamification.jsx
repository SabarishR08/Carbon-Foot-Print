import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

export default function Gamification() {
  const api = useApi();
  const [state, setState] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    Promise.all([
      api('/api/v1/gamification/state'),
      api('/api/v1/gamification/leaderboard'),
      api('/api/v1/gamification/challenges'),
    ]).then(([s, l, c]) => { setState(s); setLeaderboard(l.leaderboard); setChallenges(c.challenges); })
      .catch(console.error);
  }, [api]);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Gamification</h1>
      <p className="text-gray-500 mb-8">Badges, levels, streaks & challenges</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border text-center">
          <p className="text-4xl">🏅</p>
          <p className="text-2xl font-bold mt-2">{state?.level?.name || 'Seedling'}</p>
          <p className="text-sm text-gray-500">Level {state?.level?.level || 1}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border text-center">
          <p className="text-4xl">🔥</p>
          <p className="text-2xl font-bold mt-2">{state?.streak || 0} days</p>
          <p className="text-sm text-gray-500">Current streak</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border text-center">
          <p className="text-4xl">⭐</p>
          <p className="text-2xl font-bold mt-2">{state?.points || 0}</p>
          <p className="text-sm text-gray-500">Total points</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-4">Badges</h2>
          <div className="grid grid-cols-3 gap-3">
            {(state?.availableBadges || []).map((b) => {
              const earned = (state?.badges || []).includes(b.id);
              return (
                <div key={b.id} className={`text-center p-3 rounded-lg border ${earned ? 'bg-eco-50 border-eco-300' : 'opacity-40'}`}>
                  <p className="text-2xl">{earned ? '🏆' : '🔒'}</p>
                  <p className="text-xs font-medium mt-1">{b.name}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-4">Leaderboard</h2>
          <ul className="space-y-2">
            {leaderboard.map((entry) => (
              <li key={entry.rank} className="flex justify-between py-2 border-b last:border-0 text-sm">
                <span>#{entry.rank} {entry.anonymousId}</span>
                <span className="font-medium">{entry.points} pts · {entry.level}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Active Challenges</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map((c) => (
              <div key={c.id} className="border rounded-lg p-4">
                <p className="font-medium">{c.title}</p>
                <p className="text-sm text-gray-500 mt-1">{c.description}</p>
                <p className="text-eco-600 text-sm font-medium mt-2">+{c.points} points</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
