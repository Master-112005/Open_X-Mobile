import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSIONS_KEY = '@openx/permissions';
const BLOCKCHAIN_PERMISSIONS_KEY = '@openx/blockchain/permissions';

export const DEFAULT_PERMISSIONS = Object.freeze({
  remoteCommands: true,
  fileTransfer: true,
  receiveFiles: true,
  sendFiles: true,
  powerActions: false,
});

const PERMISSION_KEYS = Object.keys(DEFAULT_PERMISSIONS);
let blockchainPermissionCache = [];

export const PERMISSION_STATUS = Object.freeze({
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  PENDING: 'PENDING',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  UNKNOWN: 'UNKNOWN',
});

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

export async function loadBlockchainPermissionCache() {
  try {
    const stored = await AsyncStorage.getItem(BLOCKCHAIN_PERMISSIONS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    blockchainPermissionCache = Array.isArray(parsed)
      ? parsed.map(normalizePermissionRecord).filter((item) => item.deviceId && item.permissionName)
      : [];
    return [...blockchainPermissionCache];
  } catch {
    blockchainPermissionCache = [];
    return [];
  }
}

export async function cachePermissionRecord(record = {}) {
  const normalized = normalizePermissionRecord(record);
  if (!normalized.deviceId || !normalized.permissionName) {
    throw new Error('Permission record requires deviceId and permissionName.');
  }
  const existing = await loadBlockchainPermissionCache();
  const next = [
    ...existing.filter((item) => item.deviceId !== normalized.deviceId || item.permissionName !== normalized.permissionName),
    normalized,
  ];
  blockchainPermissionCache = next;
  await AsyncStorage.setItem(BLOCKCHAIN_PERMISSIONS_KEY, JSON.stringify(next));
  return normalized;
}

export async function synchronizePermissionRecords(records = []) {
  const normalized = records.map(normalizePermissionRecord).filter((item) => item.deviceId && item.permissionName);
  blockchainPermissionCache = normalized;
  await AsyncStorage.setItem(BLOCKCHAIN_PERMISSIONS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function checkCachedPermission(input = {}) {
  const permissionName = String(input.permissionName || input.name || input.operation || '').trim();
  const localPermissions = normalizePermissions(input.localPermissions || DEFAULT_PERMISSIONS);
  if (permissionName && Object.prototype.hasOwnProperty.call(localPermissions, permissionName) && localPermissions[permissionName] === false) {
    return { allowed: false, decision: 'DENY', permissionStatus: PERMISSION_STATUS.DENIED, reason: 'local-policy-denied' };
  }
  const deviceId = String(input.deviceId || input.sourceDeviceId || input.destinationDeviceId || '').trim();
  const cached = blockchainPermissionCache.find((item) => item.deviceId === deviceId && item.permissionName === permissionName);
  if (!cached) return { allowed: true, decision: 'ALLOW', permissionStatus: PERMISSION_STATUS.UNKNOWN, reason: 'unknown-allowed-no-registry' };
  if ([PERMISSION_STATUS.DENIED, PERMISSION_STATUS.REVOKED].includes(cached.status)) {
    return { allowed: false, decision: cached.status === PERMISSION_STATUS.REVOKED ? 'BLOCK' : 'DENY', permissionStatus: cached.status, reason: 'permission-denied', permission: cached };
  }
  if (isExpired(cached)) {
    return { allowed: false, decision: 'REQUEST', permissionStatus: PERMISSION_STATUS.EXPIRED, reason: 'permission-expired', permission: cached };
  }
  if (cached.status === PERMISSION_STATUS.GRANTED) {
    return { allowed: true, decision: 'ALLOW', permissionStatus: PERMISSION_STATUS.GRANTED, reason: 'granted-cache', permission: cached };
  }
  return { allowed: false, decision: 'REQUEST', permissionStatus: cached.status, reason: 'permission-not-granted', permission: cached };
}

export async function checkPermission(input = {}) {
  await loadBlockchainPermissionCache();
  return checkCachedPermission(input);
}

export function normalizePermissionRecord(record = {}) {
  const now = new Date().toISOString();
  const status = String(record.status || record.permissionStatus || '').toUpperCase();
  return {
    permissionId: String(record.permissionId || `${record.deviceId || ''}:${record.permissionName || record.name || ''}`),
    deviceId: String(record.deviceId || '').trim(),
    walletAddress: String(record.walletAddress || '').trim(),
    permissionName: String(record.permissionName || record.name || '').trim(),
    status: Object.values(PERMISSION_STATUS).includes(status) ? status : PERMISSION_STATUS.UNKNOWN,
    grantedBy: String(record.grantedBy || '').trim(),
    createdAt: validIso(record.createdAt) || now,
    updatedAt: validIso(record.updatedAt) || now,
    lastVerified: validIso(record.lastVerified) || now,
    expiresAt: validIso(record.expiresAt) || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    transactionHash: String(record.transactionHash || '').trim(),
    blockNumber: Number.isFinite(Number(record.blockNumber)) ? Number(record.blockNumber) : null,
    version: String(record.version || 'openx-permission-v1'),
    source: String(record.source || 'cache'),
  };
}

function isExpired(record = {}) {
  if (record.status === PERMISSION_STATUS.EXPIRED) return true;
  const expires = Date.parse(record.expiresAt || '');
  return Number.isFinite(expires) && expires <= Date.now();
}

function validIso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
