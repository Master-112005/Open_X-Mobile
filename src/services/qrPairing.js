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
  const e2eePairingSecret = typeof (payload.e2eePairingSecret || payload.s) === 'string'
    ? (payload.e2eePairingSecret || payload.s).trim()
    : '';
  const e2eeRequired = payload.securityRequired === true || payload.sr === true;
  const blockchain = payload.blockchain && typeof payload.blockchain === 'object'
    ? payload.blockchain
    : payload.b && typeof payload.b === 'object'
      ? payload.b
      : null;

  if (relayUrl || cloudPairToken || cloudVersion) {
    if (
      cloudVersion !== CLOUD_PAIR_VERSION ||
      !/^wss?:\/\/[^\s/$.?#].[^\s]*$/i.test(relayUrl) ||
      !cloudPairToken ||
      (e2eePairingSecret && e2eePairingSecret.length < 32) ||
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
      blockchain: blockchain
        ? {
            pairVersion: String(blockchain.pv || blockchain.pairVersion || ''),
            pairId: String(blockchain.pid || blockchain.pairId || ''),
            pairHash: String(blockchain.ph || blockchain.pairHash || ''),
            desktopDeviceId: String(blockchain.dd || blockchain.desktopDeviceId || ''),
            desktopWallet: String(blockchain.dw || blockchain.desktopWallet || ''),
            nonce: String(blockchain.n || blockchain.nonce || ''),
            createdAt: Number(blockchain.ca || blockchain.createdAt || 0),
            expiresAt: Number(blockchain.e || blockchain.expiresAt || expiresAt),
            network: String(blockchain.bn || blockchain.network || ''),
            chainId: Number(blockchain.cid || blockchain.chainId || 0),
            pairRegistryAddress: String(blockchain.pr || blockchain.pairRegistryAddress || ''),
            pairToken: cloudPairToken,
          }
        : null,
      security: e2eePairingSecret
        ? {
            scheme: 'openx-e2ee-v1',
            pairingSecret: e2eePairingSecret,
            required: e2eeRequired,
          }
        : null,
    };
  }

  throw new Error(LOCAL_PAIRING_REMOVED_MESSAGE);
}
