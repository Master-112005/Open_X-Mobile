import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSIONS_KEY = '@openx/permissions';

export const DEFAULT_PERMISSIONS = Object.freeze({
  remoteCommands: true,
  fileTransfer: true,
  receiveFiles: true,
  sendFiles: true,
  powerActions: false,
});

const PERMISSION_KEYS = Object.keys(DEFAULT_PERMISSIONS);

export function normalizePermissions(value, fallback = DEFAULT_PERMISSIONS) {
  const source = value && typeof value === 'object' ? value : {};

  return PERMISSION_KEYS.reduce((normalized, key) => {
    normalized[key] =
      typeof source[key] === 'boolean' ? source[key] : fallback[key];
    return normalized;
  }, {});
}

export async function loadPermissionState() {
  try {
    const stored = await AsyncStorage.getItem(PERMISSIONS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    const lastUpdated = Number(parsed.lastUpdated);

    return {
      permissions: normalizePermissions(parsed.permissions),
      lastUpdated:
        Number.isFinite(lastUpdated) && lastUpdated > 0 ? lastUpdated : null,
    };
  } catch {
    return {
      permissions: { ...DEFAULT_PERMISSIONS },
      lastUpdated: null,
    };
  }
}

export function persistPermissionState(permissionState) {
  return AsyncStorage.setItem(
    PERMISSIONS_KEY,
    JSON.stringify(permissionState),
  );
}
