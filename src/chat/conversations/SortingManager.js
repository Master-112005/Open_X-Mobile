/**
 * Mobile local conversation sorter.
 */
export class SortingManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.config = options.config;
  }

  /** @param {object[]} conversations Conversations. @param {string} strategy Strategy. @returns {object[]} Sorted. */
  sort(conversations = [], strategy = this.config.defaultSortingStrategy) {
    const sorted = [...conversations];
    sorted.sort((left, right) => {
      const pin = this.comparePinned(left, right);
      if (pin !== 0) return pin;
      if (strategy === 'alphabetical') return this.name(left).localeCompare(this.name(right));
      if (strategy === 'unread') return (right.unreadCount || 0) - (left.unreadCount || 0) || this.compareLastMessage(left, right);
      if (strategy === 'archived') return Number(right.archived) - Number(left.archived) || this.compareLastMessage(left, right);
      return this.compareLastMessage(left, right) || this.name(left).localeCompare(this.name(right));
    });
    return sorted;
  }

  /** @param {object} left Left. @param {object} right Right. @returns {number} Sort result. */
  comparePinned(left, right) {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    if (left.pinned && right.pinned) return (left.pinOrder || 0) - (right.pinOrder || 0);
    return 0;
  }

  /** @param {object} left Left. @param {object} right Right. @returns {number} Sort result. */
  compareLastMessage(left, right) {
    return Date.parse(right.lastMessageTimestamp || right.updatedAt || 0) - Date.parse(left.lastMessageTimestamp || left.updatedAt || 0);
  }

  /** @param {object} conversation Conversation. @returns {string} Name. */
  name(conversation) {
    return String(conversation.metadata?.title || conversation.metadata?.name || conversation.relationshipId || '').toLowerCase();
  }
}

export default SortingManager;
