import { normalizeRelayUrl } from './relayClient';

const INVALID_QR_MESSAGE = 'Invalid pairing QR code.';
const EXPIRED_QR_MESSAGE = 'This pairing QR code has expired.';
const LOCAL_PAIRING_REMOVED_MESSAGE = 'Local LAN pairing is no longer supported. Pair with the OpenX cloud relay QR code.';
const CLOUD_PAIR_VERSION = 1;

export function parsePairingQrPayload(rawPayload, now = Date.now()) {
  let payload;

  try {
    payload = JSON.parse(rawPayload);
  } catch {
    throw new Error(INVALID_QR_MESSAGE);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(INVALID_QR_MESSAGE);
  }

  const relayUrl = typeof (payload.relayUrl || payload.u) === 'string'
    ? (payload.relayUrl || payload.u).trim()
    : '';
  const cloudPairToken = typeof (payload.pairToken || payload.t) === 'string'
    ? (payload.pairToken || payload.t).trim()
    : '';
  const cloudVersion = Number(payload.version ?? payload.v);
  const rawCloudExpiresAt = Number(payload.expiresAt ?? payload.e);

  if (relayUrl || cloudPairToken || cloudVersion) {
    if (
      cloudVersion !== CLOUD_PAIR_VERSION ||
      !/^wss?:\/\/[^\s/$.?#].[^\s]*$/i.test(relayUrl) ||
      !cloudPairToken ||
      !Number.isFinite(rawCloudExpiresAt) ||
      rawCloudExpiresAt <= 0
    ) {
      throw new Error(INVALID_QR_MESSAGE);
    }
    const expiresAt = rawCloudExpiresAt < 1_000_000_000_000
      ? rawCloudExpiresAt * 1000
      : rawCloudExpiresAt;
    if (expiresAt <= now) {
      throw new Error(EXPIRED_QR_MESSAGE);
    }
    return {
      mode: 'cloud',
      relayUrl: normalizeRelayUrl(relayUrl),
      pairToken: cloudPairToken,
      expiresAt,
      version: CLOUD_PAIR_VERSION,
    };
  }

  throw new Error(LOCAL_PAIRING_REMOVED_MESSAGE);
}
