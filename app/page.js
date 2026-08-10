'use client';

import { useState } from 'react';

export default function StaffCheckInPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [coords, setCoords] = useState(null);

  // We use user ID 2 (Jane Doe) for default testing
  const TEST_USER_ID = 2;

  const handleCheckIn = () => {
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
        setCoords({ lat, lon });

        try {
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: TEST_USER_ID,
              latitude: lat,
              longitude: lon,
            }),
          });

          const data = await res.json();

          if (data.success) {
            setMessage({ type: 'success', text: `${data.message} (${data.distanceMeters}m away)` });
          } else {
            setMessage({ type: 'error', text: `${data.message}` });
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
          text: 'Unable to retrieve location. Please allow location access in browser settings.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl p-6 border border-slate-200 text-center">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          📍
        </div>

        <h1 className="text-xl font-bold text-slate-800">Staff Check-In</h1>
        <p className="text-sm text-slate-500 mt-1">Tap below to verify your GPS location and mark attendance.</p>

        <div className="my-6">
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white shadow-md transition-all ${
              loading
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
            }`}
          >
            {loading ? 'Getting Location...' : 'Mark Attendance'}
          </button>
        </div>

        {coords && (
          <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 mb-4 border border-slate-200">
            <p><strong>Captured GPS:</strong></p>
            <p>Lat: {coords.lat.toFixed(6)}, Lon: {coords.lon.toFixed(6)}</p>
          </div>
        )}

        {message && (
          <div
            className={`p-3 rounded-lg text-sm font-medium ${
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