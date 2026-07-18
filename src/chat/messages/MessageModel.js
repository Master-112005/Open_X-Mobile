import { MessageConstants } from './MessageConstants';

/**
 * Mobile local encrypted message model.
 */
export class MessageModel {
  /**
   * Creates local encrypted message record.
   * @param {object} input Input.
   * @returns {object} Message.
   */
  static create(input = {}) {
    const now = new Date(input.now || Date.now()).toISOString();
    return {
      messageId: input.messageId || MessageModel.messageId(),
      relationshipId: input.relationshipId,
      senderAccountId: input.senderAccountId,
      senderDeviceId: input.senderDeviceId,
      recipientAccountId: input.recipientAccountId,
      recipientDeviceId: input.recipientDeviceId,
      messageType: input.messageType || MessageConstants.MESSAGE_TYPE.TEXT,
      ciphertext: input.ciphertext,
      metadata: input.metadata || {},
      timestamp: input.timestamp || now,
      sequence: Number(input.sequence || 0),
      status: input.status || MessageConstants.MESSAGE_STATUS.CREATED,
      version: String(input.version || '1'),
      compression: input.compression || { algorithm: 'none', compressed: false, version: '1' },
      encryptionVersion: input.encryptionVersion || 'phase4-aes-256-gcm',
      checksum: input.checksum,
      retryCount: Number(input.retryCount || 0),
      readState: input.readState || { unread: true, read: false, readAt: null },
      futureAttachments: { enabled: false, count: 0 },
      futureReplies: { enabled: false, parentMessageId: null },
      futureReactions: { enabled: false, count: 0 },
    };
  }

  /** @returns {string} MessageID. */
  static messageId() {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return `msg_${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Computes SHA-256 checksum.
   * @param {string} value Value.
   * @returns {Promise<string>} Checksum.
   */
  static async checksum(value) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}

export default MessageModel;
