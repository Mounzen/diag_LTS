const QUEUE_KEY = 'diag_lts_offline_queue';

export function readOfflineQueue() {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
}

export function enqueueOfflineAction(action) {
  const queue = readOfflineQueue();
  queue.push({ ...action, queuedAt: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return queue;
}

export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_KEY);
}
