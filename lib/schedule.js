const LAGOS_OFFSET_MS = 60 * 60 * 1000;

export const OFFICE_START_LABEL = "9:00 AM";
export const OFFICE_END_LABEL = "5:00 PM";
const OFFICE_START_MINUTES = 9 * 60;
const LATE_GRACE_MINUTES = 15;
const OFFICE_END_MINUTES = 17 * 60;

export function lagosMinutes(date) {
  const lagos = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return lagos.getUTCHours() * 60 + lagos.getUTCMinutes();
}

export function arrivalNotice(date) {
  const late = lagosMinutes(date) > OFFICE_START_MINUTES + LATE_GRACE_MINUTES;
  return {
    late,
    notice: late
      ? `Late arrival. The office day starts at ${OFFICE_START_LABEL}, with a 15-minute grace period.`
      : null,
  };
}

export function departureNotice(date) {
  const early = lagosMinutes(date) < OFFICE_END_MINUTES;
  return {
    early,
    notice: early ? `Early departure. The office day ends at ${OFFICE_END_LABEL}.` : null,
  };
}
