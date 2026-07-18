import { fromBase64, text, toBase64, utf8 } from '../crypto/Encoding';
import MessageModel from './MessageModel';
import { MessageConstants } from './MessageConstants';

/**
 * Mobile encrypted message pipeline.
 */
export class MessagePipeline {
  /**
   * Creates pipeline.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.crypto = options.crypto;
    this.validation = options.validation;
    this.compression = options.compression;
    this.sessionResolver = options.sessionResolver;
  }

  /**
   * Creates encrypted outbound message.
   * @param {object} input Input.
   * @returns {Promise<object>} Message.
   */
  async createEncryptedMessage(input = {}) {
    const validated = this.validation.outgoing(input);
    const messageId = input.messageId || MessageModel.messageId();
    const key = await this.resolveSessionKey({ ...input, ...validated, messageId });
    const aad = `OpenXChat:v${this.config.protocolVersion}:message:${messageId}:${validated.relationshipId}`;
    const encryptedEnvelope = await this.crypto.aes.encrypt({
      key,
      plaintext: utf8(validated.plaintext),
      aad,
    });
    const compressed = await this.compression.compress(JSON.stringify(encryptedEnvelope));
    const checksum = await MessageModel.checksum(compressed.data);
    return MessageModel.create({
      ...validated,
      messageId,
      ciphertext: compressed.data,
      checksum,
      sequence: input.sequence || 0,
      status: MessageConstants.MESSAGE_STATUS.ENCRYPTED,
      version: this.config.protocolVersion,
      compression: compressed.compression,
      encryptionVersion: this.config.encryptionVersion,
      metadata: {
        ...validated.metadata,
        aad: toBase64(utf8(aad)),
      },
    });
  }

  /**
   * Receives encrypted mailbox envelope.
   * @param {object} input Input.
   * @returns {Promise<object>} Received result.
   */
  async receiveEncryptedEnvelope(input = {}) {
    const envelope = input.envelope || input;
    const metadata = envelope.metadata || {};
    const key = await this.resolveSessionKey({ ...input, envelope, metadata });
    const serialized = await this.compression.decompress(envelope.ciphertext, {
      algorithm: metadata.compressionAlgorithm || envelope.futureCompression?.algorithm || 'none',
      compressed: metadata.compressionEnabled === true || envelope.futureCompression?.enabled === true,
      version: metadata.compressionVersion || '1',
    });
    const encryptedEnvelope = JSON.parse(serialized);
    const plaintext = await this.crypto.aes.decrypt({ key, ...encryptedEnvelope });
    const message = MessageModel.create({
      messageId: envelope.messageId,
      relationshipId: metadata.relationshipId,
      senderAccountId: metadata.senderAccountId,
      senderDeviceId: envelope.senderDeviceId,
      recipientAccountId: metadata.recipientAccountId,
      recipientDeviceId: envelope.recipientDeviceId,
      messageType: metadata.messageType || 'Text',
      ciphertext: envelope.ciphertext,
      checksum: envelope.checksum,
      timestamp: metadata.timestamp || envelope.createdAt,
      sequence: envelope.mailboxSequence,
      status: MessageConstants.MESSAGE_STATUS.DELIVERED,
      version: envelope.protocolVersion,
      compression: { algorithm: metadata.compressionAlgorithm || 'none', compressed: metadata.compressionEnabled === true, version: metadata.compressionVersion || '1' },
      encryptionVersion: metadata.encryptionVersion || this.config.encryptionVersion,
      metadata: {
        relationshipId: metadata.relationshipId,
        envelopeId: envelope.envelopeId,
      },
    });
    return { message, plaintext: text(plaintext), envelope };
  }

  /**
   * Resolves session key.
   * @param {object} context Context.
   * @returns {Promise<Uint8Array>} Session key.
   */
  async resolveSessionKey(context = {}) {
    let key = context.sessionKey || null;
    if (!key && typeof this.sessionResolver === 'function') key = await this.sessionResolver(context);
    if (!key && context.sessionId && this.crypto.sessions?.validateSession) key = this.crypto.sessions.validateSession(context.sessionId).sessionKey;
    if (!key && this.config.allowEphemeralSessionKey) {
      const session = this.crypto.sessions.createSession({ localDeviceId: context.senderDeviceId, remoteDeviceId: context.recipientDeviceId });
      key = this.crypto.sessions.validateSession(session.sessionId).sessionKey;
    }
    if (!key && this.config.requireSessionKey) throw new Error('A Phase 4 session key is required before sending or receiving messages.');
    return this.normalizeKey(key || this.crypto.random.key());
  }

  /**
   * Normalizes key material.
   * @param {*} value Key.
   * @returns {Uint8Array} Key.
   */
  normalizeKey(value) {
    if (value instanceof Uint8Array) return this.assertKey(value);
    if (Array.isArray(value)) return this.assertKey(new Uint8Array(value));
    if (typeof value === 'string') {
      if (/^[a-f0-9]{64}$/i.test(value)) {
        return this.assertKey(new Uint8Array(value.match(/.{1,2}/g).map((part) => parseInt(part, 16))));
      }
      return this.assertKey(fromBase64(value));
    }
    throw new Error('Message session key is invalid.');
  }

  /**
   * Validates key length.
   * @param {Uint8Array} key Key.
   * @returns {Uint8Array} Key.
   */
  assertKey(key) {
    if (key.byteLength !== 32) throw new Error('Message session key must be 32 bytes.');
    return key;
  }
}

export default MessagePipeline;
