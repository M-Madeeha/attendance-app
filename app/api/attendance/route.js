// app/api/attendance/route.js
import { NextResponse } from 'next/server';
import { databaseErrorMessage, query } from '@/lib/db';
import { calculateDistanceMeters } from '@/lib/geofence';
import { officeDay, officeToday } from '@/lib/office-time';

// Time format helper: "2:30 PM" (no seconds)
function getFormattedTime() {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// GET: Fetch today's status and past 30 days history
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    // 1. Fetch user ID
    const userRes = await query(
      'SELECT id, name FROM users WHERE LOWER(email) = $1',
      [email.trim().toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: true, todayLog: null, history: [] });
    }
    const userId = userRes.rows[0].id;

    // 2. Fetch today's record for the Lagos office day
    const todayLogRes = await query(
      `SELECT id, marked_at, signed_out_at 
       FROM attendance_logs 
       WHERE user_id = $1 AND ${officeDay('marked_at')} = ${officeToday()}
       ORDER BY marked_at DESC LIMIT 1`,
      [userId]
    );

    // 3. Fetch past 30 days history
    const historyRes = await query(
      `SELECT id, marked_at, signed_out_at, status 
       FROM attendance_logs 
       WHERE user_id = $1 
       ORDER BY marked_at DESC LIMIT 30`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      todayLog: todayLogRes.rows[0] || null,
      history: historyRes.rows,
    });
  } catch (error) {
    console.error('Error fetching attendance data:', error);
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}

// POST: Record Sign-In or Sign-Out
export async function POST(request) {
  try {
    const { fullName, email, password, latitude, longitude, action, deviceId } = await request.json();

    if (!email || !password || !latitude || !longitude || !action || !deviceId) {
      return NextResponse.json(
        { error: 'Missing required credentials, location, or device identifier.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 1. Authenticate or Register User with Device ID
    let userRes = await query(
      'SELECT id, name, password_hash, device_id FROM users WHERE LOWER(email) = $1',
      [cleanEmail]
    );
    let userId;

    if (userRes.rows.length === 0) {
      if (!fullName || !fullName.trim()) {
        return NextResponse.json(
          { error: 'First-time registration requires a Full Name.' },
          { status: 400 }
        );
      }

      // First time registration: Bind account to this device ID
      const newUser = await query(
        'INSERT INTO users (name, email, password_hash, role, device_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [fullName.trim(), cleanEmail, cleanPassword, 'staff', deviceId]
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

      // If user has no device registered yet, bind this first one
      if (!existingUser.device_id) {
        await query('UPDATE users SET device_id = $1 WHERE id = $2', [deviceId, existingUser.id]);
      } else if (existingUser.device_id !== deviceId) {
        // Reject check-in from any other phone
        return NextResponse.json(
          {
            success: false,
            message: 'Device mismatch: You can only check in from your registered phone. Please contact your Admin to switch devices.',
          },
          { status: 403 }
        );
      }

      userId = existingUser.id;
    }
    // 2. Fetch office location from PostgreSQL
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

    // 3. Calculate distance
    const distanceMeters = calculateDistanceMeters(
      parseFloat(latitude),
      parseFloat(longitude),
      officeLat,
      officeLon
    );
    const isWithinGeofence = distanceMeters <= maxRadius;
    const roundedDistance = Math.round(distanceMeters);

    if (!isWithinGeofence) {
      return NextResponse.json(
        {
          success: false,
          message: `You are ${roundedDistance} m from the office. Attendance is only accepted within ${maxRadius} m.`,
          distanceMeters,
        },
        { status: 403 }
      );
    }

    const currentTimeFormatted = getFormattedTime();

    // 4. Action handling
    if (action === 'signin') {
      const existingToday = await query(
        `SELECT id, signed_out_at FROM attendance_logs
         WHERE user_id = $1 AND ${officeDay('marked_at')} = ${officeToday()}
         ORDER BY marked_at DESC LIMIT 1`,
        [userId]
      );

      if (existingToday.rows.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: existingToday.rows[0].signed_out_at
              ? 'You have already completed attendance for today.'
              : 'You are already signed in today.',
          },
          { status: 409 }
        );
      }

      const insertRes = await query(
        `INSERT INTO attendance_logs 
         (user_id, marked_at, latitude, longitude, distance_meters, is_within_geofence, status) 
         VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, 'present') 
         RETURNING *`,
        [userId, latitude, longitude, distanceMeters, isWithinGeofence]
      );

      return NextResponse.json({
        success: true,
        message: `Signed in at ${currentTimeFormatted}. You are ${roundedDistance} m from the office.`,
        log: insertRes.rows[0],
      });
    } else if (action === 'signout') {
      const todayLog = await query(
        `SELECT id FROM attendance_logs 
         WHERE user_id = $1 AND ${officeDay('marked_at')} = ${officeToday()} AND signed_out_at IS NULL 
         ORDER BY marked_at DESC LIMIT 1`,
        [userId]
      );

      if (todayLog.rows.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'No open sign-in for today. Sign in before signing out.',
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
        message: `Signed out at ${currentTimeFormatted}. You are ${roundedDistance} m from the office.`,
        log: updateRes.rows[0],
      });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    console.error('Server error recording attendance:', error);
    return NextResponse.json(
      { error: databaseErrorMessage(error) },
      { status: 500 }
    );
  }
}