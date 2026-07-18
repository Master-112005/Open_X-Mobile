/**
 * Mobile Chat infrastructure optimization events.
 */
export const InfrastructureEvents = Object.freeze({
  METRIC_RECORDED: 'chat.infrastructure.metric_recorded',
  PERFORMANCE_WARNING: 'chat.infrastructure.performance_warning',
  BATTERY_SAVER: 'chat.infrastructure.battery_saver',
  MEMORY_PRESSURE: 'chat.infrastructure.memory_pressure',
  STORAGE_PRESSURE: 'chat.infrastructure.storage_pressure',
  CONNECTION_BACKOFF: 'chat.infrastructure.connection_backoff',
  SYNC_BATCH_PLANNED: 'chat.infrastructure.sync_batch_planned',
});

export default InfrastructureEvents;
