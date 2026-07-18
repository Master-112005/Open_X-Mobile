/**
 * Mobile Phase 11 connection event names.
 */
export const ConnectionEvents = Object.freeze({
  CONNECTED: 'mobile.chat.phase11.connected',
  DISCONNECTED: 'mobile.chat.phase11.disconnected',
  RECONNECT: 'mobile.chat.phase11.reconnect',
  HEARTBEAT: 'mobile.chat.phase11.heartbeat',
  WAKE: 'mobile.chat.phase11.wake',
  BACKGROUND: 'mobile.chat.phase11.background',
  FOREGROUND: 'mobile.chat.phase11.foreground',
  PUSH_RECEIVED: 'mobile.chat.phase11.push.received',
  SYNCHRONIZATION_REQUIRED: 'mobile.chat.phase11.sync.required',
  SYNCHRONIZATION_COMPLETED: 'mobile.chat.phase11.sync.completed',
  RECOVERY_STARTED: 'mobile.chat.phase11.recovery.started',
  RECOVERY_COMPLETED: 'mobile.chat.phase11.recovery.completed',
  PRESENCE_CHANGED: 'mobile.chat.phase11.presence.changed',
});

export default ConnectionEvents;
