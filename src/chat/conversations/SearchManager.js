/**
 * Mobile local search manager.
 */
export class SearchManager {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.service = options.service;
    this.indexManager = options.indexManager;
  }

  /** @param {object} input Search input. @returns {Promise<object>} Search page. */
  search(input = {}) { return this.service.search(input); }

  /** @returns {Promise<object>} Rebuild result. */
  reindex() { return this.indexManager.rebuild(); }

  /** @returns {Promise<object>} Optimize result. */
  optimize() { return this.indexManager.optimize(); }

  /** @param {string} conversationId ConversationID. @returns {Promise<void>} Delete result. */
  deleteIndex(conversationId) { return this.indexManager.deleteConversationIndex(conversationId); }
}

export default SearchManager;
