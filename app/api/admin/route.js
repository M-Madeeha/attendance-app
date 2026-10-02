import { NextResponse } from "next/server";
import { lagosDayRange, lagosDayRangeFromDate } from "@/lib/office-time";
import { databaseErrorMessage, getPrisma } from "@/lib/prisma";

const ADMIN_PIN = process.env.ADMIN_PIN || "1234";
const DAY_MS = 24 * 60 * 60 * 1000;

function serializeLog(log) {
  return {
    id: log.id,
    user_id: log.userId,
    staff_name: log.user.name,
    email: log.user.email,
    device_id: log.user.deviceId,
    marked_at: log.markedAt,
    signed_out_at: log.signedOutAt,
    distance_meters: log.distanceMeters == null ? null : Number(log.distanceMeters),
    is_within_geofence: log.isWithinGeofence,
    status: log.status,
    late_arrival: log.lateArrival,
    early_departure: log.earlyDeparture,
    synced_from_offline: log.syncedFromOffline,
  };
}

function serializeStaff(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    device_id: user.deviceId,
  };
}

function serializeAlert(alert) {
  return {
    id: alert.id,
    type: alert.type,
    message: alert.message,
    created_at: alert.createdAt,
    read_at: alert.readAt,
    staff_name: alert.user?.name || null,
  };
}

function reportRange(from, to) {
  if (!from && !to) {
    const today = lagosDayRange();
    return { start: new Date(today.start.getTime() - 29 * DAY_MS), end: today.end };
  }

  const startRange = lagosDayRangeFromDate(from || to);
  const endRange = lagosDayRangeFromDate(to || from);
  if (!startRange || !endRange || endRange.start < startRange.start) return null;
  return { start: startRange.start, end: endRange.end };
}

function buildReport(logs) {
  const byUser = new Map();

  for (const log of logs) {
    const current = byUser.get(log.userId) || {
      user_id: log.userId,
      name: log.user.name,
      email: log.user.email,
      days: 0,
      late: 0,
      early: 0,
      open: 0,
    };
    current.days += 1;
    if (log.lateArrival) current.late += 1;
    if (log.earlyDeparture) current.early += 1;
    if (!log.signedOutAt) current.open += 1;
    byUser.set(log.userId, current);
  }

  const staff = [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    staff,
    totals: {
      records: logs.length,
      late: staff.reduce((sum, row) => sum + row.late, 0),
      early: staff.reduce((sum, row) => sum + row.early, 0),
      open: staff.reduce((sum, row) => sum + row.open, 0),
    },
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pin = searchParams.get("pin");
    const selectedDate = searchParams.get("date");

    if (pin !== ADMIN_PIN) {
      return NextResponse.json({ error: "That PIN is not correct." }, { status: 401 });
    }

    const where = {};
    if (selectedDate) {
      const range = lagosDayRangeFromDate(selectedDate);
      if (!range) {
        return NextResponse.json({ error: "Use a date in YYYY-MM-DD format." }, { status: 400 });
      }
      where.markedAt = { gte: range.start, lt: range.end };
    }

    const range = reportRange(searchParams.get("from"), searchParams.get("to"));
    if (!range) {
      return NextResponse.json({ error: "Use report dates in YYYY-MM-DD format." }, { status: 400 });
    }

    const prisma = getPrisma();
    const [logs, staff, reportLogs, alerts] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        include: { user: true },
        orderBy: { markedAt: "desc" },
        take: 100,
      }),
      prisma.user.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.attendanceLog.findMany({
        where: { markedAt: { gte: range.start, lt: range.end } },
        include: { user: true },
        orderBy: { markedAt: "desc" },
      }),
      prisma.adminAlert.findMany({
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);

    return NextResponse.json({
      success: true,
      logs: logs.map(serializeLog),
      staff: staff.map(serializeStaff),
      report: buildReport(reportLogs),
      reportRange: { from: range.start, to: new Date(range.end.getTime() - 1) },
      alerts: alerts.map(serializeAlert),
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { pin, action, userId, alertId } = body;

    if (pin !== ADMIN_PIN) {
      return NextResponse.json({ error: "That PIN is not correct." }, { status: 401 });
    }

    const prisma = getPrisma();

    if (action === "reset_device") {
      const id = Number(userId);
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "A staff id is required." }, { status: 400 });
      }

      await prisma.user.update({
        where: { id },
        data: { deviceId: null },
      });
      return NextResponse.json({ success: true, message: "Device binding reset successfully." });
    }

    if (action === "mark_alert_read") {
      const id = Number(alertId);
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "An alert id is required." }, { status: 400 });
      }
      await prisma.adminAlert.update({
        where: { id },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "mark_all_alerts_read") {
      await prisma.adminAlert.updateMany({
        where: { readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "backup") {
      const [office, staff, attendance, alerts] = await Promise.all([
        prisma.officeLocation.findMany({ orderBy: { id: "asc" } }),
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.attendanceLog.findMany({ orderBy: { markedAt: "asc" } }),
        prisma.adminAlert.findMany({ orderBy: { createdAt: "asc" } }),
      ]);

      return NextResponse.json({
        success: true,
        backup: {
          exportedAt: new Date().toISOString(),
          office: office.map((row) => ({
            id: row.id,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            radius_meters: row.radiusMeters,
          })),
          staff: staff.map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role,
            device_id: row.deviceId,
          })),
          attendance: attendance.map((row) => ({
            id: row.id,
            user_id: row.userId,
            marked_at: row.markedAt,
            signed_out_at: row.signedOutAt,
            latitude: row.latitude == null ? null : Number(row.latitude),
            longitude: row.longitude == null ? null : Number(row.longitude),
            distance_meters: row.distanceMeters == null ? null : Number(row.distanceMeters),
            is_within_geofence: row.isWithinGeofence,
            status: row.status,
            late_arrival: row.lateArrival,
            early_departure: row.earlyDeparture,
            synced_from_offline: row.syncedFromOffline,
          })),
          alerts: alerts.map((row) => ({
            id: row.id,
            type: row.type,
            message: row.message,
            user_id: row.userId,
            created_at: row.createdAt,
            read_at: row.readAt,
          })),
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
