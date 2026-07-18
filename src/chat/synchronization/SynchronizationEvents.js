export default Object.freeze({
  SYNC_STARTED: 'sync.started',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_FAILED: 'sync.failed',
  SYNC_INTERRUPTED: 'sync.interrupted',
  RECOVERY_STARTED: 'sync.recovery.started',
  RECOVERY_COMPLETED: 'sync.recovery.completed',
  ACK_SENT: 'sync.ack.sent',
  ACK_RECEIVED: 'sync.ack.received',
  CURSOR_UPDATED: 'sync.cursor.updated',
  CONFLICT_DETECTED: 'sync.conflict.detected',
  RETRY_STARTED: 'sync.retry.started',
  RETRY_COMPLETED: 'sync.retry.completed',
});
