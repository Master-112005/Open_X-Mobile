import { CryptoManager } from '../crypto';
import { fromBase64, toBase64 } from '../crypto/Encoding';

/**
 * Mobile encrypted upload manager.
 */
export class UploadManager {
  /**
   * Creates upload manager.
   * @param {object} options Dependencies.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.client = options.client;
    this.integrity = options.integrity;
    this.thumbnail = options.thumbnail;
    this.crypto = options.crypto || new CryptoManager(options.cryptoConfig || {});
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /**
   * Encrypts and uploads one file.
   * @param {object} input File input.
   * @returns {Promise<object>} Upload result with local key.
   */
  async upload(input = {}) {
    await this.crypto.initialize?.();
    const file = this.validateFile(input);
    const fileKey = this.crypto.random.key();
    const aad = `file:${file.fileName}:${file.relationshipId}:${file.recipientDeviceId}`;
    const encrypted = await this.crypto.aes.encrypt({ key: fileKey, plaintext: file.bytes, aad });
    const encryptedBytes = fromBase64(encrypted.ciphertext);
    const thumbnailPlaintext = await this.thumbnail.generate(file);
    const encryptedThumbnail = thumbnailPlaintext
      ? await this.crypto.aes.encrypt({ key: fileKey, plaintext: thumbnailPlaintext, aad: `thumbnail:${file.fileName}` })
      : null;
    const hash = await this.integrity.sha256(encryptedBytes);
    const payload = {
      relationshipId: file.relationshipId,
      senderAccountId: file.senderAccountId,
      recipientAccountId: file.recipientAccountId,
      senderDeviceId: file.senderDeviceId,
      recipientDeviceId: file.recipientDeviceId,
      fileName: file.fileName,
      mimeType: file.mimeType,
      originalSize: file.bytes.byteLength,
      encryptedSize: encryptedBytes.byteLength,
      encryptedBlob: encrypted.ciphertext,
      hash,
      checksum: hash,
      originalHash: await this.integrity.sha256(file.bytes),
      encryptionVersion: this.config.encryptionVersion,
      encryption: {
        algorithm: 'aes-256-gcm',
        iv: encrypted.iv,
        tag: encrypted.tag,
        aad: encrypted.aad,
      },
      compression: { algorithm: 'none', compressed: false },
      metadata: file.metadata,
    };
    if (encryptedThumbnail) {
      const thumbnailBytes = fromBase64(encryptedThumbnail.ciphertext);
      payload.thumbnail = {
        encryptedThumbnail: encryptedThumbnail.ciphertext,
        hash: await this.integrity.sha256(thumbnailBytes),
        encryption: {
          algorithm: 'aes-256-gcm',
          iv: encryptedThumbnail.iv,
          tag: encryptedThumbnail.tag,
          aad: encryptedThumbnail.aad,
        },
      };
    }
    this.eventBus?.emit?.(this.events.TRANSFER_STARTED, { fileName: file.fileName });
    const upload = await this.client.upload(payload);
    this.eventBus?.emit?.(this.events.UPLOAD_COMPLETED, { transferId: upload.transfer.transferId });
    return {
      ...upload,
      localKey: toBase64(fileKey),
      originalHash: payload.originalHash,
    };
  }

  /**
   * Validates local file input.
   * @param {object} input File input.
   * @returns {object} File.
   */
  validateFile(input = {}) {
    const fileName = String(input.fileName || '').trim().replace(/[\\/]/g, '_');
    if (!fileName) throw new Error('File name is required.');
    const extension = String(fileName.split('.').pop() || '').toLowerCase();
    if (this.config.blockedExtensions.includes(extension)) throw new Error('This file type is not allowed.');
    const fileCategory = this.config.supportedImageExtensions.includes(extension)
      ? 'Image'
      : this.config.supportedDocumentExtensions.includes(extension)
        ? 'Document'
        : null;
    if (!fileCategory) throw new Error('Only image and document transfers are supported.');
    const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes || input.buffer || []);
    if (!bytes.byteLength) throw new Error('File bytes are required.');
    const limit = fileCategory === 'Image' ? this.config.maxImageSizeBytes : this.config.maxDocumentSizeBytes;
    if (bytes.byteLength > limit) throw new Error('File is too large.');
    const mimeType = String(input.mimeType || this.defaultMime(extension)).toLowerCase();
    const allowedMimeTypes = this.config.mimeByExtension?.[extension] || [];
    if (!allowedMimeTypes.includes(mimeType)) throw new Error('File MIME type is not allowed for this extension.');
    return {
      relationshipId: this.relationshipId(input.relationshipId),
      senderAccountId: this.accountId(input.senderAccountId),
      recipientAccountId: this.accountId(input.recipientAccountId),
      senderDeviceId: this.deviceId(input.senderDeviceId),
      recipientDeviceId: this.deviceId(input.recipientDeviceId),
      fileName,
      fileCategory,
      mimeType,
      bytes,
      metadata: this.metadata(input.metadata),
    };
  }

  /** @param {string} extension Extension. @returns {string} MIME. */
  defaultMime(extension) {
    return {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      rtf: 'application/rtf',
      odt: 'application/vnd.oasis.opendocument.text',
    }[extension] || 'application/octet-stream';
  }

  /** @param {*} value AccountID. @returns {string} AccountID. */
  accountId(value) {
    const accountId = String(value || '').trim().toLowerCase();
    if (!/^acc_[a-f0-9]{64}$/.test(accountId)) throw new Error('AccountID is invalid.');
    return accountId;
  }

  /** @param {*} value DeviceID. @returns {string} DeviceID. */
  deviceId(value) {
    const deviceId = String(value || '').trim().toLowerCase();
    if (!/^dev_[a-f0-9]{64}$/.test(deviceId)) throw new Error('DeviceID is invalid.');
    return deviceId;
  }

  /** @param {*} value RelationshipID. @returns {string} RelationshipID. */
  relationshipId(value) {
    const relationshipId = String(value || '').trim().toLowerCase();
    if (!/^rel_[a-f0-9]{64}$/.test(relationshipId)) throw new Error('RelationshipID is invalid.');
    return relationshipId;
  }

  /** @param {*} value Metadata. @returns {object} Metadata. */
  metadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const output = {};
    Object.entries(value).forEach(([key, child]) => {
      if (/^[a-z0-9_-]{1,40}$/i.test(key) && ['string', 'number', 'boolean'].includes(typeof child)) output[key] = child;
    });
    return output;
  }
}

export default UploadManager;
