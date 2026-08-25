// app/page.js
'use client';

import { useState, useEffect } from 'react';

export default function StaffAttendanceApp() {
  const [userProfile, setUserProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Today's attendance state from database
  const [todayLog, setTodayLog] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const todayFormattedDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Helper to format ISO timestamp to "9:05 AM"
  const formatTimeOnly = (isoString) => {
    if (!isoString) return null;
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Helper to format date for history: "13 Aug 2026"
  const formatDateOnly = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };
  // Helper to get or create a persistent device identifier
function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('btel_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    localStorage.setItem('btel_device_id', id);
  }
  return id;
}

  // 1. Fetch latest attendance state from DB
const [mounted, setMounted] = useState(false);

  // Sync attendance safely from DB
  const syncAttendanceData = async (userEmail) => {
    try {
      const res = await fetch(`/api/attendance?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) {
        console.error('Server returned error status:', res.status);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setTodayLog(data.todayLog);
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to sync attendance:', err);
    }
  };

useEffect(() => {
    setMounted(true);
    const savedUser = localStorage.getItem('staff_profile');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUserProfile(parsedUser);
      syncAttendanceData(parsedUser.email);
    }
  }, []);

  // Avoid server/client hydration mismatch during first paint
  if (!mounted) return null;

  // Save profile setup
  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields.' });
      return;
    }

    const profile = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
    };

    localStorage.setItem('staff_profile', JSON.stringify(profile));
    setUserProfile(profile);
    syncAttendanceData(profile.email);
    setMessage(null);
  };

  // Switch Account / Logout
  const handleSwitchAccount = () => {
    localStorage.removeItem('staff_profile');
    setUserProfile(null);
    setTodayLog(null);
    setHistory([]);
    setMessage(null);
  };

  // 3. Mark Attendance (Sign In / Sign Out)
  const handleAttendance = (action) => {
    setMessage(null);
    setLoading(true);

    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by your browser.' });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
         const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: userProfile.fullName,
              email: userProfile.email,
              password: userProfile.password,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              action,
              deviceId: getOrCreateDeviceId(), // <-- Sends phone's unique key
            }),
          });

          const data = await res.json();

          if (data.success) {
            setMessage({ type: 'success', text: data.message });
            await syncAttendanceData(userProfile.email);
          } else {
            setMessage({ type: 'error', text: data.message || data.error });
          }
        } catch (err) {
          setMessage({ type: 'error', text: 'Server connection failed.' });
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setMessage({ type: 'error', text: 'Location access denied. Please enable GPS.' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl p-6 border border-slate-200">
        
        {/* Company Logo */}
        <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center">
          <img src="/BtelLogo.jpg" alt="Btel Logo" className="h-full w-auto object-contain" />
        </div>

        {/* --- STEP 1: CREATE PROFILE (Only shown first time) --- */}
        {!userProfile ? (
          <div>
            <h1 className="text-xl font-bold text-slate-800 text-center">Create Profile</h1>
            <p className="text-xs text-slate-500 text-center mt-1 mb-5">
              Set up your profile.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ahmad Musa"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="ahmad.musa@btel.com.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 font-semibold text-white text-sm rounded-xl shadow-md transition-all mt-2"
              >
                Save & Continue ➔
              </button>
            </form>
          </div>
        ) : (
          /* --- STEP 2: DAILY ATTENDANCE DASHBOARD --- */
          <div>
            {/* User Header */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div>
                <span className="text-xs font-medium text-slate-400">Welcome back,</span>
                <h2 className="text-sm font-bold text-slate-800">{userProfile.fullName}</h2>
              </div>
              <button onClick={handleSwitchAccount} className="text-xs text-red-500 hover:underline">
                Switch
              </button>
            </div>

            {/* NOT SIGNED IN TODAY */}
            {!todayLog ? (
              <div className="my-6 text-center">
                <p className="text-xs text-slate-500 mb-3 font-medium">{todayFormattedDate}</p>
                <button
                  onClick={() => handleAttendance('signin')}
                  disabled={loading}
                  className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white shadow-md text-sm transition-all ${
                    loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-98'
                  }`}
                >
                  {loading ? 'Locating GPS...' : 'Sign In 🟢'}
                </button>
              </div>
            ) : (
              /* SIGNED IN TODAY -> SHOW TODAY'S SUMMARY */
              <div className="mt-2 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-t-xl p-2.5 text-center">
                  <p className="text-xs font-bold text-blue-900">{todayFormattedDate}</p>
                </div>

                <div className="border border-t-0 border-slate-200 rounded-b-xl p-3 bg-slate-50 space-y-2 text-xs">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-slate-500">Staff Name:</span>
                    <span className="font-semibold text-slate-800">{userProfile.fullName}</span>
                  </div>

                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-slate-500">Sign In Time:</span>
                    <span className="font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                      {formatTimeOnly(todayLog.marked_at)}
                    </span>
                  </div>

                  {todayLog.signed_out_at && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-500">Sign Out Time:</span>
                      <span className="font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                        {formatTimeOnly(todayLog.signed_out_at)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sign Out Button (Hides once signed out) */}
                {!todayLog.signed_out_at ? (
                  <button
                    onClick={() => handleAttendance('signout')}
                    disabled={loading}
                    className={`w-full mt-4 py-3 px-4 rounded-xl font-semibold text-white shadow-md text-sm transition-all ${
                      loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-98'
                    }`}
                  >
                    {loading ? 'Locating GPS...' : 'Sign Out 🔴'}
                  </button>
                ) : (
                  <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg text-center text-xs font-medium text-green-800">
                    ✅ Completed shift for today!
                  </div>
                )}
              </div>
            )}

            {/* Past History Trigger Button */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full mt-2 py-2 px-3 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-all"
            >
              {showHistory ? 'Hide History ▲' : 'View Past Attendance 📅'}
            </button>

            {/* Attendance History Accordion / List */}
            {showHistory && (
              <div className="mt-3 border-t border-slate-200 pt-3 max-h-48 overflow-y-auto space-y-2">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Past Records</p>
                {history.length === 0 ? (
                  <p className="text-xs text-slate-400">No previous logs found.</p>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                      <div className="flex justify-between font-semibold text-slate-700 mb-1">
                        <span>{formatDateOnly(item.marked_at)}</span>
                        <span className="text-green-600">IN: {formatTimeOnly(item.marked_at)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Status: Present</span>
                        <span className={item.signed_out_at ? 'text-red-600' : 'text-slate-400'}>
                          OUT: {item.signed_out_at ? formatTimeOnly(item.signed_out_at) : '—'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {message && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-medium text-center ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </main>
  );
}