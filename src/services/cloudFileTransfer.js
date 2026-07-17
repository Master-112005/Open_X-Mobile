import * as Crypto from 'expo-crypto';
import forge from 'node-forge/lib/forge';
import {
  MAX_FILE_SIZE,
  createTransferRecord,
  prepareOutgoingFileMetadata,
  readFileChunkBase64,
  storeIncomingFile,
} from './fileTransfer';

const PROTOCOL_VERSION = 1;
const CHUNK_BYTES = 12 * 1024;
const TRANSFER_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_ACTIVE_TRANSFERS = 3;
const MAX_MOBILE_RECEIVE_BYTES = Math.min(MAX_FILE_SIZE, 32 * 1024 * 1024);
const MAX_CHUNK_COUNT = Math.ceil(MAX_FILE_SIZE / CHUNK_BYTES);
const TRANSFER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

const createId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const base64ByteLength = (value) => {
  if (!value) return 0;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
};

const isSafeBase64 = (value) =>
  typeof value === 'string' &&
  value.length % 4 === 0 &&
  /^[a-zA-Z0-9+/]*={0,2}$/.test(value);

const sanitizeIncomingFileName = (value) => {
  const leafName = String(value || '').split(/[\\/]/).pop()?.trim() || 'received-file';
  const sanitized = leafName.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 120);
  return sanitized || 'received-file';
};

async function hashBase64Chunk(base64) {
  const binary = forge.util.decode64(base64 || '');
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0) & 0xff);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

class CloudFileTransferManager {
  constructor({ relayClient, getPairingData, recordTransfer, onIncomingTransfer, onTransferEvent } = {}) {
    this.relayClient = relayClient;
    this.getPairingData = getPairingData || (() => ({}));
    this.recordTransfer = recordTransfer || (() => {});
    this.onIncomingTransfer = onIncomingTransfer || (() => {});
    this.onTransferEvent = onTransferEvent || (() => {});
    this.outgoing = new Map();
    this.incoming = new Map();
    this.unsubscribeRelay = null;
  }

  start() {
    this.stop();
    this.unsubscribeRelay = this.relayClient.subscribeToRelayPackets((message) => this.handleRelayMessage(message));
  }

  stop() {
    if (this.unsubscribeRelay) this.unsubscribeRelay();
    this.unsubscribeRelay = null;
    this.outgoing.forEach((transfer) => {
      clearTimeout(transfer.timeout);
      transfer.reject?.(new Error('Cloud file transfer stopped.'));
      transfer.sourceUri = null;
    });
    this.incoming.forEach((transfer) => clearTimeout(transfer.timeout));
    this.incoming.forEach((transfer) => { transfer.chunks.length = 0; });
    this.outgoing.clear();
    this.incoming.clear();
  }

  async sendFile(file) {
    const pairing = this.getPairingData();
    const cloudPairing = pairing.cloudPairing || {};
    if (!this.relayClient.isConnected() || !cloudPairing.ownerId || !cloudPairing.desktopDeviceId) {
      throw new Error('Cloud is not ready. Connect and pair this phone with OpenX Desktop.');
    }
    const outgoingFile = await prepareOutgoingFileMetadata(file);
    if (this.activeTransferCount() >= MAX_ACTIVE_TRANSFERS) {
      throw new Error('Too many active file transfers. Wait for one to finish first.');
    }
    const transferId = createId('cloud_mobile_transfer');
    const chunkCount = Math.max(1, Math.ceil(outgoingFile.fileSize / CHUNK_BYTES));
    const transfer = {
      transferId,
      fileName: outgoingFile.fileName,
      fileSize: outgoingFile.fileSize,
      sha256: outgoingFile.hash,
      sourceUri: outgoingFile.uri,
      chunkCount,
      nextChunkIndex: 0,
      sourceDeviceId: cloudPairing.phoneDeviceId || pairing.deviceId,
      destinationDeviceId: cloudPairing.desktopDeviceId,
      ownerId: cloudPairing.ownerId,
      direction: 'sent',
      state: 'waiting-approval',
    };
    this.outgoing.set(transferId, transfer);
    transfer.timeout = this.createTimeout(transferId, 'outgoing');
    const metadataSent = this.sendPacket(transfer, 'metadata', {
      transferId,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      mimeType: outgoingFile.mimeType || 'application/octet-stream',
      sha256: transfer.sha256,
      checksum: transfer.sha256,
      chunkBytes: CHUNK_BYTES,
      chunkCount,
      protocolVersion: PROTOCOL_VERSION,
      createdAt: Date.now(),
    });
    if (!metadataSent) {
      this.cleanupOutgoing(transfer, 'relay-send-failed');
      throw new Error('Cloud relay could not send the transfer metadata.');
    }
    this.emitEvent('started', transfer);
    return new Promise((resolve, reject) => {
      transfer.resolve = resolve;
      transfer.reject = reject;
    });
  }

  acceptTransfer(transferId) {
    const transfer = this.incoming.get(transferId);
    if (!transfer) return false;
    transfer.state = 'accepted';
    const accepted = this.sendPacket(transfer, 'accept', {
      transferId,
      nextChunkIndex: transfer.nextChunkIndex,
    });
    if (!accepted) {
      this.cleanupIncoming(transfer, 'relay-send-failed');
      this.emitEvent('failed', transfer, { reason: 'relay-send-failed' });
      return false;
    }
    this.emitEvent('accepted', transfer);
    return true;
  }

  rejectTransfer(transferId, reason = 'rejected-by-phone') {
    const transfer = this.incoming.get(transferId);
    if (!transfer) return false;
    this.sendPacket(transfer, 'reject', { transferId, reason });
    this.cleanupIncoming(transfer, reason);
    this.emitEvent('rejected', transfer);
    return true;
  }

  cancelTransfer(transferId, reason = 'cancelled') {
    const transfer = this.outgoing.get(transferId) || this.incoming.get(transferId);
    if (!transfer) return false;
    this.sendPacket(transfer, 'cancel', { transferId, reason });
    if (this.outgoing.has(transferId)) this.cleanupOutgoing(transfer, reason);
    else this.cleanupIncoming(transfer, reason);
    return true;
  }

  pauseTransfer(transferId) {
    const transfer = this.outgoing.get(transferId) || this.incoming.get(transferId);
    if (!transfer) return false;
    transfer.paused = true;
    transfer.state = 'paused';
    this.sendPacket(transfer, 'pause', { transferId });
    this.emitEvent('paused', transfer);
    return true;
  }

  resumeTransfer(transferId) {
    const transfer = this.outgoing.get(transferId) || this.incoming.get(transferId);
    if (!transfer) return false;
    transfer.paused = false;
    transfer.state = 'resuming';
    this.sendPacket(transfer, 'resume', {
      transferId,
      nextChunkIndex: transfer.nextChunkIndex || 0,
    });
    if (this.outgoing.has(transferId)) this.sendNextChunk(transfer);
    this.emitEvent('resumed', transfer);
    return true;
  }

  handleRelayMessage(message) {
    if (message.type === 'relay:error') return this.handleRelayError(message);
    if (message.type !== 'relay:packet') return;
    const packet = message.packet || {};
    const payload = packet.payload || {};
    if (payload.type !== 'cloud-file-transfer') return;
    const action = payload.action;
    if (action === 'metadata') return this.handleMetadata(packet, payload);
    if (action === 'accept') return this.handleAccept(payload);
    if (action === 'reject') return this.handleReject(payload);
    if (action === 'chunk') {
      this.handleChunk(packet, payload).catch((error) => {
        const transferId = String(payload.transferId || '');
        const transfer = this.incoming.get(transferId);
        if (transfer) {
          this.cancelTransfer(transferId, 'chunk-processing-failed');
          this.emitEvent('failed', transfer, { reason: 'chunk-processing-failed', error: error.message });
        }
      });
      return;
    }
    if (action === 'chunk-ack') return this.handleChunkAck(payload);
    if (action === 'complete') {
      this.handleComplete(payload).catch((error) => {
        const transferId = String(payload.transferId || '');
        const transfer = this.incoming.get(transferId);
        if (transfer) {
          this.cancelTransfer(transferId, 'completion-failed');
          this.emitEvent('failed', transfer, { reason: 'completion-failed', error: error.message });
        }
      });
      return;
    }
    if (action === 'complete-ack') return this.handleCompleteAck(payload);
    if (action === 'cancel') return this.handleCancel(payload);
    if (action === 'pause') return this.handlePause(payload);
    if (action === 'resume') return this.handleResume(payload);
  }

  handleRelayError(message) {
    const requestId = String(message?.requestId || '').trim();
    const transferId = requestId.split(':')[0] || '';
    if (!transferId) return false;
    const transfer = this.outgoing.get(transferId) || this.incoming.get(transferId);
    if (!transfer) return false;
    const reason = String(message?.code || 'relay-error');
    if (this.outgoing.has(transferId)) this.cleanupOutgoing(transfer, reason);
    else this.cleanupIncoming(transfer, reason);
    this.emitEvent('failed', transfer, {
      reason,
      error: message?.message || 'Cloud relay could not route the file transfer.',
    });
    return true;
  }

  handleMetadata(packet, payload) {
    const transferId = String(payload.transferId || '').trim();
    const fileSize = Number(payload.fileSize);
    const chunkCount = Number(payload.chunkCount) || 0;
    const sha256 = String(payload.sha256 || payload.checksum || '').toLowerCase();
    const transfer = {
      transferId,
      fileName: sanitizeIncomingFileName(payload.fileName || 'received-file'),
      fileSize,
      sha256,
      chunkCount,
      chunks: [],
      receivedBytes: 0,
      nextChunkIndex: 0,
      sourceDeviceId: packet.sourceDeviceId,
      destinationDeviceId: packet.destinationDeviceId,
      ownerId: packet.ownerId,
      direction: 'received',
      state: 'waiting-approval',
    };
    const metadataInvalid =
      !TRANSFER_ID_PATTERN.test(transfer.transferId) ||
      !Number.isSafeInteger(transfer.fileSize) ||
      transfer.fileSize < 0 ||
      transfer.fileSize > MAX_MOBILE_RECEIVE_BYTES ||
      !HASH_PATTERN.test(transfer.sha256) ||
      !Number.isSafeInteger(transfer.chunkCount) ||
      transfer.chunkCount < 1 ||
      transfer.chunkCount > MAX_CHUNK_COUNT ||
      transfer.chunkCount !== Math.max(1, Math.ceil(transfer.fileSize / CHUNK_BYTES));
    if (
      metadataInvalid ||
      this.incoming.has(transfer.transferId) ||
      this.activeTransferCount() >= MAX_ACTIVE_TRANSFERS
    ) {
      this.sendPacket(transfer, 'error', {
        transferId: transfer.transferId,
        code: 'invalid-metadata',
        message: transfer.fileSize > MAX_MOBILE_RECEIVE_BYTES
          ? 'File is too large for mobile receive buffering.'
          : 'Invalid transfer metadata.',
      });
      return;
    }
    transfer.timeout = this.createTimeout(transfer.transferId, 'incoming');
    this.incoming.set(transfer.transferId, transfer);
    this.onIncomingTransfer(this.publicTransfer(transfer));
  }

  handleAccept(payload) {
    const transfer = this.outgoing.get(payload.transferId);
    if (!transfer) return;
    transfer.state = 'uploading';
    transfer.nextChunkIndex = Number(payload.nextChunkIndex) || 0;
    this.sendNextChunk(transfer);
  }

  handleReject(payload) {
    const transfer = this.outgoing.get(payload.transferId);
    if (!transfer) return;
    transfer.reject?.(new Error(payload.reason || 'Transfer rejected.'));
    this.cleanupOutgoing(transfer, 'rejected');
  }

  async handleChunk(packet, payload) {
    const transfer = this.incoming.get(payload.transferId);
    if (!transfer || transfer.state === 'waiting-approval' || transfer.paused) return;
    const index = Number(payload.chunkIndex);
    if (index !== transfer.nextChunkIndex) {
      this.cancelTransfer(transfer.transferId, 'chunk-missing');
      return;
    }
    const chunk = String(payload.data || '');
    if (!isSafeBase64(chunk)) {
      this.cancelTransfer(transfer.transferId, 'invalid-chunk');
      return;
    }
    const chunkBytes = base64ByteLength(chunk);
    const declaredChunkSize = Number(payload.chunkSize);
    if (
      chunkBytes > CHUNK_BYTES ||
      (Number.isFinite(declaredChunkSize) && declaredChunkSize !== chunkBytes) ||
      transfer.receivedBytes + chunkBytes > transfer.fileSize ||
      this.totalIncomingBufferedBytes() + chunkBytes > MAX_MOBILE_RECEIVE_BYTES
    ) {
      this.cancelTransfer(transfer.transferId, 'receive-buffer-limit');
      return;
    }
    const checksum = String(payload.sha256 || payload.checksum || '').toLowerCase();
    if (!HASH_PATTERN.test(checksum)) {
      this.cancelTransfer(transfer.transferId, 'checksum-failure');
      return;
    }
    const actual = await hashBase64Chunk(chunk);
    if (checksum && actual !== checksum) {
      this.cancelTransfer(transfer.transferId, 'checksum-failure');
      return;
    }
    transfer.chunks[index] = chunk;
    transfer.receivedBytes += chunkBytes;
    transfer.nextChunkIndex += 1;
    transfer.state = 'downloading';
    this.refreshTimeout(transfer, 'incoming');
    const ackSent = this.sendPacket(transfer, 'chunk-ack', {
      transferId: transfer.transferId,
      chunkIndex: index,
      receivedBytes: this.receivedBytes(transfer),
      nextChunkIndex: transfer.nextChunkIndex,
    });
    if (!ackSent) {
      this.cleanupIncoming(transfer, 'relay-send-failed');
      this.emitEvent('failed', transfer, { reason: 'relay-send-failed' });
      return;
    }
    this.emitEvent('progress', transfer);
  }

  handleChunkAck(payload) {
    const transfer = this.outgoing.get(payload.transferId);
    if (!transfer || transfer.paused) return;
    transfer.nextChunkIndex = Math.max(transfer.nextChunkIndex, Number(payload.nextChunkIndex) || transfer.nextChunkIndex);
    this.emitEvent('progress', transfer);
    this.sendNextChunk(transfer);
  }

  async handleComplete(payload) {
    const transfer = this.incoming.get(payload.transferId);
    if (!transfer) return;
    const data = transfer.chunks.join('');
    if (transfer.nextChunkIndex !== transfer.chunkCount || base64ByteLength(data) !== transfer.fileSize) {
      this.cancelTransfer(transfer.transferId, 'incomplete-transfer');
      return;
    }
    try {
      const record = await storeIncomingFile({
        fileName: transfer.fileName,
        fileSize: transfer.fileSize,
        data,
        hash: transfer.sha256,
      });
      this.recordTransfer(record);
      this.sendPacket(transfer, 'complete-ack', {
        transferId: transfer.transferId,
        status: 'completed',
      });
      transfer.state = 'completed';
      this.emitEvent('completed', transfer, { record });
      this.cleanupIncoming(transfer, 'completed');
    } catch (error) {
      this.cancelTransfer(transfer.transferId, 'integrity-failure');
    }
  }

  handleCompleteAck(payload) {
    const transfer = this.outgoing.get(payload.transferId);
    if (!transfer) return;
    const record = createTransferRecord({
      direction: 'sent',
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      status: 'sent',
      hash: transfer.sha256,
    });
    this.recordTransfer(record);
    transfer.resolve?.(record);
    transfer.state = 'completed';
    this.emitEvent('completed', transfer, { record });
    this.cleanupOutgoing(transfer, 'completed');
  }

  handleCancel(payload) {
    const transfer = this.outgoing.get(payload.transferId) || this.incoming.get(payload.transferId);
    if (!transfer) return;
    if (this.outgoing.has(payload.transferId)) this.cleanupOutgoing(transfer, 'cancelled');
    else this.cleanupIncoming(transfer, 'cancelled');
    this.emitEvent('cancelled', transfer);
  }

  handlePause(payload) {
    const transfer = this.outgoing.get(payload.transferId) || this.incoming.get(payload.transferId);
    if (!transfer) return;
    transfer.paused = true;
    transfer.state = 'paused';
    this.emitEvent('paused', transfer);
  }

  handleResume(payload) {
    const transfer = this.outgoing.get(payload.transferId) || this.incoming.get(payload.transferId);
    if (!transfer) return;
    transfer.paused = false;
    transfer.state = 'resuming';
    if (this.outgoing.has(payload.transferId)) {
      transfer.nextChunkIndex = Number(payload.nextChunkIndex) || transfer.nextChunkIndex;
      this.sendNextChunk(transfer);
    }
    this.emitEvent('resumed', transfer);
  }

  async sendNextChunk(transfer) {
    if (!transfer || transfer.paused) return;
    if (transfer.nextChunkIndex >= transfer.chunkCount) {
      const completeSent = this.sendPacket(transfer, 'complete', {
        transferId: transfer.transferId,
        fileSize: transfer.fileSize,
        sha256: transfer.sha256,
      });
      if (!completeSent) {
        this.cancelTransfer(transfer.transferId, 'relay-send-failed');
        return;
      }
      transfer.state = 'waiting-complete-ack';
      this.refreshTimeout(transfer, 'outgoing');
      this.emitEvent('progress', transfer);
      return;
    }
    try {
      const index = transfer.nextChunkIndex;
      const start = index * CHUNK_BYTES;
      const bytesToRead = Math.min(CHUNK_BYTES, Math.max(0, transfer.fileSize - start));
      const chunk = await readFileChunkBase64(transfer.sourceUri, start, bytesToRead);
      if (!isSafeBase64(chunk)) {
        throw new Error('Invalid chunk encoding.');
      }
      const checksum = await hashBase64Chunk(chunk);
      const chunkSent = this.sendPacket(transfer, 'chunk', {
        transferId: transfer.transferId,
        chunkIndex: index,
        sequenceNumber: index,
        chunkSize: base64ByteLength(chunk),
        totalChunks: transfer.chunkCount,
        data: chunk,
        sha256: checksum,
        checksum,
        state: 'uploading',
      });
      if (!chunkSent) {
        this.cancelTransfer(transfer.transferId, 'relay-send-failed');
        return;
      }
      this.refreshTimeout(transfer, 'outgoing');
    } catch (error) {
      this.cancelTransfer(transfer.transferId, 'chunk-read-failed');
      this.emitEvent('failed', transfer, {
        reason: 'chunk-read-failed',
        error: error.message,
      });
    }
  }

  sendPacket(transfer, action, payload) {
    const localDeviceId = this.getPairingData().cloudPairing?.phoneDeviceId || this.getPairingData().deviceId;
    const sourceDeviceId = transfer.destinationDeviceId === localDeviceId
      ? transfer.destinationDeviceId
      : transfer.sourceDeviceId;
    const destinationDeviceId = transfer.destinationDeviceId === localDeviceId
      ? transfer.sourceDeviceId
      : transfer.destinationDeviceId;
    return this.relayClient.sendRelayPacket({
      packetId: createId('cloud_file_packet'),
      protocolVersion: PROTOCOL_VERSION,
      packetType: action === 'error' ? 'error' : 'request',
      sourceDeviceId,
      destinationDeviceId,
      ownerId: transfer.ownerId,
      timestamp: Date.now(),
      requestId: `${transfer.transferId}:${action}:${payload.chunkIndex ?? payload.nextChunkIndex ?? 'control'}:${createId('request')}`,
      responseId: null,
      metadata: { feature: 'cloud-file-transfer', action },
      checksum: null,
      encryption: null,
      payload: {
        type: 'cloud-file-transfer',
        action,
        ...payload,
      },
    });
  }

  createTimeout(transferId, direction) {
    return setTimeout(() => {
      const transfer = direction === 'incoming' ? this.incoming.get(transferId) : this.outgoing.get(transferId);
      if (!transfer) return;
      this.cancelTransfer(transferId, 'timed-out');
      this.emitEvent('failed', transfer, { reason: 'timed-out' });
    }, TRANSFER_TIMEOUT_MS);
  }

  refreshTimeout(transfer, direction) {
    clearTimeout(transfer.timeout);
    transfer.timeout = this.createTimeout(transfer.transferId, direction);
  }

  cleanupIncoming(transfer) {
    clearTimeout(transfer.timeout);
    if (transfer.chunks) transfer.chunks.length = 0;
    this.incoming.delete(transfer.transferId);
  }

  cleanupOutgoing(transfer, reason) {
    clearTimeout(transfer.timeout);
    transfer.sourceUri = null;
    this.outgoing.delete(transfer.transferId);
    if (!['completed', 'rejected'].includes(reason)) transfer.reject?.(new Error(reason || 'Transfer failed.'));
  }

  receivedBytes(transfer) {
    return transfer.receivedBytes || 0;
  }

  activeTransferCount() {
    return this.outgoing.size + this.incoming.size;
  }

  totalIncomingBufferedBytes() {
    let total = 0;
    this.incoming.forEach((transfer) => {
      total += Number(transfer.receivedBytes) || 0;
    });
    return total;
  }

  publicTransfer(transfer) {
    const transferredBytes = transfer.direction === 'received'
      ? this.receivedBytes(transfer)
      : Math.min((transfer.nextChunkIndex || 0) * CHUNK_BYTES, transfer.fileSize);
    return {
      transferId: transfer.transferId,
      direction: transfer.direction,
      state: transfer.state,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      transferredBytes,
      percent: transfer.fileSize > 0 ? Math.min(100, Math.round((transferredBytes / transfer.fileSize) * 100)) : 100,
      currentChunk: transfer.nextChunkIndex || 0,
      totalChunks: transfer.chunkCount || 1,
    };
  }

  emitEvent(type, transfer, extra = {}) {
    this.onTransferEvent({
      type,
      ...this.publicTransfer(transfer),
      ...extra,
    });
  }
}

export { CloudFileTransferManager };
