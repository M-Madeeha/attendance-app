// app/api/admin/route.js
import { NextResponse } from 'next/server';
import { databaseErrorMessage, query } from '@/lib/db';
import { officeDay } from '@/lib/office-time';

const ADMIN_PIN = process.env.ADMIN_PIN || '1234'; // Set your admin PIN here or in .env.local

// GET: Fetch all staff records and attendance stats
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pin = searchParams.get('pin');
    const selectedDate = searchParams.get('date'); // e.g. YYYY-MM-DD

    if (pin !== ADMIN_PIN) {
      return NextResponse.json({ error: 'That PIN is not correct.' }, { status: 401 });
    }

    // 1. Fetch attendance logs (filtered by date if provided)
    let logsQuery = `
      SELECT 
        al.id,
        u.id AS user_id,
        u.name AS staff_name,
        u.email,
        u.device_id,
        al.marked_at,
        al.signed_out_at,
        al.distance_meters,
        al.is_within_geofence,
        al.status
      FROM attendance_logs al
      JOIN users u ON al.user_id = u.id
    `;

    const params = [];
    if (selectedDate) {
      logsQuery += ` WHERE ${officeDay('al.marked_at')} = $1::date`;
      params.push(selectedDate);
    }

    logsQuery += ` ORDER BY al.marked_at DESC LIMIT 100`;

    const logsRes = await query(logsQuery, params);

    // 2. Fetch total registered staff count
    const staffRes = await query(`SELECT id, name, email, device_id FROM users ORDER BY name ASC`);

    return NextResponse.json({
      success: true,
      logs: logsRes.rows,
      staff: staffRes.rows,
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}

// POST: Admin Actions (e.g., Reset Device ID)
export async function POST(request) {
  try {
    const { pin, action, userId } = await request.json();

    if (pin !== ADMIN_PIN) {
      return NextResponse.json({ error: 'That PIN is not correct.' }, { status: 401 });
    }

    if (action === 'reset_device') {
      await query('UPDATE users SET device_id = NULL WHERE id = $1', [userId]);
      return NextResponse.json({ success: true, message: 'Device binding reset successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}