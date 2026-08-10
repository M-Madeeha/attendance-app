import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { calculateDistanceMeters } from '@/lib/geofence';

export async function POST(request) {
  try {
    const { userId, latitude, longitude } = await request.json();

    if (!userId || !latitude || !longitude) {
      return NextResponse.json(
        { error: 'Missing required parameters (userId, latitude, longitude)' },
        { status: 400 }
      );
    }

    // 1. Fetch office location from PostgreSQL
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
    const maxRadius = office.radius_meters || 50;

    // 2. Calculate distance in meters
    const distanceMeters = calculateDistanceMeters(
      parseFloat(latitude),
      parseFloat(longitude),
      officeLat,
      officeLon
    );

    const isWithinGeofence = distanceMeters <= maxRadius;
    const status = isWithinGeofence ? 'present' : 'rejected';

    // 3. Save attendance record into database
    const insertRes = await query(
      `INSERT INTO attendance_logs 
       (user_id, latitude, longitude, distance_meters, is_within_geofence, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [userId, latitude, longitude, distanceMeters, isWithinGeofence, status]
    );

    return NextResponse.json({
      message: isWithinGeofence
        ? 'Check-in successful! Attendance recorded.'
        : `Check-in failed. You are ${distanceMeters}m away from office (Allowed: ${maxRadius}m).`,
      success: isWithinGeofence,
      log: insertRes.rows[0],
      distanceMeters,
    });
  } catch (error) {
    console.error('Error recording attendance:', error);
    return NextResponse.json(
      { error: 'Server error recording attendance' },
      { status: 500 }
    );
  }
}