import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = '@openx/session';

export const EMPTY_SESSION = Object.freeze({
  sessionToken: '',
  issuedAt: null,
  expiresAt: null,
});

const normalizeTimestamp = (value) => {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
};

export function normalizeSession(value) {
  const source = value?.session && typeof value.session === 'object'
    ? value.session
    : value && typeof value === 'object'
      ? value
      : {};

  return {
    sessionToken:
      typeof source.sessionToken === 'string' ? source.sessionToken.trim() : '',
    issuedAt: normalizeTimestamp(source.issuedAt),
    expiresAt: normalizeTimestamp(source.expiresAt),
  };
}

export function isSessionValid(session, now = Date.now()) {
  return Boolean(
    session?.sessionToken &&
      Number.isFinite(session.issuedAt) &&
      Number.isFinite(session.expiresAt) &&
      session.issuedAt <= now &&
      session.expiresAt > now,
  );
}

export async function loadSession() {
  try {
    const stored = await AsyncStorage.getItem(SESSION_KEY);
    return normalizeSession(stored ? JSON.parse(stored) : {});
  } catch {
    return { ...EMPTY_SESSION };
  }
}

export function persistSession(session) {
  return AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearPersistedSession() {
  return persistSession(EMPTY_SESSION);
}
