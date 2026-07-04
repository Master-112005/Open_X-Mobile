import * as Crypto from 'expo-crypto';
import {
  createTransferRecord,
  prepareOutgoingFile,
  storeIncomingFile,
} from './fileTransfer';

const PROTOCOL_VERSION = 1;
const CHUNK_BASE64_LENGTH = 16000;
const TRANSFER_TIMEOUT_MS = 10 * 60 * 1000;

const createId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const splitBase64 = (value, size = CHUNK_BASE64_LENGTH) => {
  const chunks = [];
  for (let offset = 0; offset < value.length; offset += size) {
    chunks.push(value.slice(offset, offset + size));
  }
  return chunks.length ? chunks : [''];
};

const base64ByteLength = (value) => {
  if (!value) return 0;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
};

async function hashBase64Chunk(base64) {
  const bytes = Uint8Array.from(atob(base64 || ''), (character) => character.charCodeAt(0));
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
    this.outgoing.forEach((transfer) => clearTimeout(transfer.timeout));
    this.incoming.forEach((transfer) => clearTimeout(transfer.timeout));
    this.outgoing.clear();
    this.incoming.clear();
  }

  async sendFile(file) {
    const pairing = this.getPairingData();
    const cloudPairing = pairing.cloudPairing || {};
    if (!this.relayClient.isConnected() || !cloudPairing.ownerId || !cloudPairing.desktopDeviceId) {
      throw new Error('Cloud is not ready. Connect and pair this phone with OpenX Desktop.');
    }
    const outgoingFile = await prepareOutgoingFile(file);
    const transferId = createId('cloud_mobile_transfer');
    const chunks = splitBase64(outgoingFile.data);
    const transfer = {
      transferId,
      fileName: outgoingFile.fileName,
      fileSize: outgoingFile.fileSize,
      sha256: outgoingFile.hash,
      chunks,
      nextChunkIndex: 0,
      sourceDeviceId: cloudPairing.phoneDeviceId || pairing.deviceId,
      destinationDeviceId: cloudPairing.desktopDeviceId,
      ownerId: cloudPairing.ownerId,
      direction: 'sent',
      state: 'waiting-approval',
    };
    this.outgoing.set(transferId, transfer);
    transfer.timeout = this.createTimeout(transferId, 'outgoing');
    this.sendPacket(transfer, 'metadata', {
      transferId,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      mimeType: file.mimeType || 'application/octet-stream',
      sha256: transfer.sha256,
      checksum: transfer.sha256,
      chunkBytes: CHUNK_BASE64_LENGTH,
      chunkCount: chunks.length,
      protocolVersion: PROTOCOL_VERSION,
      createdAt: Date.now(),
    });
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
    this.sendPacket(transfer, 'accept', {
      transferId,
      nextChunkIndex: transfer.nextChunkIndex,
    });
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
    if (message.type !== 'relay:packet') return;
    const packet = message.packet || {};
    const payload = packet.payload || {};
    if (payload.type !== 'cloud-file-transfer') return;
    const action = payload.action;
    if (action === 'metadata') return this.handleMetadata(packet, payload);
    if (action === 'accept') return this.handleAccept(payload);
    if (action === 'reject') return this.handleReject(payload);
    if (action === 'chunk') return this.handleChunk(packet, payload);
    if (action === 'chunk-ack') return this.handleChunkAck(payload);
    if (action === 'complete') return this.handleComplete(payload);
    if (action === 'complete-ack') return this.handleCompleteAck(payload);
    if (action === 'cancel') return this.handleCancel(payload);
    if (action === 'pause') return this.handlePause(payload);
    if (action === 'resume') return this.handleResume(payload);
  }

  handleMetadata(packet, payload) {
    const transfer = {
      transferId: String(payload.transferId || ''),
      fileName: String(payload.fileName || 'received-file'),
      fileSize: Number(payload.fileSize) || 0,
      sha256: String(payload.sha256 || payload.checksum || '').toLowerCase(),
      chunkCount: Number(payload.chunkCount) || 1,
      chunks: [],
      nextChunkIndex: 0,
      sourceDeviceId: packet.sourceDeviceId,
      destinationDeviceId: packet.destinationDeviceId,
      ownerId: packet.ownerId,
      direction: 'received',
      state: 'waiting-approval',
    };
    if (!transfer.transferId || !/^[a-f0-9]{64}$/.test(transfer.sha256)) {
      this.sendPacket(transfer, 'error', {
        transferId: transfer.transferId,
        code: 'invalid-metadata',
        message: 'Invalid transfer metadata.',
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
    const checksum = String(payload.sha256 || payload.checksum || '').toLowerCase();
    const actual = await hashBase64Chunk(chunk);
    if (checksum && actual !== checksum) {
      this.cancelTransfer(transfer.transferId, 'checksum-failure');
      return;
    }
    transfer.chunks[index] = chunk;
    transfer.nextChunkIndex += 1;
    transfer.state = 'downloading';
    this.refreshTimeout(transfer, 'incoming');
    this.sendPacket(transfer, 'chunk-ack', {
      transferId: transfer.transferId,
      chunkIndex: index,
      receivedBytes: this.receivedBytes(transfer),
      nextChunkIndex: transfer.nextChunkIndex,
    });
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
    if (transfer.nextChunkIndex >= transfer.chunks.length) {
      this.sendPacket(transfer, 'complete', {
        transferId: transfer.transferId,
        fileSize: transfer.fileSize,
        sha256: transfer.sha256,
      });
      transfer.state = 'waiting-complete-ack';
      this.refreshTimeout(transfer, 'outgoing');
      this.emitEvent('progress', transfer);
      return;
    }
    const index = transfer.nextChunkIndex;
    const chunk = transfer.chunks[index] || '';
    const checksum = await hashBase64Chunk(chunk);
    this.sendPacket(transfer, 'chunk', {
      transferId: transfer.transferId,
      chunkIndex: index,
      sequenceNumber: index,
      chunkSize: base64ByteLength(chunk),
      totalChunks: transfer.chunks.length,
      data: chunk,
      sha256: checksum,
      checksum,
      state: 'uploading',
    });
    this.refreshTimeout(transfer, 'outgoing');
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
      requestId: `${transfer.transferId}:${action}:${payload.chunkIndex ?? ''}`,
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
    this.incoming.delete(transfer.transferId);
  }

  cleanupOutgoing(transfer, reason) {
    clearTimeout(transfer.timeout);
    this.outgoing.delete(transfer.transferId);
    if (!['completed', 'rejected'].includes(reason)) transfer.reject?.(new Error(reason || 'Transfer failed.'));
  }

  receivedBytes(transfer) {
    return base64ByteLength(transfer.chunks.join(''));
  }

  publicTransfer(transfer) {
    const transferredBytes = transfer.direction === 'received'
      ? this.receivedBytes(transfer)
      : Math.min((transfer.nextChunkIndex || 0) * Math.floor(CHUNK_BASE64_LENGTH * 0.75), transfer.fileSize);
    return {
      transferId: transfer.transferId,
      direction: transfer.direction,
      state: transfer.state,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      transferredBytes,
      percent: transfer.fileSize > 0 ? Math.min(100, Math.round((transferredBytes / transfer.fileSize) * 100)) : 100,
      currentChunk: transfer.nextChunkIndex || 0,
      totalChunks: transfer.chunkCount || transfer.chunks?.length || 1,
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
