'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import BrandLockup from '@/components/BrandLockup';
import { formatShortDate, formatTime } from '@/lib/format';

function formatDistance(value) {
  if (value === null || value === undefined || value === '') return '—';
  const meters = Number(value);
  if (Number.isNaN(meters)) return '—';
  return `${Math.round(meters)} m`;
}

function Stat({ label, value, hint }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

export default function AdminDashboard() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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
      } else if (res.status === 401) {
        setError(data.error || 'That PIN is not correct.');
      } else {
        setError(data.error || 'Could not load the dashboard.');
      }
    } catch {
      setError('Could not reach the admin server.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (event) => {
    event.preventDefault();
    fetchDashboardData(pin, filterDate);
  };

  const handleResetDevice = async (userId, staffName) => {
    if (
      !window.confirm(
        `Unlink the phone registered to ${staffName}? Their next sign-in will bind the phone they use.`
      )
    ) {
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
        fetchDashboardData(pin, filterDate);
      } else {
        setError(data.error || 'Could not reset that device.');
      }
    } catch {
      setError('Could not reset that device.');
    }
  };

  const query = searchQuery.trim().toLowerCase();

  const filteredLogs = useMemo(
    () =>
      logs.filter(
        (log) =>
          !query ||
          log.staff_name.toLowerCase().includes(query) ||
          log.email.toLowerCase().includes(query)
      ),
    [logs, query]
  );

  const filteredStaff = useMemo(
    () =>
      staffList.filter(
        (staff) =>
          !query ||
          staff.name.toLowerCase().includes(query) ||
          staff.email.toLowerCase().includes(query)
      ),
    [staffList, query]
  );

  const openShifts = filteredLogs.filter((log) => !log.signed_out_at).length;
  const outsideOffice = filteredLogs.filter((log) => log.is_within_geofence === false).length;

  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Staff Name,Email,Date,Sign In Time,Sign Out Time,Distance (m),Geofence'];
    const rows = filteredLogs.map((log) =>
      [
        `"${log.staff_name}"`,
        `"${log.email}"`,
        `"${formatShortDate(log.marked_at)}"`,
        `"${formatTime(log.marked_at)}"`,
        `"${formatTime(log.signed_out_at)}"`,
        log.distance_meters ?? '',
        log.is_within_geofence ? 'Inside' : 'Outside',
      ].join(',')
    );

    const csvContent = `data:text/csv;charset=utf-8,${[headers, ...rows].join('\n')}`;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `btel-attendance-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
          <BrandLockup tone="dark" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Admin</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Enter the PIN to review attendance and registered phones.</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block">
              <span className="sr-only">Admin PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="PIN"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-semibold tracking-[0.4em] text-ink outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/15"
                required
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-ink px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#16365c] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? 'Checking PIN…' : 'Open dashboard'}
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-800 ring-1 ring-rose-200">
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-xs text-slate-500">
            <Link href="/" className="font-medium hover:text-ink">
              Back to staff sign-in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b-4 border-brand bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <BrandLockup />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportToCSV}
              disabled={filteredLogs.length === 0}
              className="rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-white"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAuthenticated(false);
                setPin('');
                setError(null);
              }}
              className="rounded-lg px-3.5 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Attendance</h1>
          <p className="mt-1 text-sm text-slate-600">
            {filterDate ? `Records for ${filterDate}.` : 'Latest records across the team.'}
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Records" value={filteredLogs.length} hint={filterDate ? 'On the selected day' : 'In the current view'} />
          <Stat label="Open shifts" value={openShifts} hint="Signed in, not yet signed out" />
          <Stat label="Outside office" value={outsideOffice} hint={`${staffList.length} registered staff`} />
        </section>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
          <input
            type="search"
            placeholder="Search name or email"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/15"
          />
          <input
            type="date"
            value={filterDate}
            onChange={(event) => {
              const nextDate = event.target.value;
              setFilterDate(nextDate);
              fetchDashboardData(pin, nextDate);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/15"
          />
          {filterDate && (
            <button
              type="button"
              onClick={() => {
                setFilterDate('');
                fetchDashboardData(pin, '');
              }}
              className="rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              All dates
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
            {error}
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Staff</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Sign in</th>
                    <th className="px-4 py-3 font-semibold">Sign out</th>
                    <th className="px-4 py-3 font-semibold">Distance</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        Loading records…
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        No attendance records match this view.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="align-top">
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-ink">{log.staff_name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{log.email}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">{formatShortDate(log.marked_at)}</td>
                        <td className="px-4 py-3.5 font-medium text-emerald-700">{formatTime(log.marked_at)}</td>
                        <td className={`px-4 py-3.5 font-medium ${log.signed_out_at ? 'text-rose-700' : 'text-amber-700'}`}>
                          {log.signed_out_at ? formatTime(log.signed_out_at) : 'Open'}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{formatDistance(log.distance_meters)}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              log.is_within_geofence
                                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                                : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                            }`}
                          >
                            {log.is_within_geofence ? 'Inside' : 'Outside'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-4">
              <h2 className="text-sm font-semibold text-ink">Registered staff</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Reset a phone when someone changes devices.</p>
            </div>
            <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
              {filteredStaff.length === 0 ? (
                <li className="px-4 py-6 text-sm text-slate-500">No staff match this search.</li>
              ) : (
                filteredStaff.map((staff) => (
                  <li key={staff.id} className="px-4 py-3.5">
                    <p className="text-sm font-medium text-ink">{staff.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{staff.email}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        {staff.device_id ? `Phone linked · ${String(staff.device_id).slice(-6)}` : 'No phone linked'}
                      </p>
                      {staff.device_id && (
                        <button
                          type="button"
                          onClick={() => handleResetDevice(staff.id, staff.name)}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}
