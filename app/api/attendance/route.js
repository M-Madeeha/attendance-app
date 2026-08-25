// app/api/attendance/route.js

// --- ADD THIS GET FUNCTION ---
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    // 1. Fetch user ID
    const userRes = await query('SELECT id, name FROM users WHERE LOWER(email) = $1', [email.trim().toLowerCase()]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = userRes.rows[0].id;

    // 2. Fetch today's record (checks from 12:00 AM today onward)
    const todayLogRes = await query(
      `SELECT id, marked_at, signed_out_at 
       FROM attendance_logs 
       WHERE user_id = $1 AND marked_at >= CURRENT_DATE 
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}