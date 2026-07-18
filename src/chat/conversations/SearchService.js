/**
 * Mobile local search service.
 */
export class SearchService {
  /** @param {object} options Options. */
  constructor(options = {}) {
    this.storage = options.storage;
    this.indexManager = options.indexManager;
    this.pagination = options.pagination;
    this.sorting = options.sorting;
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /** @param {object} input Search input. @returns {Promise<object>} Search page. */
  async search(input = {}) {
    const query = String(input.query || '').trim();
    if (!query) return this.pagination.paginate([], input);
    const queryTokens = this.indexManager.tokenize(query);
    const conversations = await this.storage.listConversations();
    const byId = new Map(conversations.map(item => [item.conversationId, item]));
    const hits = [];
    for (const record of await this.storage.listSearchIndex()) {
      if (input.type && record.type !== input.type) continue;
      const score = this.score(record.tokens, queryTokens);
      if (score <= 0) continue;
      const conversation = byId.get(record.conversationId);
      if (!conversation || conversation.deleted || (conversation.archived && !input.includeArchived)) continue;
      hits.push({ conversation, record, score });
    }
    hits.sort((left, right) => right.score - left.score || Date.parse(right.conversation.updatedAt) - Date.parse(left.conversation.updatedAt));
    const seen = new Set();
    const results = [];
    for (const hit of hits) {
      const key = input.includeMessages ? `${hit.conversation.conversationId}:${hit.record.messageId || 'conversation'}` : hit.conversation.conversationId;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        conversation: hit.conversation,
        type: hit.record.type,
        messageId: hit.record.messageId,
        score: hit.score,
      });
    }
    this.eventBus?.emit?.(this.events.SEARCH_UPDATED, { queryLength: query.length, results: results.length });
    return this.pagination.paginate(results, input);
  }

  /** @param {string[]} tokens Tokens. @param {string[]} queryTokens Query tokens. @returns {number} Score. */
  score(tokens = [], queryTokens = []) {
    let score = 0;
    for (const query of queryTokens) {
      if (tokens.includes(query)) score += 3;
      else if (tokens.some(token => token.startsWith(query))) score += 2;
      else if (tokens.some(token => token.includes(query))) score += 1;
      else return 0;
    }
    return score;
  }
}

export default SearchService;
