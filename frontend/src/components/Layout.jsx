import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/log', label: 'Log Activity', icon: '✏️' },
  { to: '/coach', label: 'Carbon Coach', icon: '🤖' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
  { to: '/reports', label: 'Reports', icon: '📄' },
  { to: '/gamification', label: 'Gamification', icon: '🏆' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-eco-900 text-white flex flex-col" aria-label="Main navigation">
        <div className="p-6 border-b border-eco-700">
          <h1 className="text-xl font-bold">🌱 EcoTrack</h1>
          <p className="text-eco-100 text-sm mt-1">Carbon Footprint Platform</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-lg transition ${isActive ? 'bg-eco-600 text-white' : 'text-eco-100 hover:bg-eco-800'}`}>
              <span aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-eco-700">
          <p className="text-sm text-eco-200 truncate">{user?.displayName || user?.email || 'Signed in'}</p>
          <button type="button" onClick={logout} className="mt-2 text-sm text-eco-300 hover:text-white">Sign out</button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
