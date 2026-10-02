const QUEUE_KEY = "btel_offline_queue";

export function readOfflineQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeOfflineQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function enqueueOfflineAttendance(item) {
  const queue = readOfflineQueue();
  queue.push({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ...item,
  });
  writeOfflineQueue(queue);
  return queue;
}

export function cacheAttendance(email, payload) {
  localStorage.setItem(`btel_attendance_cache:${email}`, JSON.stringify(payload));
}

export function readCachedAttendance(email) {
  try {
    return JSON.parse(localStorage.getItem(`btel_attendance_cache:${email}`) || "null");
  } catch {
    return null;
  }
}
