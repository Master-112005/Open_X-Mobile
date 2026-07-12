import * as Crypto from 'expo-crypto';
import forge from 'node-forge/lib/forge';
import 'node-forge/lib/aes';
import 'node-forge/lib/hmac';
import 'node-forge/lib/sha256';

export const E2EE_SCHEME = 'openx-e2ee-v1';
const ENVELOPE_VERSION = 1;
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const DEFAULT_REPLAY_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX_REPLAY_ENTRIES = 2000;

const base64UrlEncode = (bytes) =>
  forge.util.encode64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const base64UrlDecode = (value) => {
  const raw = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return forge.util.decode64(raw.padEnd(Math.ceil(raw.length / 4) * 4, '='));
};

const bytesFromUint8Array = (bytes) => Array.from(bytes).map((byte) => String.fromCharCode(byte)).join('');

const utf8Bytes = (value) => forge.util.encodeUtf8(String(value));

const canonicalJson = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
};

export const generateSecret = () => base64UrlEncode(bytesFromUint8Array(Crypto.getRandomBytes(KEY_BYTES)));

const sha256Bytes = (bytes) => {
  const md = forge.md.sha256.create();
  md.update(bytes, 'raw');
  return md.digest().getBytes();
};

const hmacSha256 = (keyBytes, dataBytes) => {
  const hmac = forge.hmac.create();
  hmac.start('sha256', keyBytes);
  hmac.update(dataBytes);
  return hmac.digest().getBytes();
};

const hkdfSha256 = (inputKey, salt, info, length) => {
  const prk = hmacSha256(salt, inputKey);
  let output = '';
  let previous = '';
  let counter = 1;
  while (output.length < length) {
    previous = hmacSha256(prk, previous + info + String.fromCharCode(counter));
    output += previous;
    counter += 1;
  }
  return output.slice(0, length);
};

const deriveKey = (secret, domain, context = {}) => {
  const input = base64UrlDecode(secret);
  if (input.length !== KEY_BYTES) throw new Error('Invalid E2EE key material length.');
  const salt = sha256Bytes(utf8Bytes(`openx:${E2EE_SCHEME}:${String(domain || 'relay')}:${canonicalJson(context)}`));
  const info = utf8Bytes(`openx:${E2EE_SCHEME}:${String(domain || 'relay')}`);
  return hkdfSha256(input, salt, info, KEY_BYTES);
};

const buildPacketAad = (packet = {}) => ({
  packetId: String(packet.packetId || ''),
  protocolVersion: Number(packet.protocolVersion || 1),
  packetType: String(packet.packetType || ''),
  sourceDeviceId: String(packet.sourceDeviceId || ''),
  destinationDeviceId: String(packet.destinationDeviceId || ''),
  ownerId: String(packet.ownerId || ''),
  timestamp: Number(packet.timestamp || 0),
  requestId: packet.requestId || null,
  responseId: packet.responseId || null,
});

export const encryptJson = (secret, payload, { domain = 'relay-packet', context = {}, aad = {} } = {}) => {
  const key = deriveKey(secret, domain, context);
  const nonce = bytesFromUint8Array(Crypto.getRandomBytes(NONCE_BYTES));
  const aadText = canonicalJson(aad);
  const cipher = forge.cipher.createCipher('AES-GCM', key);
  cipher.start({
    iv: nonce,
    additionalData: utf8Bytes(aadText),
    tagLength: TAG_BYTES * 8,
  });
  cipher.update(forge.util.createBuffer(utf8Bytes(JSON.stringify(payload ?? null)), 'raw'));
  if (!cipher.finish()) throw new Error('E2EE encryption failed.');
  return {
    version: ENVELOPE_VERSION,
    scheme: E2EE_SCHEME,
    alg: 'AES-256-GCM',
    kdf: 'HKDF-SHA256',
    domain,
    nonce: base64UrlEncode(nonce),
    tag: base64UrlEncode(cipher.mode.tag.getBytes()),
    ciphertext: base64UrlEncode(cipher.output.getBytes()),
    aadHash: base64UrlEncode(sha256Bytes(utf8Bytes(aadText))),
  };
};

export const decryptJson = (secret, envelope, { domain = '', context = {}, aad = {} } = {}) => {
  if (!envelope || envelope.scheme !== E2EE_SCHEME || envelope.version !== ENVELOPE_VERSION) {
    throw new Error('Unsupported E2EE envelope.');
  }
  if (domain && envelope.domain !== domain) throw new Error('Unexpected E2EE envelope domain.');
  const aadText = canonicalJson(aad);
  const aadHash = base64UrlEncode(sha256Bytes(utf8Bytes(aadText)));
  if (envelope.aadHash && envelope.aadHash !== aadHash) {
    throw new Error('E2EE authenticated metadata mismatch.');
  }
  const key = deriveKey(secret, envelope.domain, context);
  const decipher = forge.cipher.createDecipher('AES-GCM', key);
  decipher.start({
    iv: base64UrlDecode(envelope.nonce),
    additionalData: utf8Bytes(aadText),
    tagLength: TAG_BYTES * 8,
    tag: forge.util.createBuffer(base64UrlDecode(envelope.tag), 'raw'),
  });
  decipher.update(forge.util.createBuffer(base64UrlDecode(envelope.ciphertext), 'raw'));
  if (!decipher.finish()) throw new Error('E2EE authentication failed.');
  return JSON.parse(forge.util.decodeUtf8(decipher.output.getBytes()));
};

export class SecurePacketChannel {
  constructor({ masterKey = '', now = Date.now } = {}) {
    this.masterKey = '';
    this.now = now;
    this.replayWindowMs = DEFAULT_REPLAY_WINDOW_MS;
    this.maxReplayEntries = DEFAULT_MAX_REPLAY_ENTRIES;
    this.replayCache = new Map();
    if (masterKey) this.setMasterKey(masterKey);
  }

  setMasterKey(masterKey) {
    const key = String(masterKey || '').trim();
    if (!key) {
      this.masterKey = '';
      this.replayCache.clear();
      return false;
    }
    if (base64UrlDecode(key).length !== KEY_BYTES) throw new Error('Invalid E2EE key material length.');
    this.masterKey = key;
    return true;
  }

  hasKey() {
    return Boolean(this.masterKey);
  }

  getStatus() {
    return {
      enabled: this.hasKey(),
      scheme: E2EE_SCHEME,
      replayWindowMs: this.replayWindowMs,
      replayCacheSize: this.replayCache.size,
    };
  }

  encryptPacket(packet) {
    if (!this.hasKey()) return packet;
    const source = JSON.parse(JSON.stringify(packet || {}));
    const aad = buildPacketAad(source);
    const sensitive = {
      payload: source.payload ?? null,
      metadata: source.metadata || {},
      checksum: source.checksum || null,
      encryption: source.encryption || null,
    };
    const envelope = encryptJson(this.masterKey, sensitive, {
      domain: 'relay-packet',
      context: {
        ownerId: source.ownerId,
        sourceDeviceId: source.sourceDeviceId,
        destinationDeviceId: source.destinationDeviceId,
      },
      aad,
    });
    return {
      ...source,
      payload: { type: 'encrypted', scheme: E2EE_SCHEME },
      metadata: {
        encrypted: true,
        retryable: source.metadata?.retryable === true,
      },
      checksum: null,
      encryption: {
        encrypted: true,
        scheme: E2EE_SCHEME,
        envelope,
      },
    };
  }

  decryptPacket(packet) {
    const encrypted = packet?.encryption;
    if (!encrypted?.encrypted) return packet;
    if (!this.hasKey()) throw new Error('Missing E2EE master key.');
    this.rejectReplay(packet, encrypted.envelope);
    const source = JSON.parse(JSON.stringify(packet || {}));
    const aad = buildPacketAad(source);
    const sensitive = decryptJson(this.masterKey, encrypted.envelope, {
      domain: 'relay-packet',
      context: {
        ownerId: source.ownerId,
        sourceDeviceId: source.sourceDeviceId,
        destinationDeviceId: source.destinationDeviceId,
      },
      aad,
    });
    return {
      ...source,
      payload: sensitive?.payload ?? null,
      metadata: sensitive?.metadata || {},
      checksum: sensitive?.checksum || null,
      encryption: sensitive?.encryption || null,
    };
  }

  rejectReplay(packet, envelope) {
    const timestamp = Number(packet?.timestamp || 0);
    const age = Math.abs(this.now() - timestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0 || age > this.replayWindowMs) {
      throw new Error('E2EE packet outside replay window.');
    }
    this.pruneReplayCache();
    const key = `${packet?.sourceDeviceId || ''}:${packet?.packetId || ''}:${String(envelope?.nonce || '')}`;
    if (this.replayCache.has(key)) throw new Error('E2EE packet replay rejected.');
    this.replayCache.set(key, this.now());
  }

  pruneReplayCache() {
    const cutoff = this.now() - this.replayWindowMs;
    for (const [key, seenAt] of this.replayCache) {
      if (seenAt < cutoff || this.replayCache.size > this.maxReplayEntries) this.replayCache.delete(key);
    }
  }
}
