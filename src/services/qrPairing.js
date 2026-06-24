const INVALID_QR_MESSAGE = 'Invalid pairing QR code.';
const EXPIRED_QR_MESSAGE = 'This pairing QR code has expired.';

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

  const serverIp =
    typeof payload.serverIp === 'string' ? payload.serverIp.trim() : '';
  const serverPort = Number(payload.serverPort);
  const pairingToken =
    typeof payload.pairingToken === 'string'
      ? payload.pairingToken.trim()
      : '';
  const rawExpiresAt = Number(payload.expiresAt);

  if (
    !serverIp ||
    !Number.isInteger(serverPort) ||
    serverPort < 1 ||
    serverPort > 65535 ||
    !pairingToken ||
    !Number.isFinite(rawExpiresAt) ||
    rawExpiresAt <= 0
  ) {
    throw new Error(INVALID_QR_MESSAGE);
  }

  // Accept standard Unix seconds as well as JavaScript millisecond timestamps.
  const expiresAt = rawExpiresAt < 1_000_000_000_000
    ? rawExpiresAt * 1000
    : rawExpiresAt;

  if (expiresAt <= now) {
    throw new Error(EXPIRED_QR_MESSAGE);
  }

  return {
    serverIp,
    serverPort,
    pairingToken,
    expiresAt,
  };
}
