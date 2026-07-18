/**
 * Mobile Phase 8 message constants.
 */
export const MessageConstants = Object.freeze({
  MESSAGE_TYPE: Object.freeze({
    TEXT: 'Text',
    EMOJI: 'Emoji',
  }),
  MESSAGE_STATUS: Object.freeze({
    CREATED: 'Created',
    QUEUED: 'Queued',
    ENCRYPTING: 'Encrypting',
    ENCRYPTED: 'Encrypted',
    COMPRESSING: 'Compressing',
    COMPRESSED: 'Compressed',
    SENDING: 'Sending',
    SENT: 'Sent',
    DELIVERED: 'Delivered',
    READ: 'Read',
    FAILED: 'Failed',
    RETRYING: 'Retrying',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  }),
  COMPRESSION_ALGORITHM: Object.freeze({
    NONE: 'none',
    GZIP: 'gzip',
  }),
});

export default MessageConstants;
