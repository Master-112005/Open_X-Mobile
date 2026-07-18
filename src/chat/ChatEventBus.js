/**
 * Mobile Chat internal event bus.
 */
export class ChatEventBus {
  /**
   * Creates an event bus.
   * @param {object} options Bus options.
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.listeners = new Map();
  }

  /**
   * Registers a listener.
   * @param {string} eventName Event name.
   * @param {Function} listener Listener function.
   * @returns {Function} Unsubscribe function.
   */
  on(eventName, listener) {
    const name = String(eventName || '').trim();
    if (!name || typeof listener !== 'function') throw new Error('Valid event name and listener are required.');
    const listeners = this.listeners.get(name) || new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
    return () => this.off(name, listener);
  }

  /**
   * Removes a listener.
   * @param {string} eventName Event name.
   * @param {Function} listener Listener function.
   * @returns {boolean} Whether the listener was removed.
   */
  off(eventName, listener) {
    const name = String(eventName || '').trim();
    const listeners = this.listeners.get(name);
    if (!listeners) return false;
    const removed = listeners.delete(listener);
    if (listeners.size === 0) this.listeners.delete(name);
    return removed;
  }

  /**
   * Emits an event.
   * @param {string} eventName Event name.
   * @param {object} payload Event payload.
   * @returns {number} Listener count.
   */
  emit(eventName, payload = {}) {
    const listeners = [...(this.listeners.get(String(eventName || '').trim()) || [])];
    for (const listener of listeners) {
      try {
        listener({ eventName, timestamp: new Date().toISOString(), ...payload });
      } catch (error) {
        this.logger.warn?.('Mobile Chat event listener failed', { eventName, error: error.message });
      }
    }
    return listeners.length;
  }
}

export default ChatEventBus;
