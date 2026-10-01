const OFFICE_TIME_ZONE = 'Africa/Lagos';

export function officeDay(column) {
  return `(${column} AT TIME ZONE '${OFFICE_TIME_ZONE}')::date`;
}

export function officeToday() {
  return `(CURRENT_TIMESTAMP AT TIME ZONE '${OFFICE_TIME_ZONE}')::date`;
}
