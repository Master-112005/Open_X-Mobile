/**
 * Mobile cursor pagination manager.
 */
export class PaginationManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.config = options.config;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object[]} items Items. @param {object} options Options. @returns {object} Page. */
  paginate(items = [], options = {}) {
    const limit = Math.min(Math.max(Number(options.limit || this.config.defaultPageSize), 1), this.config.maxPageSize);
    const offset = this.offset(options.cursor);
    const data = items.slice(offset, offset + limit);
    const nextOffset = offset + data.length;
    const result = {
      items: data,
      cursor: options.cursor || null,
      nextCursor: nextOffset < items.length ? `cur_${nextOffset}` : null,
      hasMore: nextOffset < items.length,
      total: items.length,
      limit,
    };
    this.eventBus?.emit?.(this.events.PAGINATION_LOADED, { count: data.length, total: items.length });
    return result;
  }

  /** @param {*} cursor Cursor. @returns {number} Offset. */
  offset(cursor) {
    if (cursor === undefined || cursor === null || cursor === '') return 0;
    const text = String(cursor);
    if (/^cur_\d+$/.test(text)) return Number(text.slice(4));
    const numeric = Number(text);
    return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : 0;
  }
}

export default PaginationManager;
