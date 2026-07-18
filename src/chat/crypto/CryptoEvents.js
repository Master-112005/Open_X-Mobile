/**
 * Mobile crypto event names.
 */
export default Object.freeze({
  IDENTITY_GENERATED: 'crypto.identity.generated',
  DEVICE_KEY_GENERATED: 'crypto.device.generated',
  KEY_ROTATED: 'crypto.key.rotated',
  SESSION_CREATED: 'crypto.session.created',
  SESSION_EXPIRED: 'crypto.session.expired',
  REPLAY_DETECTED: 'crypto.replay.detected',
  KEY_IMPORTED: 'crypto.key.imported',
  KEY_EXPORTED: 'crypto.key.exported',
  TRUST_CHANGED: 'crypto.trust.changed',
});
