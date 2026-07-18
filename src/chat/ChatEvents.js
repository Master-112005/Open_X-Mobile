/**
 * Mobile Chat event names reserved for infrastructure and future phases.
 */
export const ChatEvents = Object.freeze({
  LIFECYCLE_STARTING: 'mobile.chat.lifecycle.starting',
  LIFECYCLE_STARTED: 'mobile.chat.lifecycle.started',
  LIFECYCLE_STOPPING: 'mobile.chat.lifecycle.stopping',
  LIFECYCLE_STOPPED: 'mobile.chat.lifecycle.stopped',
  CONNECTION_CONNECTING: 'mobile.chat.connection.connecting',
  CONNECTION_CONNECTED: 'mobile.chat.connection.connected',
  CONNECTION_READY: 'mobile.chat.connection.ready',
  CONNECTION_DISCONNECTED: 'mobile.chat.connection.disconnected',
  CONNECTION_RECONNECTING: 'mobile.chat.connection.reconnecting',
  CONNECTION_ERROR: 'mobile.chat.connection.error',
  CONNECTION_HEARTBEAT: 'mobile.chat.connection.heartbeat',
  CONNECTION_WAKE: 'mobile.chat.connection.wake',
  CONNECTION_BACKGROUND: 'mobile.chat.connection.background',
  CONNECTION_FOREGROUND: 'mobile.chat.connection.foreground',
  CONNECTION_RECOVERY_STARTED: 'mobile.chat.connection.recovery.started',
  CONNECTION_RECOVERY_COMPLETED: 'mobile.chat.connection.recovery.completed',
  PRESENCE_CHANGED: 'mobile.chat.presence.changed',
  HEALTH_CHANGED: 'mobile.chat.health.changed',
  CONFIGURATION_CHANGED: 'mobile.chat.configuration.changed',
  FUTURE_PUSH: 'mobile.chat.future.push',
  FUTURE_SYNCHRONIZATION: 'mobile.chat.future.synchronization',
  FUTURE_MESSAGING: 'mobile.chat.future.messaging',
  FUTURE_NOTIFICATIONS: 'mobile.chat.future.notifications',
  FUTURE_AUTHENTICATION: 'mobile.chat.future.authentication',
  FUTURE_ENCRYPTION: 'mobile.chat.future.encryption'
});

export default ChatEvents;
