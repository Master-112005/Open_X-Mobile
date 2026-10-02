'use strict';

const REFERENCE_PATTERN = /\b(?:it|that|this|them|those|these|they|same|same\s+one|previous\s+one|last\s+file|current\s+app|selected\s+folder|one|ones|there)\b/i;
const CONTINUATION_PATTERN = /^(?:and|also|then|what\s+about|how\s+about|same\s+(?:thing\s+)?(?:with|for)|do\s+(?:the\s+)?same\s+(?:with|for))\b/i;
const CORRECTION_PATTERN = /^(?:no(?:\s+no)?|nah|actually|instead|rather|sorry)\b|\b(?:set|change|make|use)\s+(?:it|that|this|same|one)?\s*(?:to|as)\b/i;
const CLAUSE_CONNECTOR_PATTERN = /\s*(?:;|,|\b(?:and then|then|after that|afterwards|and|also|plus)\b)\s*/i;
const HARD_CLAUSE_CONNECTOR_PATTERN = /\b(?:and then|then|after that|afterwards|also|plus)\b|[;,]/i;
const CLAUSE_ACTION_START_PATTERN = /^(?:open|launch|start|run|close|quit|exit|terminate|minimize|maximize|switch|focus|search|google|look\s+up|find|what|who|when|where|why|how|which|remind|remember|notify|alert|set|turn|send|share|transfer|copy|move|message|text|ask|tell|play|stream|listen|watch|queue|put|pause|resume|unpause|stop|skip|next|previous|create|delete|rename|save|show|list|click|select|choose|pick)\b/i;
const SINGLE_TARGET_ACTION_PATTERN = /^(?:play|stream|listen\s+to|watch|queue|put\s+on|start\s+playing|search|google|look\s+up|find|tell\s+me\s+about|explain|remind|remember|notify|alert|set\s+(?:an?\s+)?(?:reminder|alarm|timer)|open)\b/i;

const PREPOSITIONS = new Set(['at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'onto', 'to', 'with', 'using', 'via']);
const CONNECTORS = new Set(['and', 'then', 'also', 'plus']);
const FILLERS = new Set(['a', 'an', 'me', 'my', 'please', 'the', 'you']);
const REFERENCES = new Set(['it', 'that', 'this', 'them', 'those', 'these', 'they', 'same', 'one', 'ones', 'there']);
const QUESTION_WORD_PATTERN = /^(?:what|who|when|where|why|how|which)\b/i;
const QUOTED_PHRASE_PATTERN = /"([^"]+)"|'([^']+)'|`([^`]+)`/g;
const INTENT_ACTION_PATTERNS = [
  { action: 'search', domain: 'web', pattern: /^(?:search(?:\s+the\s+web)?(?:\s+for)?|google|look\s+up|find\s+online)\s+(.+)$/i },
  { action: 'play', domain: 'media', pattern: /^(?:play|stream|listen\s+to|watch|queue|put\s+on|start\s+playing)\s+(.+)$/i },
  { action: 'remind', domain: 'schedule', pattern: /^(?:remind|remember|notify|alert)\s+(?:me\s+)?(.+)$/i },
  { action: 'set', domain: 'schedule', pattern: /^(?:set|create|start)\s+(?:an?\s+)?(?:timer|alarm|reminder)\s+(?:for|at|to)?\s*(.+)$/i },
  { action: 'send', domain: 'transfer', pattern: /^(?:send|share|transfer|copy|export|push|move)\s+(.+)$/i },
  { action: 'open', domain: 'app', pattern: /^(?:open|launch|start|run|show)\s+(.+)$/i },
  { action: 'close', domain: 'app', pattern: /^(?:close|quit|exit|terminate)\s+(.+)$/i },
  { action: 'set', domain: 'utility', pattern: /^(?:set|change|make|put|keep|adjust|turn)\s+(?:the\s+)?(.+)$/i }
];

function extractDiscourseReferences(input) {
  const normalized = String(input || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized) return [];

  const references = [];
  const pattern = /\b(?:same\s+one|previous\s+one|last\s+file|current\s+app|selected\s+folder|it|that|this|them|those|these|they|same|ones|one|there)\b/g;
  let match;
  while ((match = pattern.exec(normalized))) {
    const value = match[0];
    if (value === 'one' && /\b(?:one|1)\s+(?:second|minute|hour|day|week|month|year|am|pm|percent|hundred)\b/.test(normalized)) {
      continue;
    }
    if (!references.includes(value)) references.push(value);
  }
  return references;
}

function extractQuotedPhrases(input) {
  const text = String(input || '');
  const phrases = [];
  let match;
  while ((match = QUOTED_PHRASE_PATTERN.exec(text))) {
    const value = (match[1] || match[2] || match[3] || '').trim();
    if (value && !phrases.includes(value)) phrases.push(value);
  }
  return phrases;
}

function cleanObjectText(value, action = '') {
  let text = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/g, '')
    .trim();
  if (!text) return '';

  if (action === 'play') {
    text = text
      .replace(/\s+(?:on|in|via)\s+(?:youtube|spotify|soundcloud|apple\s+music|amazon\s+music|jiosaavn|gaana|vlc)\s*$/i, '')
      .replace(/\s+(?:song|songs|music|track|tracks|video|videos)\s*$/i, '')
      .trim();
  }
  if (action === 'search') {
    text = text.replace(/^(?:for|about)\s+/i, '').trim();
  }
  return text;
}

function inferPhraseDomain(text, action, objectText) {
  const combined = `${text || ''} ${objectText || ''}`.toLowerCase();
  if (/\b(?:timer|alarm|reminder|remind|notify|wake|snooze|every|daily|weekly|weekday|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(combined)) {
    return 'schedule';
  }
  if (/\b(?:volume|vol|sound|audio|brightness|screen)\b/.test(combined)) {
    return 'utility';
  }
  if (/\b(?:song|songs|music|track|playlist|album|artist|podcast|video|youtube|spotify|vlc)\b/.test(combined) || action === 'play') {
    return 'media';
  }
  if (/\b(?:file|files|folder|folders|directory|directories|pdf|docx?|xlsx?|image|photo|screenshot|download|desktop|documents|pictures)\b|\.[a-z0-9]{1,10}\b/i.test(combined)) {
    return /\b(?:phone|mobile|iphone|android|device|tablet)\b/.test(combined) ? 'transfer' : 'local-file';
  }
  if (action === 'search' || /\b(?:web|internet|online|website|site)\b/.test(combined)) {
    return 'web';
  }
  if (['open', 'close', 'switch'].includes(action)) {
    return 'app';
  }
  return 'conversation';
}

function parseIntentPhrase(input) {
  const originalText = String(input || '').replace(/\s+/g, ' ').trim();
  const normalized = originalText.toLowerCase();
  const discourse = analyzeDiscourse(originalText);
  const quotedPhrases = extractQuotedPhrases(originalText);
  const valueMatch = normalized.match(/\b(\d{1,3})(?:\s*%|\s+percent)?\b/);
  const timeExpression = originalText.match(/\b(?:at\s+)?(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|noon|midnight|tomorrow|today|tonight|morning|evening)\b/i)?.[0] || '';
  const recurrence = originalText.match(/\b(?:every\s+(?:day|weekday|weekend|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|weekdays?|weekends?)\b/gi) || [];

  let action = '';
  let actionPhrase = '';
  let objectText = '';
  let matchedDomain = '';
  for (const candidate of INTENT_ACTION_PATTERNS) {
    const match = originalText.match(candidate.pattern);
    if (!match?.[1]) continue;
    action = candidate.action;
    actionPhrase = match[0].slice(0, Math.max(0, match[0].length - match[1].length)).trim();
    objectText = cleanObjectText(quotedPhrases[0] || match[1], action);
    matchedDomain = candidate.domain;
    break;
  }

  if (!action && discourse.isCorrection && valueMatch?.[1]) {
    action = 'set';
    actionPhrase = 'correct';
    objectText = `volume ${valueMatch[1]}`;
    matchedDomain = 'utility';
  }

  const domain = matchedDomain && matchedDomain !== 'utility'
    ? inferPhraseDomain(originalText, action, objectText) || matchedDomain
    : inferPhraseDomain(originalText, action, objectText);

  return {
    version: 'intent-phrase-v1',
    originalText,
    normalizedText: normalized,
    action: action || null,
    actionPhrase,
    objectText,
    objectTextNormalized: objectText.toLowerCase(),
    domain,
    isQuestion: QUESTION_WORD_PATTERN.test(normalized),
    isCorrection: discourse.isCorrection === true,
    references: discourse.references,
    quotedPhrases,
    modifiers: {
      value: valueMatch?.[1] ? Number(valueMatch[1]) : null,
      timeExpression,
      recurrence,
      platform: normalized.match(/\b(youtube|spotify|soundcloud|vlc|gaana|jiosaavn|apple music|amazon music)\b/)?.[1] || ''
    },
    confidence: action || objectText || discourse.requiresContext ? 0.82 : 0.35
  };
}

function analyzeDiscourse(input) {
  const text = String(input || '').replace(/\s+/g, ' ').trim();
  const normalized = text.toLowerCase();
  const references = extractDiscourseReferences(normalized);
  const continuation = normalized.match(CONTINUATION_PATTERN)?.[0] || '';
  const isCorrection = CORRECTION_PATTERN.test(normalized);
  return {
    isFollowUp: Boolean(continuation || references.length > 0 || isCorrection),
    isCorrection,
    continuation,
    references: [...new Set(references)],
    requiresContext: Boolean(continuation || isCorrection || REFERENCE_PATTERN.test(normalized))
  };
}

function clauseStartsWithAction(clause) {
  const text = String(clause || '').trim();
  return CLAUSE_ACTION_START_PATTERN.test(text);
}

function shouldKeepSingleClause(source, parts) {
  if (!Array.isArray(parts) || parts.length < 2) return false;
  const text = String(source || '').trim().toLowerCase();
  if (!text || HARD_CLAUSE_CONNECTOR_PATTERN.test(text)) return false;
  if (!SINGLE_TARGET_ACTION_PATTERN.test(text)) return false;
  if (!clauseStartsWithAction(parts[0])) return false;
  if (/^(?:play|stream|listen\s+to|watch|queue|put\s+on|start\s+playing)\b/.test(text)) {
    return parts.slice(1).every(part => !clauseStartsWithAction(part));
  }
  if (/^remind\b/.test(text) && /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|daily|weekly|every)\b/.test(text)) {
    return parts.slice(1).every(part => !clauseStartsWithAction(part));
  }
  return parts.slice(1).every(part => !clauseStartsWithAction(part));
}

function splitCoordinatedUtilitySharedValue(input) {
  const source = String(input || '').replace(/\s+/g, ' ').trim();
  if (!source) return null;

  const match = source.match(
    /^(?:(?:please|kindly|can\s+you|could\s+you|would\s+you)\s+)?(?:set|change|make|put|keep|adjust|turn)\s+(?:the\s+)?(.+?)\s+(?:to|at)\s+(\d{1,3})(?:\s*%|\s+percent)?$/i
  );
  if (!match?.[1] || !match?.[2]) return null;

  const targetText = match[1]
    .replace(/\b(?:level|levels|percent|percentage)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!targetText || !/\b(?:and|plus|also)\b/i.test(targetText)) return null;
  if (/\b(?:to|at)\s+\d{1,3}(?:\s*%|\s+percent)?\b/.test(targetText)) return null;

  const value = Math.max(0, Math.min(100, Number(match[2])));
  if (!Number.isFinite(value)) return null;

  const targetMatches = [
    { target: 'volume', index: targetText.search(/\b(?:vol|volume|sound|audio)\b/i) },
    { target: 'brightness', index: targetText.search(/\b(?:brighness|brighnes|brightness|bright|screen|display)\b/i) }
  ]
    .filter(entry => entry.index >= 0)
    .sort((left, right) => left.index - right.index);

  const uniqueTargets = [];
  targetMatches.forEach(entry => {
    if (!uniqueTargets.includes(entry.target)) {
      uniqueTargets.push(entry.target);
    }
  });

  return uniqueTargets.length >= 2
    ? uniqueTargets.map(target => `set ${target} to ${value}`)
    : null;
}

function splitCommandClauses(input, options = {}) {
  const source = String(input || '').trim();
  if (!source) return [];
  const coordinatedUtilityClauses = splitCoordinatedUtilitySharedValue(source);
  if (coordinatedUtilityClauses) {
    return coordinatedUtilityClauses.slice(0, Number(options.limit || 8));
  }
  const parts = source
    .split(CLAUSE_CONNECTOR_PATTERN)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, Number(options.limit || 8));

  if (shouldKeepSingleClause(source, parts)) {
    return [source];
  }

  return parts.length ? parts : [source];
}

function cleanTokens(tokens) {
  return Array.isArray(tokens)
    ? tokens.map(token => String(token || '').trim().toLowerCase()).filter(Boolean)
    : [];
}

function nearestContentToken(tokens, start, direction) {
  for (let index = start; index >= 0 && index < tokens.length; index += direction) {
    const token = tokens[index];
    if (!token || FILLERS.has(token) || PREPOSITIONS.has(token) || CONNECTORS.has(token)) {
      continue;
    }
    return { index, token };
  }
  return null;
}

function pushRelation(relations, relation) {
  if (!relation || relation.fromIndex === relation.toIndex) return;
  const key = `${relation.type}:${relation.fromIndex}:${relation.toIndex}:${relation.marker || ''}`;
  if (relations.some(existing => `${existing.type}:${existing.fromIndex}:${existing.toIndex}:${existing.marker || ''}` === key)) {
    return;
  }
  relations.push(relation);
}

function buildWordRelations(tokens, options = {}) {
  const safeTokens = cleanTokens(tokens);
  if (safeTokens.length === 0) return [];

  const relations = [];
  const actionIndex = Number.isInteger(options.actionIndex) ? options.actionIndex : -1;
  const targetTokens = new Set(cleanTokens(options.targetTokens));

  if (actionIndex >= 0 && actionIndex < safeTokens.length) {
    safeTokens.forEach((token, index) => {
      if (index > actionIndex && targetTokens.has(token)) {
        pushRelation(relations, {
          type: 'action-target',
          fromIndex: actionIndex,
          from: safeTokens[actionIndex],
          toIndex: index,
          to: token
        });
      }
    });
  }

  safeTokens.forEach((token, index) => {
    if (PREPOSITIONS.has(token)) {
      const from = nearestContentToken(safeTokens, index - 1, -1);
      const to = nearestContentToken(safeTokens, index + 1, 1);
      if (from && to) {
        pushRelation(relations, {
          type: 'prepositional-link',
          marker: token,
          fromIndex: from.index,
          from: from.token,
          toIndex: to.index,
          to: to.token
        });
      }
      return;
    }

    if (CONNECTORS.has(token)) {
      const from = nearestContentToken(safeTokens, index - 1, -1);
      const to = nearestContentToken(safeTokens, index + 1, 1);
      if (from && to) {
        pushRelation(relations, {
          type: 'sequence',
          marker: token,
          fromIndex: from.index,
          from: from.token,
          toIndex: to.index,
          to: to.token
        });
      }
      return;
    }

    if (/^\d+$/.test(token)) {
      const target = nearestContentToken(safeTokens, index - 1, -1) ||
        nearestContentToken(safeTokens, index + 1, 1);
      if (target) {
        pushRelation(relations, {
          type: 'value-of',
          fromIndex: index,
          from: token,
          toIndex: target.index,
          to: target.token
        });
      }
      return;
    }

    if (REFERENCES.has(token)) {
      pushRelation(relations, {
        type: 'context-reference',
        fromIndex: index,
        from: token,
        toIndex: -1,
        to: 'previous-context'
      });
    }
  });

  return relations;
}

module.exports = {
  analyzeDiscourse,
  buildWordRelations,
  cleanObjectText,
  extractDiscourseReferences,
  extractQuotedPhrases,
  parseIntentPhrase,
  splitCommandClauses
};
