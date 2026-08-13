
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { calculateDistanceMeters } from '@/lib/geofence';

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
      // reg for new user
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
      // verify password for old user
      const existingUser = userRes.rows[0];
      if (existingUser.password_hash !== cleanPassword) {
        return NextResponse.json(
          { error: 'Incorrect password for this email address.' },
          { status: 401 }
        );
      }
      userId = existingUser.id;
    }

    //  Fetch btel location
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

    // Calculate distance
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
        message: `Check-in failed. You are ${distanceMeters}m away from office (Allowed: ${maxRadius}m).`,
        distanceMeters,
      });
    }

    // Record Sign In / Sign Out
    const formattedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    });

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
        message: `Signed in successfully at ${new Date().toLocaleTimeString()}!`,
        log: insertRes.rows[0],
      });
    } else if (action === 'signout') {
      const todayLog = await query(
        `SELECT id FROM attendance_logs 
         WHERE user_id = $1 AND marked_at >= $2 AND signed_out_at IS NULL 
         ORDER BY marked_at DESC LIMIT 1`,
        [userId, todayStart]
      );

      if (todayLog.rows.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'No active Sign-In record found for today. Please Sign In first!',
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
        message: `Signed OUT successfully at ${formattedTime}!`,
        log: updateRes.rows[0],
      });
    }
  } catch (error) {
    console.error('Error recording attendance:', error);
    return NextResponse.json(
      { error: 'Server error recording attendance' },
      { status: 500 }
    );
  }
}