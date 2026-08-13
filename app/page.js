// app/page.js
'use client';

import { useState, useEffect } from 'react';

export default function StaffCheckInPage() {
  const [userProfile, setUserProfile] = useState(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // 1. Check if user profile is already saved in browser local storage on startup
  useEffect(() => {
    const savedUser = localStorage.getItem('staff_profile');
    if (savedUser) {
      setUserProfile(JSON.parse(savedUser));
    }
  }, []);

  // Save profile state to localStorage so they don't have to re-enter it every day
  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all profile fields.' });
      return;
    }

    const profile = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
    };

    localStorage.setItem('staff_profile', JSON.stringify(profile));
    setUserProfile(profile);
    setMessage(null);
  };

  // Switch or Reset Profile
  const handleSignOutProfile = () => {
    localStorage.removeItem('staff_profile');
    setUserProfile(null);
    setMessage(null);
  };

  // 2. Handle Attendance Sign In / Sign Out
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
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: userProfile.fullName,
              email: userProfile.email,
              password: userProfile.password,
              latitude: lat,
              longitude: lon,
              action, // 'signin' or 'signout'
            }),
          });

          const data = await res.json();

          if (data.success) {
            setMessage({ type: 'success', text: data.message });
          } else {
            setMessage({ type: 'error', text: data.message || data.error });
          }
        } catch (err) {
          setMessage({ type: 'error', text: 'Failed to connect to server.' });
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);
        setMessage({
          type: 'error',
          text: 'Unable to retrieve location. Please allow location permissions in your browser.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl p-6 border border-slate-200">
        
        {/* STEP 1: CREATE PROFILE FORM (If no user is logged in) */}
        {!userProfile ? (
          <div>
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
              👤
            </div>
            <h1 className="text-xl font-bold text-slate-800 text-center">Create Profile</h1>
            <p className="text-xs text-slate-500 text-center mt-1 mb-5">
              Set up your profile once. It will save on your phone for daily check-ins.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Johnson"
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
                  placeholder="alex@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Create Password</label>
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
                Save Profile & Continue ➔
              </button>
            </form>
          </div>
        ) : (
          /* STEP 2: DAILY CHECK-IN DASHBOARD (When profile exists) */
          <div>
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Welcome</span>
                <h2 className="text-lg font-bold text-slate-800">{userProfile.fullName}</h2>
                <p className="text-xs text-slate-500">{userProfile.email}</p>
              </div>
              <button
                onClick={handleSignOutProfile}
                className="text-xs text-red-500 hover:underline"
              >
                Switch Account
              </button>
            </div>

            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
              📍
            </div>

            <h3 className="text-base font-bold text-slate-800 text-center">Daily Attendance</h3>
            <p className="text-xs text-slate-500 text-center mt-1 mb-6">
              Tap below to log your time for today.
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => handleAttendance('signin')}
                disabled={loading}
                className={`py-3.5 px-4 rounded-xl font-semibold text-white shadow-md text-sm transition-all ${
                  loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-98'
                }`}
              >
                {loading ? 'Locating...' : 'Sign In 🟢'}
              </button>

              <button
                onClick={() => handleAttendance('signout')}
                disabled={loading}
                className={`py-3.5 px-4 rounded-xl font-semibold text-white shadow-md text-sm transition-all ${
                  loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-98'
                }`}
              >
                {loading ? 'Locating...' : 'Sign Out 🔴'}
              </button>
            </div>
          </div>
        )}

        {message && (
          <div
            className={`p-3 rounded-lg text-xs font-medium text-center ${
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