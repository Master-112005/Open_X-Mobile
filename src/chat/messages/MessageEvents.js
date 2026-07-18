/**
 * Mobile Phase 8 message events.
 */
export const MessageEvents = Object.freeze({
  MESSAGE_CREATED: 'message.created',
  MESSAGE_ENCRYPTED: 'message.encrypted',
  MESSAGE_COMPRESSED: 'message.compressed',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_DELIVERED: 'message.delivered',
  MESSAGE_READ: 'message.read',
  MESSAGE_FAILED: 'message.failed',
  RETRY_STARTED: 'message.retry.started',
  RETRY_COMPLETED: 'message.retry.completed',
  TYPING_STARTED: 'message.typing.started',
  TYPING_STOPPED: 'message.typing.stopped',
});

export default MessageEvents;
