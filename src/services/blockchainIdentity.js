import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { ethers } from 'ethers';

const IDENTITY_KEY = '@openx/blockchain/identity';
const TRUST_CACHE_KEY = '@openx/blockchain/trustCache';
const WALLET_KEY = 'openx.blockchain.walletPrivateKey';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DEVICE_ID_RANDOM_CHARS = 16;
const IDENTITY_VERSION = 'openx-identity-v1';

export const IDENTITY_STATUS = Object.freeze({
  REGISTERING: 'REGISTERING',
  REGISTERED: 'REGISTERED',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
  REVOKED: 'REVOKED',
  UNKNOWN: 'UNKNOWN',
});

export const PAIR_STATUS = Object.freeze({
  PENDING: 'PENDING',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  FAILED: 'FAILED',
});

export const TRUST_STATUS = Object.freeze({
  TRUSTED: 'TRUSTED',
  PENDING: 'PENDING',
  BLOCKED: 'BLOCKED',
  REVOKED: 'REVOKED',
  UNKNOWN: 'UNKNOWN',
  EXPIRED: 'EXPIRED',
});

const IDENTITY_EVENTS = Object.freeze({
  IDENTITY_CREATED: 'blockchain.identity.created',
  IDENTITY_REGISTERED: 'blockchain.identity.registered',
  IDENTITY_VERIFIED: 'blockchain.identity.verified',
  IDENTITY_FAILED: 'blockchain.identity.failed',
  IDENTITY_REFRESHED: 'blockchain.identity.refreshed',
});

const IDENTITY_REGISTRY_ABI = Object.freeze([
  'function registerDevice(string deviceId,string deviceType,string identityVersion) returns (bool)',
  'function verifyDevice(string deviceId,address walletAddress) view returns (bool)',
  'function getDevice(string deviceId) view returns (string deviceId,address walletAddress,uint256 registeredAt,string deviceType,uint8 status,string blockchainVersion,string identityVersion,uint256 revokedAt)',
  'function deviceExists(string deviceId) view returns (bool)',
]);

const PAIR_REGISTRY_ABI = Object.freeze([
  'function approvePair(bytes32 pairHash,string phoneDeviceId,address phoneWallet) returns (bool)',
  'function pairExists(bytes32 pairHash) view returns (bool)',
  'function getPair(bytes32 pairHash) view returns (bytes32 pairHash,string desktopDeviceId,string phoneDeviceId,address desktopWallet,address phoneWallet,uint8 status,uint256 createdAt,uint256 approvedAt,uint256 expiresAt,string version)',
]);

const env = () => globalThis?.process?.env || {};

export const defaultBlockchainIdentityConfig = () => ({
  enabled: env().EXPO_PUBLIC_OPENX_BLOCKCHAIN_ENABLED === 'true',
  network: env().EXPO_PUBLIC_OPENX_BLOCKCHAIN_NETWORK || 'fuji',
  rpcUrl: env().EXPO_PUBLIC_OPENX_BLOCKCHAIN_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
  chainId: Number(env().EXPO_PUBLIC_OPENX_BLOCKCHAIN_CHAIN_ID) || 43113,
  registryAddress: String(env().EXPO_PUBLIC_OPENX_IDENTITY_REGISTRY_ADDRESS || '').trim(),
  deviceType: 'phone',
  verifyOnStartup: env().EXPO_PUBLIC_OPENX_BLOCKCHAIN_IDENTITY_VERIFY_ON_STARTUP !== 'false',
  autoRegister: env().EXPO_PUBLIC_OPENX_BLOCKCHAIN_IDENTITY_AUTO_REGISTER !== 'false',
  trustCacheTtlMs: Number(env().EXPO_PUBLIC_OPENX_BLOCKCHAIN_TRUST_CACHE_TTL_MS) || 24 * 60 * 60 * 1000,
  trustStrict: env().EXPO_PUBLIC_OPENX_BLOCKCHAIN_TRUST_STRICT === 'true',
});

const normalizeIdentity = (value = {}) => ({
  deviceId: String(value.deviceId || '').trim(),
  walletAddress: String(value.walletAddress || '').trim(),
  deviceType: String(value.deviceType || 'phone').trim().toLowerCase(),
  registeredAt: value.registeredAt || null,
  status: Object.values(IDENTITY_STATUS).includes(String(value.status || '').toUpperCase())
    ? String(value.status).toUpperCase()
    : IDENTITY_STATUS.UNKNOWN,
  network: String(value.network || '').trim(),
  version: String(value.version || IDENTITY_VERSION).trim(),
  transactionHash: String(value.transactionHash || '').trim(),
  blockNumber: Number.isFinite(Number(value.blockNumber)) ? Number(value.blockNumber) : null,
  lastVerified: value.lastVerified || null,
});

const bytesToHex = (bytes) =>
  Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');

const randomCrockford = (length) => {
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes).map((byte) => CROCKFORD[byte % CROCKFORD.length]).join('');
};

export const generateDeviceId = (deviceType = 'phone') =>
  `OPENX-${String(deviceType || 'phone').toUpperCase()}-${randomCrockford(DEVICE_ID_RANDOM_CHARS)}`;

export const createPairHash = async ({ pairToken, desktopDeviceId, desktopWallet, createdAt, nonce }) => {
  const payload = [
    String(pairToken || ''),
    String(desktopDeviceId || ''),
    String(desktopWallet || '').toLowerCase(),
    String(Number(createdAt || 0)),
    String(nonce || ''),
  ].join('|');
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
  return `0x${digest}`;
};

class MobileWalletManager {
  wallet = null;

  async loadPrivateKey() {
    return SecureStore.getItemAsync(WALLET_KEY);
  }

  async savePrivateKey(privateKey) {
    await SecureStore.setItemAsync(WALLET_KEY, String(privateKey || ''), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    return true;
  }

  async ensureWallet(provider = null) {
    const privateKey = await this.loadPrivateKey();
    if (privateKey) return this.loadWallet(privateKey, provider);
    return this.generateWallet(provider);
  }

  async loadWallet(privateKey, provider = null) {
    this.wallet = new ethers.Wallet(String(privateKey || '').trim(), provider);
    return {
      loaded: true,
      address: await this.wallet.getAddress(),
      secureStorage: 'expo-secure-store',
    };
  }

  async generateWallet(provider = null) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const wallet = new ethers.Wallet(`0x${bytesToHex(Crypto.getRandomBytes(32))}`, provider);
        await this.savePrivateKey(wallet.privateKey);
        this.wallet = wallet;
        return {
          loaded: true,
          address: await wallet.getAddress(),
          secureStorage: 'expo-secure-store',
        };
      } catch {
        // Retry invalid secp256k1 candidate values.
      }
    }
    throw new Error('Unable to generate mobile blockchain wallet.');
  }

  getSigner() {
    if (!this.wallet) throw new Error('Mobile blockchain wallet is not loaded.');
    return this.wallet;
  }
}

class MobileIdentityManager {
  constructor({ config, walletManager, emit }) {
    this.config = config;
    this.walletManager = walletManager;
    this.emit = emit;
    this.identity = null;
  }

  async loadIdentity() {
    const raw = await AsyncStorage.getItem(IDENTITY_KEY);
    this.identity = raw ? normalizeIdentity(JSON.parse(raw)) : null;
    return this.identity;
  }

  async saveIdentity(identity) {
    this.identity = normalizeIdentity(identity);
    await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(this.identity));
    return this.identity;
  }

  async generateIdentity(provider = null) {
    const wallet = await this.walletManager.ensureWallet(provider);
    const identity = await this.saveIdentity({
      deviceId: generateDeviceId(this.config.deviceType),
      walletAddress: wallet.address,
      deviceType: this.config.deviceType,
      status: IDENTITY_STATUS.PENDING,
      network: this.config.network,
      version: IDENTITY_VERSION,
    });
    this.emit(IDENTITY_EVENTS.IDENTITY_CREATED, identity);
    return identity;
  }

  async initialize(provider = null) {
    const identity = await this.loadIdentity();
    if (identity?.deviceId && identity?.walletAddress) {
      await this.walletManager.ensureWallet(provider);
      return identity;
    }
    return this.generateIdentity(provider);
  }

  createContract(signerOrProvider) {
    if (!this.config.registryAddress) return null;
    return new ethers.Contract(this.config.registryAddress, IDENTITY_REGISTRY_ABI, signerOrProvider);
  }

  async registerIdentity() {
    const identity = this.identity || await this.initialize();
    const contract = this.createContract(this.walletManager.getSigner());
    if (!contract) return this.saveIdentity({ ...identity, status: IDENTITY_STATUS.PENDING });
    const registering = await this.saveIdentity({ ...identity, status: IDENTITY_STATUS.REGISTERING });
    try {
      const tx = await contract.registerDevice(registering.deviceId, registering.deviceType, registering.version);
      const receipt = await tx.wait();
      const registered = await this.saveIdentity({
        ...registering,
        status: IDENTITY_STATUS.REGISTERED,
        registeredAt: new Date().toISOString(),
        transactionHash: receipt?.hash || tx?.hash || '',
        blockNumber: Number(receipt?.blockNumber) || null,
        lastVerified: new Date().toISOString(),
      });
      this.emit(IDENTITY_EVENTS.IDENTITY_REGISTERED, registered);
      return registered;
    } catch (error) {
      const failed = await this.saveIdentity({ ...registering, status: IDENTITY_STATUS.FAILED });
      this.emit(IDENTITY_EVENTS.IDENTITY_FAILED, { message: error.message, identity: failed });
      throw error;
    }
  }

  async verifyIdentity(provider) {
    const identity = this.identity || await this.initialize(provider);
    const contract = this.createContract(provider);
    if (!contract) return { valid: false, reason: 'registry-not-configured', identity };
    const valid = await contract.verifyDevice(identity.deviceId, identity.walletAddress);
    const updated = await this.saveIdentity({
      ...identity,
      status: valid ? IDENTITY_STATUS.REGISTERED : IDENTITY_STATUS.FAILED,
      lastVerified: new Date().toISOString(),
    });
    const result = { valid: Boolean(valid), identity: updated };
    this.emit(IDENTITY_EVENTS.IDENTITY_VERIFIED, result);
    return result;
  }

  async identityExists(provider) {
    const identity = this.identity || await this.initialize(provider);
    const contract = this.createContract(provider);
    if (!contract) return false;
    return Boolean(await contract.deviceExists(identity.deviceId));
  }

  getIdentity() {
    return this.identity;
  }
}

class MobileBlockchainService {
  constructor(config = defaultBlockchainIdentityConfig()) {
    this.config = { ...defaultBlockchainIdentityConfig(), ...config };
    this.walletManager = new MobileWalletManager();
    this.listeners = new Set();
    this.provider = null;
    this.trustCache = new Map();
    this.identityManager = new MobileIdentityManager({
      config: this.config,
      walletManager: this.walletManager,
      emit: (event, payload) => this.emit(event, payload),
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event, payload) {
    const update = { event, payload, timestamp: new Date().toISOString() };
    this.listeners.forEach((listener) => {
      try {
        listener(update);
      } catch {}
    });
  }

  getProvider() {
    if (!this.config.enabled) return null;
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl, {
        name: this.config.network,
        chainId: this.config.chainId,
      });
    }
    return this.provider;
  }

  async initialize() {
    await this.loadTrust();
    const provider = this.getProvider();
    const identity = await this.identityManager.initialize(provider);
    if (this.config.enabled && this.config.autoRegister) {
      await this.identityManager.registerIdentity().catch((error) => {
        this.emit(IDENTITY_EVENTS.IDENTITY_FAILED, { message: error.message });
      });
    }
    if (this.config.enabled && this.config.verifyOnStartup) {
      await this.identityManager.verifyIdentity(provider).catch((error) => {
        this.emit(IDENTITY_EVENTS.IDENTITY_FAILED, { message: error.message });
      });
    }
    return this.getStatus(identity);
  }

  registerIdentity() {
    return this.identityManager.registerIdentity();
  }

  verifyIdentity() {
    return this.identityManager.verifyIdentity(this.getProvider());
  }

  loadIdentity() {
    return this.identityManager.loadIdentity();
  }

  identityExists() {
    return this.identityManager.identityExists(this.getProvider());
  }

  getIdentity() {
    return this.identityManager.getIdentity();
  }

  refreshIdentity() {
    return this.verifyIdentity();
  }

  async approvePair(payload = {}) {
    const pairToken = String(payload.pairToken || payload.t || '').trim();
    const pairHash = String(payload.pairHash || payload.ph || '').trim();
    const desktopDeviceId = String(payload.desktopDeviceId || payload.dd || '').trim();
    const desktopWallet = String(payload.desktopWallet || payload.dw || '').trim();
    const nonce = String(payload.nonce || payload.n || '').trim();
    const createdAt = Number(payload.createdAt || payload.ca || 0);
    const expiresAt = Number(payload.expiresAt || payload.e || 0);
    const network = String(payload.network || payload.bn || '').trim();
    const registryAddress = String(payload.pairRegistryAddress || payload.pr || this.config.pairRegistryAddress || '').trim();
    if (expiresAt && expiresAt <= Date.now()) throw new Error('This pairing QR code has expired.');
    if (network && network !== this.config.network) throw new Error('Pairing QR is for a different blockchain network.');
    const computed = await createPairHash({ pairToken, desktopDeviceId, desktopWallet, createdAt, nonce });
    if (computed !== pairHash) throw new Error('Pairing QR trust hash did not match.');
    const identity = this.identityManager.getIdentity() || await this.identityManager.initialize(this.getProvider());
    const approved = {
      pairId: String(payload.pairId || payload.pid || pairHash.replace(/^0x/, '').slice(0, 16)),
      pairHash,
      desktopDeviceId,
      phoneDeviceId: identity.deviceId,
      desktopWallet,
      phoneWallet: identity.walletAddress,
      status: PAIR_STATUS.APPROVED,
      createdAt: createdAt ? new Date(createdAt).toISOString() : null,
      approvedAt: new Date().toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      transactionHash: '',
      blockNumber: null,
      version: String(payload.pairVersion || payload.pv || 'openx-pair-v1'),
      network: this.config.network,
    };
    if (!this.config.enabled || !registryAddress) return approved;
    const provider = this.getProvider();
    const signer = this.walletManager.getSigner().connect(provider);
    const contract = new ethers.Contract(registryAddress, PAIR_REGISTRY_ABI, signer);
    const exists = await contract.pairExists(pairHash);
    if (!exists) throw new Error('Pair request was not found on blockchain.');
    const tx = await contract.approvePair(pairHash, identity.deviceId, identity.walletAddress);
    const receipt = await tx.wait();
    return {
      ...approved,
      transactionHash: receipt?.hash || tx?.hash || '',
      blockNumber: Number(receipt?.blockNumber) || null,
    };
  }

  getStatus(identity = this.identityManager.getIdentity()) {
    return {
      enabled: this.config.enabled,
      network: this.config.network,
      chainId: this.config.chainId,
      registryConfigured: Boolean(this.config.registryAddress),
      trustCacheSize: this.trustCache.size,
      identity,
    };
  }

  async loadTrust() {
    const raw = await AsyncStorage.getItem(TRUST_CACHE_KEY);
    const items = raw ? JSON.parse(raw) : [];
    this.trustCache.clear();
    if (Array.isArray(items)) {
      items.forEach((item) => {
        const deviceId = String(item?.deviceId || '').trim();
        if (deviceId) this.trustCache.set(deviceId, normalizeTrust(item, this.config));
      });
    }
    return this.listTrust();
  }

  async cacheTrust(record = {}) {
    const trust = normalizeTrust(record, this.config);
    if (!trust.deviceId) throw new Error('Trust record requires a device ID.');
    this.trustCache.set(trust.deviceId, trust);
    await AsyncStorage.setItem(TRUST_CACHE_KEY, JSON.stringify(this.listTrust()));
    return trust;
  }

  checkTrust(input = {}) {
    const deviceId = String(input.deviceId || input.sourceDeviceId || input.destinationDeviceId || '').trim();
    const record = this.trustCache.get(deviceId);
    if (!record) {
      return this.config.trustStrict
        ? { allowed: false, decision: 'PENDING', trustStatus: TRUST_STATUS.UNKNOWN, reason: 'unknown-device' }
        : { allowed: true, decision: 'ALLOW', trustStatus: TRUST_STATUS.UNKNOWN, reason: 'unknown-allowed' };
    }
    if ([TRUST_STATUS.BLOCKED, TRUST_STATUS.REVOKED].includes(record.trustStatus)) {
      return { allowed: false, decision: 'BLOCKED', trustStatus: record.trustStatus, reason: 'blocked-or-revoked', trust: record };
    }
    if (Date.parse(record.expiresAt || '') <= Date.now()) {
      return { allowed: false, decision: 'PENDING', trustStatus: TRUST_STATUS.EXPIRED, reason: 'trust-expired', trust: record };
    }
    if (record.trustStatus === TRUST_STATUS.TRUSTED) {
      return { allowed: true, decision: 'ALLOW', trustStatus: TRUST_STATUS.TRUSTED, reason: 'trusted-cache', trust: record };
    }
    return { allowed: false, decision: 'PENDING', trustStatus: record.trustStatus, reason: 'not-trusted', trust: record };
  }

  listTrust() {
    return Array.from(this.trustCache.values());
  }
}

export const blockchainIdentityService = new MobileBlockchainService();
export { IDENTITY_EVENTS };

const normalizeTrust = (record = {}, config = defaultBlockchainIdentityConfig()) => ({
  deviceId: String(record.deviceId || '').trim(),
  walletAddress: String(record.walletAddress || '').trim(),
  trustStatus: Object.values(TRUST_STATUS).includes(String(record.trustStatus || '').toUpperCase())
    ? String(record.trustStatus).toUpperCase()
    : TRUST_STATUS.UNKNOWN,
  lastVerified: record.lastVerified || new Date().toISOString(),
  expiresAt: record.expiresAt || new Date(Date.now() + Number(config.trustCacheTtlMs || 86400000)).toISOString(),
  version: String(record.version || 'openx-trust-v1'),
  network: String(record.network || config.network || ''),
  transactionHash: String(record.transactionHash || ''),
  blockNumber: Number.isFinite(Number(record.blockNumber)) ? Number(record.blockNumber) : null,
  source: String(record.source || 'cache'),
});
