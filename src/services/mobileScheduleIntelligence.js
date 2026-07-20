const NUMBER_WORDS = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  twentyone: 21,
  twentytwo: 22,
  twentythree: 23,
  twentyfour: 24,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  fifty: 50,
  sixty: 60,
});

const pad = (value) => String(value).padStart(2, '0');

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const AMOUNT_PATTERN = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:\\s*(?:one|two|three|four))?|thirty|forty(?:\\s*five)?|fifty|sixty)';
const CLOCK_PATTERN = '(?:\\d{1,2}(?:(?::|\\.|\\s+)\\d{1,2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?)?|\\d{3,4}\\s*(?:a\\.?m\\.?|p\\.?m\\.?)|(?:half|quarter)\\s+(?:past|to)\\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s*(?:a\\.?m\\.?|p\\.?m\\.?)?|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\\s+(?:oh\\s+)?(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty(?:\\s*five)?|fifty))?\\s*(?:a\\.?m\\.?|p\\.?m\\.?)?)';
const WEEKDAY_INDEX = Object.freeze({
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
});
const WEEKDAY_PATTERN = '(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
const MONTH_INDEX = Object.freeze({
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
});
const MONTH_PATTERN = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const NATURAL_PERIOD_HOURS = Object.freeze({
  morning: 9,
  afternoon: 15,
  evening: 18,
  night: 21,
  tonight: 21,
});

const amountFromText = (value) => {
  const normalized = String(value || '').toLowerCase().replace(/\s+/g, '');
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return NUMBER_WORDS[normalized] || 0;
};

const spokenNumberFromText = (value) => {
  const source = cleanText(value).toLowerCase();
  if (!source) return 0;
  const compact = source.replace(/\s+/g, '');
  if (/^\d+$/.test(compact)) return Number(compact);
  if (NUMBER_WORDS[compact]) return NUMBER_WORDS[compact];
  const tokens = source.split(/\s+/).filter(Boolean);
  if (tokens.length === 2) {
    const first = NUMBER_WORDS[tokens[0]];
    const second = NUMBER_WORDS[tokens[1]];
    if (tokens[0] === 'zero' && Number.isInteger(second)) return second;
    if (first >= 20 && first < 60 && first % 10 === 0 && second > 0 && second < 10) {
      return first + second;
    }
  }
  return 0;
};

const normalizeScheduleInput = (value) => cleanText(value)
  .replace(/\b(?:tommorow|tommrow|tomorow)\b/gi, 'tomorrow')
  .replace(/\b(?:alram|alaram)\b/gi, 'alarm')
  .replace(/\b(?:remeinder|remider|remionder)\b/gi, 'reminder')
  .replace(/\b(?:mins?|minits?)\b/gi, 'minutes')
  .replace(/\bhrs?\b/gi, 'hours')
  .replace(/\bsecs?\b/gi, 'seconds');

const parseSpokenClock = (value) => {
  let normalized = cleanText(value).toLowerCase()
    .replace(/\bo\s*clock\b/g, '')
    .replace(/\boh\b/g, 'zero')
    .replace(/\s+/g, ' ')
    .trim();
  const periodMatch = normalized.match(/\s*(am|pm)$/);
  const period = periodMatch?.[1] || '';
  if (period) {
    normalized = normalized.replace(/\s*(am|pm)$/, '').trim();
  }
  const relativeMatch = normalized.match(/^(half|quarter)\s+(past|to)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(am|pm)?$/);
  if (relativeMatch) {
    let hours = amountFromText(relativeMatch[3]);
    let minutes = relativeMatch[1] === 'half' ? 30 : 15;
    if (relativeMatch[2] === 'to') {
      hours -= 1;
      if (hours <= 0) hours = 12;
      minutes = 45;
    }
    const relativePeriod = relativeMatch[4] || period;
    if (relativePeriod === 'pm' && hours < 12) hours += 12;
    if (relativePeriod === 'am' && hours === 12) hours = 0;
    return { hours, minutes, period: relativePeriod };
  }
  const match = normalized.match(/^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+(.+?))?$/);
  if (!match) return null;
  let hours = amountFromText(match[1]);
  const minuteText = cleanText(match[2] || '').replace(/\bzero\b/g, '').trim();
  const minutes = minuteText ? spokenNumberFromText(minuteText) : 0;
  if (!hours || minutes > 59) return null;
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  return { hours, minutes, period };
};

const parseClockParts = (value) => {
  const source = cleanText(value).toLowerCase()
    .replace(/a\.m\./g, 'am')
    .replace(/p\.m\./g, 'pm')
    .replace(/\s+/g, ' ')
    .trim();
  const spoken = parseSpokenClock(source);
  if (spoken) return spoken;
  let match = source.match(/^(\d{1,2})(?::|\.|\s+)(\d{1,2})\s*(am|pm)?$/);
  if (!match) {
    match = source.match(/^(\d{3,4})\s*(am|pm)$/);
    if (match) {
      const compact = match[1];
      match = [
        match[0],
        compact.length === 3 ? compact.slice(0, 1) : compact.slice(0, 2),
        compact.slice(-2),
        match[2],
      ];
    }
  }
  if (!match) match = source.match(/^(\d{1,2})\s*(am|pm)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] && /^\d+$/.test(match[2]) ? match[2] : 0);
  const period = match[3] || (/^(am|pm)$/.test(match[2]) ? match[2] : '');
  if (hours > 23 || minutes > 59) return null;
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  return { hours, minutes, period };
};

const findClockExpression = (text) => {
  const source = cleanText(text).toLowerCase();
  const prepositionMatch = source.match(new RegExp(`\\b(?:at|by|for)\\s+(${CLOCK_PATTERN})(?=\\b|$)`, 'i'));
  if (prepositionMatch?.[1]) return { value: prepositionMatch[1], phrase: prepositionMatch[0], index: prepositionMatch.index || 0 };
  const explicitMatch = source.match(new RegExp(`\\b(${CLOCK_PATTERN})(?=\\b|$)`, 'i'));
  if (explicitMatch?.[1] && /\b(?:am|pm|a\.m\.|p\.m\.)\b/i.test(explicitMatch[1])) {
    return { value: explicitMatch[1], phrase: explicitMatch[0], index: explicitMatch.index || 0 };
  }
  const dayPeriodMatch = source.match(new RegExp(`\\b(?:morning|afternoon|evening|night|tonight)\\s+(?:at\\s+)?(${CLOCK_PATTERN})(?=\\b|$)`, 'i'));
  if (dayPeriodMatch?.[1]) return { value: dayPeriodMatch[1], phrase: dayPeriodMatch[0], index: dayPeriodMatch.index || 0 };
  return null;
};

const validDate = (year, month, day, hours = 9, minutes = 0) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(year, month, day, hours, minutes, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
};

const normalizeMonth = (value) => MONTH_INDEX[String(value || '').toLowerCase()] ?? null;

const normalizeYear = (value, now) => {
  const text = cleanText(value).toLowerCase();
  if (!text || /^this\s+year$/.test(text)) return now.getFullYear();
  if (/^next\s+year$/.test(text)) return now.getFullYear() + 1;
  if (!/^\d{2,4}$/.test(text)) return now.getFullYear();
  const numeric = Number(text);
  if (text.length === 2) return 2000 + numeric;
  return numeric;
};

const finalizeCalendarDate = (date, now, explicitYear = false) => {
  if (!date || !Number.isFinite(date.getTime())) return null;
  if (!explicitYear && date.getTime() <= now.getTime()) {
    const next = validDate(date.getFullYear() + 1, date.getMonth(), date.getDate(), date.getHours(), date.getMinutes());
    return next;
  }
  return date;
};

const isInsideRecurrencePhrase = (match, recurrenceMatch) => {
  if (!match || !recurrenceMatch) return false;
  const index = match.index || 0;
  return index >= recurrenceMatch.index && index < recurrenceMatch.index + recurrenceMatch.phrase.length;
};

const dateWithDefaultPeriod = (base, period) => {
  const dueAt = new Date(base);
  dueAt.setSeconds(0, 0);
  dueAt.setHours(NATURAL_PERIOD_HOURS[period] || 9, 0, 0, 0);
  return dueAt;
};

const nextWeekdayDate = (weekday, now, forceNext = false) => {
  const dueAt = new Date(now);
  dueAt.setSeconds(0, 0);
  dueAt.setHours(9, 0, 0, 0);
  let daysUntil = (weekday - dueAt.getDay() + 7) % 7;
  if (daysUntil === 0 && (forceNext || dueAt.getTime() <= now.getTime())) daysUntil = 7;
  dueAt.setDate(dueAt.getDate() + daysUntil);
  return dueAt;
};

const parseNumericCalendarDate = (match, now) => {
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = normalizeYear(match[3] || '', now);
  const explicitYear = Boolean(match[3]);
  const candidates = [];
  if (first >= 1 && first <= 31 && second >= 1 && second <= 12) {
    const dmy = validDate(year, second - 1, first);
    if (dmy) candidates.push(dmy);
  }
  if (second >= 1 && second <= 31 && first >= 1 && first <= 12) {
    const mdy = validDate(year, first - 1, second);
    if (mdy) candidates.push(mdy);
  }
  const future = candidates
    .map((candidate) => finalizeCalendarDate(candidate, now, explicitYear))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  return future[0] || null;
};

const findDateExpression = (text, now, recurrenceMatch) => {
  const source = cleanText(text).toLowerCase().replace(/,/g, ' ');
  const candidate = (match, builder) => {
    if (!match?.[0] || isInsideRecurrencePhrase(match, recurrenceMatch)) return null;
    const date = builder(match);
    if (!date || !Number.isFinite(date.getTime())) return null;
    return {
      date,
      phrase: match[0],
      index: match.index || 0,
      period: match.groups?.period,
      kind: match.groups?.kind || 'date',
    };
  };

  const tomorrowPeriod = candidate(
    source.match(/\btomorrow\s+(?<period>morning|afternoon|evening|night)\b/i),
    (match) => {
      const dueAt = dateWithDefaultPeriod(now, match.groups.period);
      dueAt.setDate(dueAt.getDate() + 1);
      return dueAt;
    },
  );
  if (tomorrowPeriod) return tomorrowPeriod;

  const relativeDay = candidate(
    source.match(/\b(?<kind>today|tomorrow|tonight)\b/i),
    (match) => {
      const key = match.groups.kind;
      const dueAt = dateWithDefaultPeriod(now, key === 'tonight' ? 'tonight' : 'morning');
      if (key === 'tomorrow') dueAt.setDate(dueAt.getDate() + 1);
      if (key === 'today' && dueAt.getTime() <= now.getTime()) dueAt.setDate(dueAt.getDate() + 1);
      if (key === 'tonight' && dueAt.getTime() <= now.getTime()) dueAt.setDate(dueAt.getDate() + 1);
      return dueAt;
    },
  );
  if (relativeDay) return relativeDay;

  const nextWeek = candidate(
    source.match(/\bnext\s+week\b/i),
    () => {
      const dueAt = dateWithDefaultPeriod(now, 'morning');
      dueAt.setDate(dueAt.getDate() + 7);
      return dueAt;
    },
  );
  if (nextWeek) return nextWeek;

  const monthDirective = candidate(
    source.match(/\b(?:(?<day>\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?<directive>this|next)\s+month|(?<directiveLeading>this|next)\s+month\s+(?<leadingDay>\d{1,2})(?:st|nd|rd|th)?)\b/i),
    (match) => {
      const day = Number(match.groups.day || match.groups.leadingDay);
      const directive = match.groups.directive || match.groups.directiveLeading || 'this';
      const month = now.getMonth() + (directive === 'next' ? 1 : 0);
      const year = now.getFullYear() + Math.floor(month / 12);
      return validDate(year, month % 12, day);
    },
  );
  if (monthDirective) return monthDirective;

  const monthNameFirst = candidate(
    source.match(new RegExp(`\\b(?<month>${MONTH_PATTERN})\\s+(?<day>\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(?:of\\s+)?(?<year>this\\s+year|next\\s+year|\\d{2,4}))?\\b`, 'i')),
    (match) => {
      const month = normalizeMonth(match.groups.month);
      const day = Number(match.groups.day);
      const explicitYear = Boolean(match.groups.year);
      const year = normalizeYear(match.groups.year || '', now);
      return finalizeCalendarDate(validDate(year, month, day), now, explicitYear);
    },
  );
  if (monthNameFirst) return monthNameFirst;

  const dayFirstMonthName = candidate(
    source.match(new RegExp(`\\b(?<day>\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?<month>${MONTH_PATTERN})(?:\\s+(?:of\\s+)?(?<year>this\\s+year|next\\s+year|\\d{2,4}))?\\b`, 'i')),
    (match) => {
      const month = normalizeMonth(match.groups.month);
      const day = Number(match.groups.day);
      const explicitYear = Boolean(match.groups.year);
      const year = normalizeYear(match.groups.year || '', now);
      return finalizeCalendarDate(validDate(year, month, day), now, explicitYear);
    },
  );
  if (dayFirstMonthName) return dayFirstMonthName;

  const numericDate = candidate(
    source.match(/\b(?<first>\d{1,2})[/-](?<second>\d{1,2})(?:[/-](?<year>\d{2,4}))?\b/i),
    (match) => parseNumericCalendarDate([match[0], match.groups.first, match.groups.second, match.groups.year], now),
  );
  if (numericDate) return numericDate;

  const weekday = candidate(
    source.match(new RegExp(`\\b(?:(?<prefix>next|this)\\s+)?(?<weekday>${WEEKDAY_PATTERN})\\b`, 'i')),
    (match) => nextWeekdayDate(WEEKDAY_INDEX[match.groups.weekday], now, match.groups.prefix === 'next'),
  );
  if (weekday) return weekday;

  const naturalPeriod = candidate(
    source.match(/\b(?:in\s+(?:the\s+)?)?(?<period>morning|afternoon|evening|night)\b/i),
    (match) => {
      const dueAt = dateWithDefaultPeriod(now, match.groups.period);
      if (dueAt.getTime() <= now.getTime()) dueAt.setDate(dueAt.getDate() + 1);
      return dueAt;
    },
  );
  if (naturalPeriod) return naturalPeriod;

  return null;
};

const removeFirstPhrase = (value, phrase) => {
  if (!phrase) return value;
  const escaped = String(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(value || '').replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'i'), ' ');
};

const cleanReminderMessage = (value, kind) => {
  const cleaned = cleanText(value)
    .replace(/\b(?:please\s+)?(?:remind|notify|alert)\s+me\s*$/i, ' ')
    .replace(/\b(?:please\s+)?(?:remind|notify|alert)\s+me\b/i, ' ')
    .replace(/\b(?:set|start|create|add|schedule)\s+(?:a\s+)?(?:new\s+|recurring\s+)?(?:timer|alarm|reminder)\b/i, ' ')
    .replace(/\b(?:daily|weekly)\s+(?:timer|alarm|reminder)\b/i, ' ')
    .replace(/^\s*(?:i\s+have|i'?ve\s+got|there\s+is|there'?s)\s+(?:a|an|the)?\s*/i, ' ')
    .replace(/^\s*(?:me|to|that|about|for|on|at|in|after|by|say|t)\b\s*/i, ' ')
    .replace(/^\s*(?:me|to|that|about|for|on|at|in|after|by|say|t)\b\s*/i, ' ')
    .replace(/^\s*(?:a|an|the)\s+(?=(?:meeting|class|appointment|call|exam|event|lecture|interview|deadline|conference|session)\b)/i, ' ')
    .replace(/\s+(?:me|to|that|about|for|on|at|in|after|by|say|t)$/i, ' ')
    .replace(/[.?!]+$/g, '')
    .trim();
  if (!cleaned || /^(?:me|myself|remind|reminder|alarm|timer|today|tomorrow|tonight|am|pm)$/i.test(cleaned)) {
    return kind === 'Alarm' ? 'Alarm' : kind === 'Timer' ? 'Timer' : 'Reminder';
  }
  return cleaned;
};

const parseRecurrence = (value) => {
  const text = cleanText(value).toLowerCase();
  const simple = (pattern, recurrence) => {
    const match = text.match(pattern);
    return match ? { recurrence, phrase: match[0], index: match.index || 0 } : null;
  };
  const everyMatch = text.match(/\bevery\s+(.+)$/i);
  if (everyMatch?.[1]) {
    const tokens = everyMatch[1]
      .replace(/[,&/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
    const days = [];
    const phraseParts = ['every'];
    for (const token of tokens) {
      if (WEEKDAY_INDEX[token] !== undefined) {
        if (!days.includes(token)) days.push(token);
        phraseParts.push(token);
        continue;
      }
      if (['and', 'on'].includes(token) && days.length > 0) {
        phraseParts.push(token);
        continue;
      }
      break;
    }
    if (days.length > 0) {
      return {
        recurrence: `weekly:${days.join(',')}`,
        phrase: phraseParts.join(' '),
        index: everyMatch.index || 0,
      };
    }
  }
  const onDays = text.match(new RegExp(`\\bon\\s+(${WEEKDAY_PATTERN}(?:\\s*(?:,|and|/)\\s*${WEEKDAY_PATTERN})*)\\b`, 'i'));
  if (onDays?.[1]) {
    const days = onDays[1]
      .replace(/[,&/]+/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => WEEKDAY_INDEX[token] !== undefined);
    const explicitlyRepeating = /\b(?:every|weekly|recurring|repeat|repeating)\b/i.test(text);
    const multipleDays = days.length > 1 && /(?:,|and|\/)/i.test(onDays[1]);
    if (days.length > 0 && (explicitlyRepeating || multipleDays)) {
      return {
        recurrence: `weekly:${[...new Set(days)].join(',')}`,
        phrase: onDays[0],
        index: onDays.index || 0,
      };
    }
  }
  const hourly = simple(/\bevery\s+(?:one\s+)?hour\b|\bhourly\b/i, 'hourly');
  if (hourly) return hourly;
  const twoHourly = simple(/\bevery\s+(?:two|2)\s+hours?\b/i, 'every-2-hours');
  if (twoHourly) return twoHourly;
  const weekday = simple(/\bevery\s+weekdays?\b|\bon\s+weekdays?\b/i, 'weekday');
  if (weekday) return weekday;
  const weekend = simple(/\bevery\s+weekends?\b|\bon\s+weekends?\b/i, 'weekly:saturday,sunday');
  if (weekend) return weekend;
  const daily = text.match(/\bevery\s+(?:day|morning|evening|night)\b|\bdaily\b/i);
  if (daily) {
    const phrase = daily[0];
    return {
      recurrence: phrase.includes('morning')
        ? 'daily-morning'
        : phrase.includes('evening')
          ? 'daily-evening'
          : phrase.includes('night')
            ? 'daily-night'
            : 'daily',
      phrase,
      index: daily.index || 0,
    };
  }
  return simple(/\bevery\s+week\b|\bweekly\b/i, 'weekly');
};

const recurrenceWeekdays = (recurrence) => {
  const key = String(recurrence || '').toLowerCase().trim();
  if (!key.startsWith('weekly:')) return [];
  return key
    .slice('weekly:'.length)
    .split(',')
    .map((day) => WEEKDAY_INDEX[day.trim()])
    .filter((day) => Number.isInteger(day));
};

export const nextScheduleDueForRecurrence = (recurrence, previousDueAt, nowValue = Date.now()) => {
  const now = new Date(nowValue);
  const previous = new Date(previousDueAt || now);
  const from = Number.isFinite(previous.getTime()) ? previous : now;
  const key = String(recurrence || '').toLowerCase().trim();
  const weeklyDays = recurrenceWeekdays(key);
  if (weeklyDays.length > 0) {
    const next = new Date(Math.max(now.getTime(), from.getTime()));
    next.setSeconds(0, 0);
    next.setHours(from.getHours(), from.getMinutes(), 0, 0);
    next.setDate(next.getDate() + 1);
    for (let index = 0; index < 14; index += 1) {
      if (weeklyDays.includes(next.getDay()) && next.getTime() > now.getTime()) return next;
      next.setDate(next.getDate() + 1);
    }
    return next;
  }
  const next = new Date(Math.max(now.getTime(), from.getTime()));
  if (key === 'hourly' || key === 'every-2-hours') {
    next.setTime(next.getTime() + (key === 'hourly' ? 1 : 2) * 3600000);
    return next;
  }
  if (key === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next;
  }
  next.setDate(next.getDate() + 1);
  if (key.startsWith('weekday')) {
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  }
  if (key.includes('morning')) next.setHours(9, 0, 0, 0);
  else if (key.includes('evening')) next.setHours(18, 0, 0, 0);
  else if (key.includes('night')) next.setHours(21, 0, 0, 0);
  return next;
};

const alignRecurringDueDate = (recurrence, dueAt, nowValue = Date.now()) => {
  if (!(dueAt instanceof Date) || !Number.isFinite(dueAt.getTime())) return dueAt;
  const now = new Date(nowValue);
  const weeklyDays = recurrenceWeekdays(recurrence);
  if (weeklyDays.length === 0) {
    if (dueAt.getTime() > now.getTime()) return dueAt;
    return nextScheduleDueForRecurrence(recurrence, dueAt, now);
  }
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setHours(dueAt.getHours(), dueAt.getMinutes(), 0, 0);
  for (let index = 0; index < 14; index += 1) {
    if (weeklyDays.includes(candidate.getDay()) && candidate.getTime() > now.getTime()) return candidate;
    candidate.setDate(candidate.getDate() + 1);
  }
  return dueAt;
};

export const formatScheduleDue = (dueAt) => {
  const date = new Date(dueAt);
  if (!Number.isFinite(date.getTime())) return '';
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const tomorrowKey = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
  const day = dateKey === todayKey ? 'today' : dateKey === tomorrowKey ? 'tomorrow' : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${day} at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

export const parseMobileScheduleCommand = (input, nowValue = Date.now()) => {
  const original = normalizeScheduleInput(input);
  const text = original.toLowerCase();
  if (!/\b(timer|alarm|alarms|wake|remind|reminder|reminders|notify|alert|remember)\b/.test(text)) return null;

  const now = new Date(nowValue);
  const durationMatch = text.match(new RegExp(`\\b(?:for|in|after)\\s+(${AMOUNT_PATTERN})\\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\\b`));
  const clockMatch = findClockExpression(text);
  const recurrenceMatch = parseRecurrence(text);
  const dateMatch = findDateExpression(text, now, recurrenceMatch);
  const eveningContext = /\b(?:evening|night|tonight)\b/.test(text);
  const morningContext = /\bmorning\b/.test(text);
  let dueAt = null;
  let durationMinutes = 0;

  if (durationMatch) {
    const amount = amountFromText(durationMatch[1]);
    if (!amount) return null;
    const unit = durationMatch[2];
    durationMinutes = unit.startsWith('hour') || unit.startsWith('hr')
      ? amount * 60
      : unit.startsWith('second') || unit.startsWith('sec')
        ? Math.max(1, Math.ceil(amount / 60))
        : amount;
    dueAt = new Date(now.getTime() + durationMinutes * 60000);
  } else if (clockMatch) {
    const parts = parseClockParts(clockMatch.value);
    if (!parts) return null;
    dueAt = new Date(dateMatch?.date || now);
    dueAt.setSeconds(0, 0);
    let hours = parts.hours;
    if (!parts.period && hours >= 1 && hours <= 11 && eveningContext) hours += 12;
    if (!parts.period && hours === 12 && morningContext) hours = 0;
    dueAt.setHours(hours, parts.minutes, 0, 0);
    if (!dateMatch && dueAt.getTime() <= now.getTime()) dueAt.setDate(dueAt.getDate() + 1);
    if (dateMatch?.kind === 'today' && dueAt.getTime() <= now.getTime()) dueAt.setDate(dueAt.getDate() + 1);
  } else if (dateMatch) {
    dueAt = new Date(dateMatch.date);
  } else if (recurrenceMatch?.recurrence) {
    dueAt = new Date(now);
    dueAt.setSeconds(0, 0);
    if (recurrenceMatch.recurrence.includes('morning')) dueAt.setHours(9, 0, 0, 0);
    else if (recurrenceMatch.recurrence.includes('evening')) dueAt.setHours(18, 0, 0, 0);
    else if (recurrenceMatch.recurrence.includes('night')) dueAt.setHours(21, 0, 0, 0);
    else dueAt.setHours(9, 0, 0, 0);
  }

  if (!dueAt || !Number.isFinite(dueAt.getTime())) return null;
  if (recurrenceMatch?.recurrence && !durationMatch) {
    dueAt = alignRecurringDueDate(recurrenceMatch.recurrence, dueAt, now);
  }

  const kind = /\b(?:alarms?|wake\s+me)\b/.test(text)
    ? 'Alarm'
    : /\btimers?\b/.test(text)
      ? 'Timer'
      : 'Reminder';
  let reminderText = original;
  [
    recurrenceMatch?.phrase,
    durationMatch?.[0],
    clockMatch?.phrase,
    dateMatch?.phrase,
  ].filter(Boolean).forEach((phrase) => {
    reminderText = removeFirstPhrase(reminderText, phrase);
  });
  reminderText = cleanReminderMessage(reminderText, kind);
  const message = kind === 'Timer'
    ? `Your ${durationMinutes || Math.max(1, Math.round((dueAt.getTime() - now.getTime()) / 60000))} minute timer is done.`
    : reminderText;

  return {
    kind,
    title: `OpenX ${kind}`,
    message,
    dueAt: dueAt.toISOString(),
    status: 'scheduled',
    category: kind.toLowerCase(),
    recurrence: kind === 'Timer' ? undefined : recurrenceMatch?.recurrence || undefined,
    source: 'mobile',
    metadata: {
      ...(durationMinutes > 0 ? { durationMinutes } : {}),
      ...(recurrenceMatch?.recurrence ? { recurrence: recurrenceMatch.recurrence } : {}),
      parsedFrom: original,
    },
  };
};
