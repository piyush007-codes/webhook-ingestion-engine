import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function App() {
  const [stats, setStats] = useState({ total: 0, COMPLETED: 0, FAILED: 0, PENDING: 0, successRate: '0%' });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const [resStats, resEvents] = await Promise.all([
        fetch(`${API_BASE}/api/v1/webhooks/stats`).then(r => r.json()),
        fetch(`${API_BASE}/api/v1/webhooks/events?page=1&limit=15&status=ALL`).then(r => r.json())
      ]);
      if (resStats?.data) setStats(resStats.data);
      if (resEvents?.data) setEvents(resEvents.data.events);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Initial load + 4-second auto-polling
  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectEvent = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/webhooks/events/${id}`).then(r => r.json());
      if (res.data) setSelectedEvent(res.data);
    } catch (err) {
      console.error('Detail fetch error:', err);
    }
  };

  const handleRetry = async (id) => {
    try {
      setRetrying(true);
      await fetch(`${API_BASE}/api/v1/webhooks/events/${id}/retry`, { method: 'POST' });
      await loadData();
      const updated = await fetch(`${API_BASE}/api/v1/webhooks/events/${id}`).then(r => r.json());
      if (updated.data) setSelectedEvent(updated.data);
    } catch (err) {
      alert('Retry failed: ' + err.message);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-wide">Webhook Engine Dashboard</h1>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Real-time Ingestion & Asynchronous Worker Pipeline</p>
          </div>
          <button 
            onClick={() => loadData()}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs font-semibold text-slate-200 transition"
          >
            {loading ? 'Refreshing...' : 'Refresh Feed'}
          </button>
        </header>

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Received</span>
            <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <span className="text-xs text-emerald-400 uppercase tracking-wider font-semibold">Success Rate</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.successRate}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <span className="text-xs text-rose-400 uppercase tracking-wider font-semibold">Failed (DLQ)</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{stats.FAILED}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <span className="text-xs text-amber-400 uppercase tracking-wider font-semibold">Pending</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats.PENDING}</div>
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/70 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Event ID</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Attempts</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
              {events.map((e) => (
                <tr 
                  key={e._id} 
                  onClick={() => handleSelectEvent(e._id)} 
                  className="hover:bg-slate-800/50 cursor-pointer transition"
                >
                  <td className="p-3 font-bold text-indigo-400">{e.eventId}</td>
                  <td className="p-3 font-sans text-slate-300">{e.eventType}</td>
                  <td className="p-3 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      e.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      e.status === 'FAILED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="p-3">{e.attempts ?? 0}</td>
                  <td className="p-3 text-slate-400 font-sans">
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="p-3 text-right text-slate-500 font-sans text-xs">View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Inspection Drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col space-y-5 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Payload Inspector</span>
                <h2 className="text-sm font-bold text-indigo-400 font-mono mt-0.5">{selectedEvent.eventId}</h2>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)} 
                className="px-2 py-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded text-xs transition"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Event Type:</span>
                <p className="font-semibold text-slate-200 mt-0.5">{selectedEvent.eventType}</p>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>
                <p className="font-semibold text-slate-200 mt-0.5">{selectedEvent.status}</p>
              </div>
              <div>
                <span className="text-slate-400">Delivery Attempts:</span>
                <p className="font-semibold text-slate-200 mt-0.5">{selectedEvent.attempts}</p>
              </div>
              <div>
                <span className="text-slate-400">Processed At:</span>
                <p className="font-semibold text-slate-200 mt-0.5">
                  {selectedEvent.processedAt ? new Date(selectedEvent.processedAt).toLocaleString() : 'Pending Queue'}
                </p>
              </div>
            </div>

            {selectedEvent.errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <span className="font-semibold block mb-1">Failure Reason:</span>
                <p className="font-mono">{selectedEvent.errorMessage}</p>
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Decoded JSON Body</span>
              <pre className="flex-1 bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-indigo-300 overflow-auto">
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            </div>

            <button
              onClick={() => handleRetry(selectedEvent._id)}
              disabled={retrying}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold shadow transition disabled:opacity-50"
            >
              {retrying ? 'Re-queueing...' : 'Redrive / Replay Event'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}