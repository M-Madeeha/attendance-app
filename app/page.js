'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BrandLockup from '@/components/BrandLockup';
import ThemeToggle from '@/components/ThemeToggle';
import { formatClock, formatLongDate, formatShortDate, formatTime } from '@/lib/format';
import {
  cacheAttendance,
  enqueueOfflineAttendance,
  readCachedAttendance,
  readOfflineQueue,
  writeOfflineQueue,
} from '@/lib/offline-queue';
import { arrivalNotice, departureNotice, OFFICE_END_LABEL } from '@/lib/schedule';

function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('btel_device_id');
  if (!id) {
    id = `dev_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`;
    localStorage.setItem('btel_device_id', id);
  }
  return id;
}

function storeProfile(profile) {
  const stored = { ...profile };
  if (stored.authToken) delete stored.password;
  localStorage.setItem('staff_profile', JSON.stringify(stored));
  return stored;
}

function Shell({ children }) {
  return (
    <main className="min-h-screen bg-background sm:px-4 sm:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white sm:min-h-[calc(100vh-4rem)] sm:overflow-hidden sm:rounded-[28px] sm:shadow-[0_24px_80px_-32px_rgba(12,35,64,0.45)] sm:ring-1 sm:ring-slate-200/80">
        {children}
      </div>
    </main>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink/70">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/15"
      />
    </label>
  );
}

function NoticeList({ log }) {
  const notices = [];
  if (log?.late_arrival) notices.push('Late arrival');
  if (log?.early_departure) notices.push('Early departure');
  if (log?.pending || log?.synced_from_offline) notices.push(log?.pending ? 'Waiting to sync' : 'Synced from this phone');
  if (notices.length === 0) return null;

  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {notices.map((notice) => (
        <li key={notice} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
          {notice}
        </li>
      ))}
    </ul>
  );
}

export default function StaffAttendanceApp() {
  const [booting, setBooting] = useState(true);
  const [now, setNow] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [todayLog, setTodayLog] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [offline, setOffline] = useState(false);
  const profileRef = useRef(null);
  const flushing = useRef(false);

  profileRef.current = userProfile;

  const rememberProfile = (profile) => {
    const stored = storeProfile(profile);
    profileRef.current = stored;
    setUserProfile(stored);
    return stored;
  };

  const syncAttendanceData = async (userEmail) => {
    try {
      const res = await fetch(`/api/attendance?email=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      if (data.success) {
        setTodayLog(data.todayLog);
        setHistory(data.history || []);
        cacheAttendance(userEmail, { todayLog: data.todayLog, history: data.history || [] });
        return true;
      }
    } catch (err) {
      console.error('Failed to sync attendance:', err);
      const cached = readCachedAttendance(userEmail);
      if (cached) {
        setTodayLog(cached.todayLog);
        setHistory(cached.history || []);
      }
    }
    return false;
  };

  const flushQueue = async () => {
    if (flushing.current) return;
    const profile = profileRef.current;
    if (!profile) return;

    const queued = readOfflineQueue().filter((item) => item.email === profile.email);
    const others = readOfflineQueue().filter((item) => item.email !== profile.email);
    if (queued.length === 0) {
      setPendingCount(0);
      return;
    }

    flushing.current = true;
    const remaining = [];
    let latestToken = profile.authToken;
    let droppedMessage = null;

    for (const item of queued) {
      try {
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...item.payload,
            authToken: latestToken || item.payload.authToken,
            password: latestToken ? undefined : item.payload.password,
          }),
        });
        const data = await res.json();
        if (res.status >= 400 && res.status < 500) {
          droppedMessage = data.message || data.error || 'A saved record could not be synced.';
          continue;
        }
        if (!res.ok || !data.success) {
          remaining.push(item);
          continue;
        }
        if (data.authToken) latestToken = data.authToken;
      } catch {
        remaining.push(item);
      }
    }

    writeOfflineQueue([...others, ...remaining]);
    setPendingCount(remaining.length);
    flushing.current = false;

    if (latestToken && latestToken !== profile.authToken) {
      rememberProfile({ ...profile, authToken: latestToken });
    }
    if (droppedMessage) setMessage({ type: 'error', text: droppedMessage });
    if (remaining.length === 0) await syncAttendanceData(profile.email);
  };

  useEffect(() => {
    setNow(new Date());
    setOffline(!navigator.onLine);
    const timer = setInterval(() => setNow(new Date()), 30000);
    const onOnline = () => {
      setOffline(false);
      flushQueue();
    };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const savedUser = localStorage.getItem('staff_profile');
    if (!savedUser) {
      setBooting(false);
      return () => {
        clearInterval(timer);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }

    try {
      const parsedUser = JSON.parse(savedUser);
      profileRef.current = parsedUser;
      setUserProfile(parsedUser);
      setPendingCount(readOfflineQueue().filter((item) => item.email === parsedUser.email).length);
      syncAttendanceData(parsedUser.email)
        .finally(() => setBooting(false))
        .then(() => flushQueue());
    } catch {
      localStorage.removeItem('staff_profile');
      setBooting(false);
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleSaveProfile = (event) => {
    event.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      setMessage({ type: 'error', text: 'Enter your name, email, and password.' });
      return;
    }

    const profile = rememberProfile({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
    });
    setMessage(null);
    syncAttendanceData(profile.email);
  };

  const handleSwitchAccount = () => {
    if (!window.confirm('Remove the saved profile from this phone?')) return;
    localStorage.removeItem('staff_profile');
    profileRef.current = null;
    setUserProfile(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setTodayLog(null);
    setHistory([]);
    setShowHistory(false);
    setPendingCount(0);
    setMessage(null);
  };

  const handleAttendance = (action) => {
    setMessage(null);
    setLoading(true);

    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'This browser cannot read your location.' });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const profile = profileRef.current;
        const recordedAt = new Date().toISOString();
        const payload = {
          fullName: profile.fullName,
          email: profile.email,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          action,
          deviceId: getOrCreateDeviceId(),
          recordedAt,
          offline: true,
        };
        if (profile.authToken) payload.authToken = profile.authToken;
        else payload.password = profile.password;

        const saveLocally = () => {
          const queue = enqueueOfflineAttendance({ email: profile.email, payload });
          setPendingCount(queue.filter((item) => item.email === profile.email).length);
          const when = new Date(recordedAt);
          if (action === 'signin') {
            const arrival = arrivalNotice(when);
            setTodayLog({
              id: `pending-${recordedAt}`,
              marked_at: recordedAt,
              signed_out_at: null,
              late_arrival: arrival.late,
              early_departure: false,
              pending: true,
            });
          } else {
            const departure = departureNotice(when);
            setTodayLog((current) => ({
              ...(current || { id: `pending-${recordedAt}`, marked_at: recordedAt }),
              signed_out_at: recordedAt,
              early_departure: departure.early,
              pending: true,
            }));
          }
          setMessage({
            type: 'success',
            text: 'Saved on this phone. It will sync when the connection is back.',
          });
        };

        try {
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, offline: false }),
          });
          const data = await res.json();

          if (data.success) {
            if (data.authToken) rememberProfile({ ...profile, authToken: data.authToken });
            setMessage({ type: 'success', text: data.message });
            await syncAttendanceData(profile.email);
          } else {
            setMessage({
              type: 'error',
              text: data.message || data.error || 'Could not record attendance.',
            });
          }
        } catch {
          saveLocally();
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);
        setMessage({
          type: 'error',
          text:
            error.code === 1
              ? 'Location access was denied. Allow it in your browser settings and try again.'
              : 'Could not read your location. Move closer to a window and try again.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const pastRecords = history.filter((item) => !todayLog || item.id !== todayLog.id);
  const shiftComplete = Boolean(todayLog?.signed_out_at);

  return (
    <Shell>
      <header className="chrome border-b-4 border-brand bg-ink px-6 pb-6 pt-7 text-white">
        <div className="flex items-start justify-between gap-4">
          <BrandLockup />
          <div className="flex flex-col items-end gap-2">
            <ThemeToggle />
            {now && (
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">{formatClock(now)}</p>
                <p className="mt-1 max-w-36 text-xs leading-5 text-white/65">{formatLongDate(now)}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-6 py-6">
        {booting ? (
          <div className="space-y-3" aria-hidden="true">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : !userProfile ? (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Set up your profile</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This phone is linked to your account after the first sign-in. Use the password you already registered with.
            </p>

            <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
              <Field
                label="Full name"
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Ahmad Musa"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
              <Field
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="ahmad.musa@btel.com.ng"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <Field
                label="Password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Your account password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#008fc7] active:scale-[0.99]"
              >
                Continue
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-ink">{userProfile.fullName}</h1>
                <p className="mt-0.5 text-xs text-slate-500">{userProfile.email}</p>
              </div>
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="shrink-0 text-xs font-medium text-slate-500 underline-offset-2 hover:text-ink hover:underline"
              >
                Switch profile
              </button>
            </div>

            {(offline || pendingCount > 0) && (
              <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-950 ring-1 ring-amber-200">
                {offline
                  ? 'You are offline. Attendance stays on this phone and syncs when you reconnect.'
                  : `${pendingCount} attendance ${pendingCount === 1 ? 'record is' : 'records are'} waiting to sync.`}
              </p>
            )}

            {!todayLog ? (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Today</p>
                <h2 className="mt-2 text-lg font-semibold text-ink">Not signed in</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Sign in only works while you are at the office. Arrivals after 9:15 AM are marked late. Leaving before {OFFICE_END_LABEL} is marked early.
                </p>
                <button
                  type="button"
                  onClick={() => handleAttendance('signin')}
                  disabled={loading}
                  className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {loading ? 'Finding your location…' : 'Sign in'}
                </button>
              </section>
            ) : (
              <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Today</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      shiftComplete ? 'bg-brand/10 text-[#08648c]' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {shiftComplete ? 'Shift complete' : 'On site'}
                  </span>
                </div>

                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Sign in</dt>
                    <dd className="font-semibold text-emerald-700">{formatTime(todayLog.marked_at)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Sign out</dt>
                    <dd className={`font-semibold ${shiftComplete ? 'text-rose-700' : 'text-slate-400'}`}>
                      {shiftComplete ? formatTime(todayLog.signed_out_at) : 'Still on site'}
                    </dd>
                  </div>
                </dl>

                <NoticeList log={todayLog} />

                {shiftComplete ? (
                  <p className="mt-5 rounded-xl bg-white px-3 py-3 text-center text-sm text-ink ring-1 ring-slate-200">
                    Today&apos;s attendance is complete.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAttendance('signout')}
                    disabled={loading}
                    className="mt-5 w-full rounded-xl bg-rose-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-rose-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? 'Finding your location…' : 'Sign out'}
                  </button>
                )}
              </section>
            )}

            <button
              type="button"
              onClick={() => setShowHistory((open) => !open)}
              className="mt-4 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-slate-50"
              aria-expanded={showHistory}
            >
              {showHistory ? 'Hide earlier attendance' : 'View earlier attendance'}
            </button>

            {showHistory && (
              <div className="mt-1 border-t border-slate-200 pt-3">
                {pastRecords.length === 0 ? (
                  <p className="py-3 text-sm text-slate-500">Earlier visits will show up here.</p>
                ) : (
                  <ul className="max-h-64 overflow-y-auto">
                    {pastRecords.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-ink">{formatShortDate(item.marked_at)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Out {item.signed_out_at ? formatTime(item.signed_out_at) : '—'}
                            {item.late_arrival ? ' · Late' : ''}
                            {item.early_departure ? ' · Early' : ''}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-emerald-700">{formatTime(item.marked_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {message && (
          <div
            role="alert"
            className={`mt-4 rounded-xl px-3.5 py-3 text-sm leading-5 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
                : 'bg-rose-50 text-rose-900 ring-1 ring-rose-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <p className="mt-auto pt-8 text-center text-xs text-slate-400">
          <Link href="/admin" className="font-medium text-slate-500 hover:text-ink">
            Admin
          </Link>
        </p>
      </div>
    </Shell>
  );
}
