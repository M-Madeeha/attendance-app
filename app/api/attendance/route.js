import { NextResponse } from "next/server";
import { calculateDistanceMeters } from "@/lib/geofence";
import { lagosDayRange } from "@/lib/office-time";
import { createAuthToken, hashAuthToken, hashPassword, verifyPassword } from "@/lib/passwords";
import { databaseErrorMessage, getPrisma } from "@/lib/prisma";
import { arrivalNotice, departureNotice } from "@/lib/schedule";

function formatLagosTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(date);
}

function serializeLog(log, { includeStatus = false } = {}) {
  if (!log) return null;

  const serialized = {
    id: log.id,
    marked_at: log.markedAt,
    signed_out_at: log.signedOutAt,
    late_arrival: Boolean(log.lateArrival),
    early_departure: Boolean(log.earlyDeparture),
    synced_from_offline: Boolean(log.syncedFromOffline),
  };

  if (includeStatus) serialized.status = log.status;
  return serialized;
}

function dayWhere(userId, when = new Date()) {
  const { start, end } = lagosDayRange(when);
  return {
    userId,
    markedAt: { gte: start, lt: end },
  };
}

function parseRecordedAt(value, offline) {
  if (!offline || !value) return new Date();
  const recordedAt = new Date(value);
  if (Number.isNaN(recordedAt.getTime())) return null;
  const drift = recordedAt.getTime() - Date.now();
  if (drift > 5 * 60 * 1000 || drift < -36 * 60 * 60 * 1000) return null;
  return recordedAt;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email parameter is required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ success: true, todayLog: null, history: [] });
    }

    const [todayLog, history] = await Promise.all([
      prisma.attendanceLog.findFirst({
        where: dayWhere(user.id),
        orderBy: { markedAt: "desc" },
      }),
      prisma.attendanceLog.findMany({
        where: { userId: user.id },
        orderBy: { markedAt: "desc" },
        take: 30,
      }),
    ]);

    return NextResponse.json({
      success: true,
      todayLog: serializeLog(todayLog),
      history: history.map((log) => serializeLog(log, { includeStatus: true })),
    });
  } catch (error) {
    console.error("Error fetching attendance data:", error);
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { fullName, email, password, authToken, latitude, longitude, action, deviceId, recordedAt, offline } = await request.json();

    if (!email || latitude == null || longitude == null || !action || !deviceId || (!password && !authToken)) {
      return NextResponse.json(
        { error: "Missing required credentials, location, or device identifier." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = typeof password === "string" ? password.trim() : "";
    const prisma = getPrisma();
    const effectiveAt = parseRecordedAt(recordedAt, Boolean(offline));
    if (!effectiveAt) {
      return NextResponse.json(
        { error: "That offline record is outside the time that can be synced." },
        { status: 400 }
      );
    }

    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    let issuedToken = null;

    if (authToken) {
      if (!user || user.authTokenHash !== hashAuthToken(authToken)) {
        return NextResponse.json({ error: "Sign in again to refresh this phone." }, { status: 401 });
      }
    } else if (!user) {
      if (!fullName || !fullName.trim()) {
        return NextResponse.json(
          { error: "First-time registration requires a Full Name." },
          { status: 400 }
        );
      }

      const issued = createAuthToken();
      issuedToken = issued.token;
      user = await prisma.user.create({
        data: {
          name: fullName.trim(),
          email: cleanEmail,
          passwordHash: await hashPassword(cleanPassword),
          role: "staff",
          deviceId,
          authTokenHash: issued.hash,
        },
      });
    } else {
      const check = await verifyPassword(cleanPassword, user.passwordHash);
      if (!check.ok) {
        return NextResponse.json(
          { error: "Incorrect password for this email address." },
          { status: 401 }
        );
      }

      const issued = createAuthToken();
      issuedToken = issued.token;
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          authTokenHash: issued.hash,
          ...(check.legacy ? { passwordHash: await hashPassword(cleanPassword) } : {}),
        },
      });
    }

    if (!user.deviceId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { deviceId },
      });
    } else if (user.deviceId !== deviceId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Device mismatch: You can only check in from your registered phone. Please contact your Admin to switch devices.",
        },
        { status: 403 }
      );
    }

    const office = await prisma.officeLocation.findFirst({
      orderBy: { id: "asc" },
    });

    if (!office) {
      return NextResponse.json(
        { error: "Office location not configured in database" },
        { status: 500 }
      );
    }

    const officeLat = Number(office.latitude);
    const officeLon = Number(office.longitude);
    const maxRadius = office.radiusMeters || 100;
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

    const currentTimeFormatted = formatLagosTime(effectiveAt);

    if (action === "signin") {
      const existingToday = await prisma.attendanceLog.findFirst({
        where: dayWhere(user.id, effectiveAt),
        orderBy: { markedAt: "desc" },
      });

      if (existingToday) {
        return NextResponse.json(
          {
            success: false,
            message: existingToday.signedOutAt
              ? "You have already completed attendance for today."
              : "You are already signed in today.",
          },
          { status: 409 }
        );
      }

      const arrival = arrivalNotice(effectiveAt);
      const log = await prisma.attendanceLog.create({
        data: {
          userId: user.id,
          markedAt: effectiveAt,
          latitude,
          longitude,
          distanceMeters,
          isWithinGeofence,
          status: "present",
          lateArrival: arrival.late,
          syncedFromOffline: Boolean(offline),
        },
      });

      const alerts = [];
      if (arrival.late) {
        alerts.push({
          type: "late_arrival",
          message: `${user.name} arrived late at ${currentTimeFormatted}.`,
          userId: user.id,
        });
      }
      if (offline) {
        alerts.push({
          type: "offline_sync",
          message: `${user.name}'s sign-in was saved offline and synced.`,
          userId: user.id,
        });
      }
      if (alerts.length > 0) {
        await prisma.adminAlert.createMany({ data: alerts });
      }

      const message = [`Signed in at ${currentTimeFormatted}. You are ${roundedDistance} m from the office.`];
      if (arrival.notice) message.push(arrival.notice);
      if (offline) message.push("This record was synced from this phone.");

      return NextResponse.json({
        success: true,
        message: message.join(" "),
        notice: arrival.notice,
        authToken: issuedToken,
        log: serializeLog(log, { includeStatus: true }),
      });
    }

    if (action === "signout") {
      const todayLog = await prisma.attendanceLog.findFirst({
        where: { ...dayWhere(user.id, effectiveAt), signedOutAt: null },
        orderBy: { markedAt: "desc" },
      });

      if (!todayLog) {
        return NextResponse.json({
          success: false,
          message: "No open sign-in for today. Sign in before signing out.",
        });
      }

      const departure = departureNotice(effectiveAt);
      const log = await prisma.attendanceLog.update({
        where: { id: todayLog.id },
        data: {
          signedOutAt: effectiveAt,
          earlyDeparture: departure.early,
          syncedFromOffline: Boolean(offline) || todayLog.syncedFromOffline,
        },
      });

      const alerts = [];
      if (departure.early) {
        alerts.push({
          type: "early_departure",
          message: `${user.name} left early at ${currentTimeFormatted}.`,
          userId: user.id,
        });
      }
      if (offline) {
        alerts.push({
          type: "offline_sync",
          message: `${user.name}'s sign-out was saved offline and synced.`,
          userId: user.id,
        });
      }
      if (alerts.length > 0) {
        await prisma.adminAlert.createMany({ data: alerts });
      }

      const message = [`Signed out at ${currentTimeFormatted}. You are ${roundedDistance} m from the office.`];
      if (departure.notice) message.push(departure.notice);
      if (offline) message.push("This record was synced from this phone.");

      return NextResponse.json({
        success: true,
        message: message.join(" "),
        notice: departure.notice,
        authToken: issuedToken,
        log: serializeLog(log, { includeStatus: true }),
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Server error recording attendance:", error);
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
