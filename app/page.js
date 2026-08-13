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
  
  // Track active session for today (stores sign-in time once clicked)
  const [activeSession, setActiveSession] = useState(null);

  // Today's formatted date string (Day, DD Month YYYY)
  const todayFormattedDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Load profile and check today's attendance status on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('staff_profile');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUserProfile(parsedUser);
      
      // Check if they already signed in today
      const todayKey = `attendance_session_${parsedUser.email}_${new Date().toISOString().split('T')[0]}`;
      const savedSession = localStorage.getItem(todayKey);
      if (savedSession) {
        setActiveSession(JSON.parse(savedSession));
      }
    }
  }, []);

  // Save Profile Setup
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

  // Logout / Switch Account
  const handleSignOutProfile = () => {
    localStorage.removeItem('staff_profile');
    setUserProfile(null);
    setActiveSession(null);
    setMessage(null);
  };

  // GPS Check-In Handler
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
              action,
            }),
          });

          const data = await res.json();

          if (data.success) {
            const timeNow = new Date().toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });

            const todayKey = `attendance_session_${userProfile.email}_${new Date().toISOString().split('T')[0]}`;

            if (action === 'signin') {
              const sessionData = {
                signInTime: timeNow,
                signOutTime: null,
              };
              localStorage.setItem(todayKey, JSON.stringify(sessionData));
              setActiveSession(sessionData);
              setMessage({ type: 'success', text: `Signed in successfully at ${timeNow}!` });
            } else if (action === 'signout') {
              const updatedSession = {
                ...activeSession,
                signOutTime: timeNow,
              };
              localStorage.setItem(todayKey, JSON.stringify(updatedSession));
              setActiveSession(updatedSession);
              setMessage({ type: 'success', text: `Signed out successfully at ${timeNow}!` });
            }
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
          text: 'Unable to retrieve location. Please enable GPS permissions.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl p-6 border border-slate-200">
        
        {/* Company Logo */}
        <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center">
          <img
            src="/BtelLogo.jpg"
            alt="Btel"
            className="h-full w-auto object-contain"
          />
        </div>

        {/* STEP 1: CREATE PROFILE */}
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
                Save & Continue ➔
              </button>
            </form>
          </div>
        ) : (
          /*  attendance screen */
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Welcome</span>
                <h2 className="text-sm font-bold text-slate-800">{userProfile.fullName}</h2>
              </div>
              <button
                onClick={handleSignOutProfile}
                className="text-xs text-red-500 hover:underline"
              >
                Switch Account
              </button>
            </div>

            {/* if not signed in */}
            {!activeSession ? (
              <div className="my-6">
                <button
                  onClick={() => handleAttendance('signin')}
                  disabled={loading}
                  className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white shadow-md text-sm transition-all ${
                    loading
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
                  }`}
                >
                  {loading ? 'Checking Location...' : 'Sign In'}
                </button>
              </div>
            ) : (
              /* aftee signing in*/
              <div className="mt-4 mb-6">
                {/* Date Header */}
                <div className="bg-blue-50 border border-blue-200 rounded-t-xl p-2.5 text-center">
                  <p className="text-xs font-bold text-blue-900">{todayFormattedDate}</p>
                </div>

                {/* Table Data */}
                <div className="border border-t-0 border-slate-200 rounded-b-xl p-3 bg-slate-50 space-y-2 text-xs">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-slate-500"> Name:</span>
                    <span className="font-semibold text-slate-800">{userProfile.fullName}</span>
                  </div>

                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-slate-500">Sign In Time:</span>
                    <span className="font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                      {activeSession.signInTime}
                    </span>
                  </div>

                  {activeSession.signOutTime && (
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-500">Sign Out Time:</span>
                      <span className="font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                        {activeSession.signOutTime}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sign Out Button (Shown at the bottom until signed out) */}
                {!activeSession.signOutTime ? (
                  <button
                    onClick={() => handleAttendance('signout')}
                    disabled={loading}
                    className={`w-full mt-4 py-3 px-4 rounded-xl font-semibold text-white shadow-md text-sm transition-all ${
                      loading
                        ? 'bg-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
                    }`}
                  >
                    {loading ? 'Checking Location...' : 'Sign Out'}
                  </button>
                ) : (
                  <div className="mt-4 p-2.5 bg-slate-100 rounded-lg text-center text-xs font-medium text-slate-600">
                    Shift Completed
                  </div>
                )}
              </div>
            )}
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