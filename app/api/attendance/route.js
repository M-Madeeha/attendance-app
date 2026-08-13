// app/api/attendance/route.js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { calculateDistanceMeters } from '@/lib/geofence';

// time minute hour
function getFormattedTime() {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export async function POST(request) {
  try {
    const { fullName, email, password, latitude, longitude, action } = await request.json();

    if (!email || !password || !latitude || !longitude || !action) {
      return NextResponse.json(
        { error: 'Missing required credentials or location data.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // user reg
    let userRes = await query('SELECT id, name, password_hash FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    let userId;

    if (userRes.rows.length === 0) {
      if (!fullName || !fullName.trim()) {
        return NextResponse.json(
          { error: 'First-time registration requires a Full Name.' },
          { status: 400 }
        );
      }

      const newUser = await query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [fullName.trim(), cleanEmail, cleanPassword, 'staff']
      );
      userId = newUser.rows[0].id;
    } else {
      const existingUser = userRes.rows[0];
      if (existingUser.password_hash !== cleanPassword) {
        return NextResponse.json(
          { error: 'Incorrect password for this email address.' },
          { status: 401 }
        );
      }
      userId = existingUser.id;
    }

    // office loaction
    const officeRes = await query(
      'SELECT latitude, longitude, radius_meters FROM office_locations LIMIT 1'
    );

    if (officeRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Office location not configured in database' },
        { status: 500 }
      );
    }

    const office = officeRes.rows[0];
    const officeLat = parseFloat(office.latitude);
    const officeLon = parseFloat(office.longitude);
    const maxRadius = office.radius_meters || 100;

    // distance
    const distanceMeters = calculateDistanceMeters(
      parseFloat(latitude),
      parseFloat(longitude),
      officeLat,
      officeLon
    );

    const isWithinGeofence = distanceMeters <= maxRadius;

    if (!isWithinGeofence) {
      return NextResponse.json({
        success: false,
        message: `Check-in failed. You are ${distanceMeters}m away from office`,
        distanceMeters,
      });
    }

    // time
    const currentTimeFormatted = getFormattedTime();

    //doing sign in sign out
    if (action === 'signin') {
      const insertRes = await query(
        `INSERT INTO attendance_logs 
         (user_id, marked_at, latitude, longitude, distance_meters, is_within_geofence, status) 
         VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, 'present') 
         RETURNING *`,
        [userId, latitude, longitude, distanceMeters, isWithinGeofence]
      );

      return NextResponse.json({
        success: true,
        message: `Signed IN successfully at ${currentTimeFormatted}!`,
        log: insertRes.rows[0],
      });
    } else if (action === 'signout') {
      // Find the most recent open sign-in record
      const todayLog = await query(
        `SELECT id FROM attendance_logs 
         WHERE user_id = $1 AND signed_out_at IS NULL 
         ORDER BY marked_at DESC LIMIT 1`,
        [userId]
      );

      if (todayLog.rows.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'No active Sign-In record found. Please Sign In first!',
        });
      }

      const updateRes = await query(
        `UPDATE attendance_logs 
         SET signed_out_at = CURRENT_TIMESTAMP 
         WHERE id = $1 RETURNING *`,
        [todayLog.rows[0].id]
      );

      return NextResponse.json({
        success: true,
        message: `Signed OUT successfully at ${currentTimeFormatted}!`,
        log: updateRes.rows[0],
      });
    }
  } catch (error) {
    console.error('Server error recording attendance:', error);
    return NextResponse.json(
      { error: 'Server error recording attendance: ' + error.message },
      { status: 500 }
    );
  }
}