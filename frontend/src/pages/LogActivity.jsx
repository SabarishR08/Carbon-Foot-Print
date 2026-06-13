import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';

const CATEGORIES = {
  transport: ['car_petrol', 'car_electric', 'bus', 'train', 'flight_short', 'cycling'],
  food: ['meal_omnivore', 'meal_vegetarian', 'meal_vegan', 'beef', 'chicken', 'vegetables'],
  energy: ['electricity_grid', 'electricity_renewable', 'natural_gas', 'heating_oil'],
  water: ['tap', 'hot_shower', 'dishwasher_load', 'laundry_load'],
  shopping: ['clothing_new', 'electronics_phone', 'general_spending'],
  waste: ['landfill_general', 'recycled', 'composted'],
};

const UNITS = { transport: 'km', food: 'meal', energy: 'kWh', water: 'litre', shopping: 'item', waste: 'kg' };

export default function LogActivity() {
  const api = useApi();
  const [category, setCategory] = useState('transport');
  const [subtype, setSubtype] = useState(CATEGORIES.transport[0]);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setSubtype(CATEGORIES[cat][0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    try {
      const data = await api('/api/v1/activities', {
        method: 'POST',
        body: { category, subtype, value: parseFloat(value), unit: UNITS[category], notes },
      });
      setResult(data);
      setValue('');
      setNotes('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Log Activity</h1>
      <p className="text-gray-500 mb-8">Track transport, food, energy, water, shopping & waste</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 border max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <select value={category} onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full border rounded-lg px-4 py-2.5" aria-label="Category">
            {Object.keys(CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Activity Type</label>
          <select value={subtype} onChange={(e) => setSubtype(e.target.value)}
            className="w-full border rounded-lg px-4 py-2.5" aria-label="Activity type">
            {CATEGORIES[category].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount ({UNITS[category]})</label>
          <input type="number" min="0" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} required
            className="w-full border rounded-lg px-4 py-2.5" aria-label="Amount" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full border rounded-lg px-4 py-2.5" />
        </div>
        {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
        <button type="submit" className="w-full bg-eco-600 text-white rounded-lg py-2.5 hover:bg-eco-700 font-medium">
          Log & Calculate CO₂e
        </button>
      </form>

      {result && (
        <div className="mt-6 bg-eco-50 border border-eco-200 rounded-xl p-6 max-w-lg">
          <h3 className="font-semibold text-eco-800">✅ Activity Logged</h3>
          <p className="text-2xl font-bold text-eco-700 mt-2">{result.activity.co2e.toFixed(2)} kg CO₂e</p>
          <p className="text-sm text-gray-600 mt-1">+10 points · Streak: {result.gamification?.streak} days</p>
        </div>
      )}
    </div>
  );
}
