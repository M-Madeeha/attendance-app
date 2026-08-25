// app/admin/page.js
'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [logs, setLogs] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Helper time format
  const formatTime = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Helper date format
  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const fetchDashboardData = async (adminPin, date = '') => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/admin?pin=${encodeURIComponent(adminPin)}${date ? `&date=${date}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success) {
        setLogs(data.logs);
        setStaffList(data.staff);
        setIsAuthenticated(true);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Failed to connect to admin server');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    fetchDashboardData(pin, filterDate);
  };

  const handleResetDevice = async (userId, staffName) => {
    if (!confirm(`Are you sure you want to unbind device for ${staffName}? They will be able to register a new phone on their next sign in.`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, action: 'reset_device', userId }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchDashboardData(pin, filterDate);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error resetting device.');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (logs.length === 0) return alert('No data to export.');

    const headers = ['Staff Name,Email,Date,Sign In Time,Sign Out Time,Distance (m),Geofence'];
    const rows = filteredLogs.map((l) => [
      `"${l.staff_name}"`,
      `"${l.email}"`,
      `"${formatDate(l.marked_at)}"`,
      `"${formatTime(l.marked_at)}"`,
      `"${formatTime(l.signed_out_at)}"`,
      l.distance_meters,
      l.is_within_geofence ? 'Passed' : 'Failed',
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter((l) =>
    l.staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // login
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-6">
          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
            🔒
          </div>
          <h1 className="text-xl font-bold text-slate-800 text-center">Admin Portal</h1>
          <p className="text-xs text-slate-500 text-center mt-1 mb-5">
            Enter the admin PIN.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-center text-lg tracking-widest font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition-all"
            >
              {loading ? 'Verifying...' : 'Unlock Dashboard ➔'}
            </button>
          </form>

          {error && <p className="mt-3 text-xs text-red-600 text-center">{error}</p>}
        </div>
      </main>
    );
  }

  // dashbosrd
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black text-slate-800">Btel Attendance Dashboard</h1>
           
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow transition-all"
            >
              Export CSV
            </button>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>

      

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200">
          <input
            type="text"
            placeholder="Search staff name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              fetchDashboardData(pin, e.target.value);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Attendance Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Staff Name</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Sign In</th>
                  <th className="p-3.5">Sign Out</th>
                  <th className="p-3.5">Distance</th>
                  <th className="p-3.5">Device Binding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800">{log.staff_name}</div>
                        <div className="text-[11px] text-slate-400">{log.email}</div>
                      </td>
                      <td className="p-3.5 font-medium">{formatDate(log.marked_at)}</td>
                      <td className="p-3.5">
                        <span className="font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                          {formatTime(log.marked_at)}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`font-bold px-2 py-0.5 rounded ${
                            log.signed_out_at
                              ? 'text-red-700 bg-red-50 border border-red-200'
                              : 'text-amber-600 bg-amber-50'
                          }`}
                        >
                          {formatTime(log.signed_out_at)}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500">{log.distance_meters || 0}m</td>
                      <td className="p-3.5">
                        <button
                          onClick={() => handleResetDevice(log.user_id, log.staff_name)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          Reset Device
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}