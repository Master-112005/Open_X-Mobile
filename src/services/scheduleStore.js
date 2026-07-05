import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHEDULES_KEY = '@openx/schedules';
const MAX_SCHEDULES = 200;

export function normalizeScheduleItem(item = {}) {
  if (!item || typeof item !== 'object') return null;
  const dueAt = new Date(item.dueAt || item.time || item.when || 0);
  if (!Number.isFinite(dueAt.getTime())) return null;
  const kind = String(item.kind || item.type || 'Reminder').replace(/\s+/g, ' ').trim();
  const message = String(item.message || item.title || kind).replace(/\s+/g, ' ').trim();
  if (!kind || !message) return null;
  const id = String(item.id || item.taskName || `OpenX_Mobile_${kind}_${Date.now()}`).trim();
  return {
    ...item,
    id,
    taskName: String(item.taskName || id).trim(),
    kind: kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase(),
    title: String(item.title || `OpenX ${kind}`).replace(/\s+/g, ' ').trim(),
    message,
    category: String(item.category || kind).toLowerCase(),
    symbol: item.symbol || (kind.toLowerCase() === 'alarm' ? 'alarm' : kind.toLowerCase() === 'timer' ? 'timer' : 'reminder'),
    dueAt: dueAt.toISOString(),
    status: ['scheduled', 'paused', 'due', 'completed'].includes(String(item.status || '').toLowerCase())
      ? String(item.status).toLowerCase()
      : 'scheduled',
    source: item.source || 'mobile',
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

export function mergeScheduleItems(current = [], incoming = []) {
  const byId = new Map();
  for (const item of current) {
    const normalized = normalizeScheduleItem(item);
    if (normalized) byId.set(normalized.id, normalized);
  }
  for (const item of incoming) {
    const normalized = normalizeScheduleItem(item);
    if (!normalized) continue;
    const existing = byId.get(normalized.id);
    if (!existing) {
      byId.set(normalized.id, normalized);
      continue;
    }
    const existingUpdated = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const nextUpdated = new Date(normalized.updatedAt || normalized.createdAt || 0).getTime();
    byId.set(normalized.id, nextUpdated >= existingUpdated ? normalized : existing);
  }
  return [...byId.values()]
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, MAX_SCHEDULES);
}

export async function loadSchedules() {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return mergeScheduleItems([], Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

export async function persistSchedules(items) {
  const normalized = mergeScheduleItems([], items);
  await AsyncStorage.setItem(SCHEDULES_KEY, JSON.stringify(normalized));
  return normalized;
}

export function schedulesFromSnapshot(snapshot = {}) {
  return Array.isArray(snapshot.entries) ? snapshot.entries : [];
}
