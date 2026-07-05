import { normalizeRelayUrl } from './relayClient';

const INVALID_QR_MESSAGE = 'Invalid pairing QR code.';
const EXPIRED_QR_MESSAGE = 'This pairing QR code has expired.';
const CLOUD_PAIR_VERSION = 1;

function isIpv4Address(value) {
  const parts = String(value || '').trim().split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
}

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

  const serverIp =
    typeof payload.serverIp === 'string' ? payload.serverIp.trim() : '';
  const serverIpCandidates = Array.isArray(payload.serverIpCandidates)
    ? payload.serverIpCandidates
        .filter((address) => typeof address === 'string')
        .map((address) => address.trim())
        .filter(Boolean)
    : [];
  const serverPort = Number(payload.serverPort);
  const pairingToken =
    typeof payload.pairingToken === 'string'
      ? payload.pairingToken.trim()
      : '';
  const rawExpiresAt = Number(payload.expiresAt);

  if (
    !serverIp ||
    !isIpv4Address(serverIp) ||
    !Number.isInteger(serverPort) ||
    serverPort < 1 ||
    serverPort > 65535 ||
    !pairingToken ||
    !Number.isFinite(rawExpiresAt) ||
    rawExpiresAt <= 0
  ) {
    throw new Error(INVALID_QR_MESSAGE);
  }

  const connectionCandidates = [
    serverIp,
    ...serverIpCandidates,
  ].filter((address, index, addresses) =>
    isIpv4Address(address) && addresses.indexOf(address) === index
  );

  // Accept standard Unix seconds as well as JavaScript millisecond timestamps.
  const expiresAt = rawExpiresAt < 1_000_000_000_000
    ? rawExpiresAt * 1000
    : rawExpiresAt;

  if (expiresAt <= now) {
    throw new Error(EXPIRED_QR_MESSAGE);
  }

  return {
    mode: 'local',
    serverIp,
    serverIpCandidates: connectionCandidates,
    serverPort,
    pairingToken,
    expiresAt,
  };
}
