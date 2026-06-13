import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';

export default function Reports() {
  const api = useApi();
  const [reports, setReports] = useState([]);
  const [generating, setGenerating] = useState(false);

  const loadReports = () => {
    api('/api/v1/reports').then((d) => setReports(d.reports)).catch(console.error);
  };

  useEffect(() => { loadReports(); }, [api]);

  const generate = async () => {
    setGenerating(true);
    try {
      await api('/api/v1/reports/generate', { method: 'POST' });
      loadReports();
    } catch (err) { alert(err.message); }
    setGenerating(false);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Sustainability Reports</h1>
      <p className="text-gray-500 mb-8">PDF reports stored in Cloud Storage</p>

      <button onClick={generate} disabled={generating}
        className="bg-eco-600 text-white px-6 py-3 rounded-lg hover:bg-eco-700 disabled:opacity-50 font-medium mb-8">
        {generating ? 'Generating PDF...' : '📄 Generate New Report'}
      </button>

      <div className="space-y-4">
        {reports.length === 0 ? (
          <p className="text-gray-400">No reports yet. Generate your first sustainability report.</p>
        ) : reports.map((r) => (
          <div key={r.id} className="bg-white rounded-xl shadow-sm p-6 border flex justify-between items-center">
            <div>
              <p className="font-medium">Report — Grade {r.grade} (Score: {r.score})</p>
              <p className="text-sm text-gray-500">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
            {r.downloadUrl && (
              <a href={r.downloadUrl} target="_blank" rel="noopener noreferrer"
                className="text-eco-600 hover:underline font-medium">Download PDF</a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
