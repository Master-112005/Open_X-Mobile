const INVALID_QR_MESSAGE = 'Invalid pairing QR code.';
const EXPIRED_QR_MESSAGE = 'This pairing QR code has expired.';

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
    serverIp,
    serverIpCandidates: connectionCandidates,
    serverPort,
    pairingToken,
    expiresAt,
  };
}
