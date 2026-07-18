import { ChatEvents } from './ChatEvents';

/**
 * Coordinates Mobile Chat lifecycle.
 */
export class ChatLifecycle {
  /**
   * Creates lifecycle manager.
   * @param {object} options Lifecycle dependencies.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.statusManager = options.statusManager;
    this.started = false;
  }

  /**
   * Starts the lifecycle state.
   */
  start() {
    if (this.started) return;
    this.statusManager.setState('starting');
    this.eventBus.emit(ChatEvents.LIFECYCLE_STARTING);
    this.started = true;
    this.statusManager.setState('offline');
    this.eventBus.emit(ChatEvents.LIFECYCLE_STARTED);
  }

  /**
   * Stops the lifecycle state.
   */
  stop() {
    if (!this.started) return;
    this.statusManager.setState('stopping');
    this.eventBus.emit(ChatEvents.LIFECYCLE_STOPPING);
    this.started = false;
    this.statusManager.setState('offline');
    this.eventBus.emit(ChatEvents.LIFECYCLE_STOPPED);
  }
}

export default ChatLifecycle;
