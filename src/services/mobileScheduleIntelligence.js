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
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  sixty: 60,
});

const pad = (value) => String(value).padStart(2, '0');

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const AMOUNT_PATTERN = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:\\s*five)?|sixty)';
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

const amountFromText = (value) => {
  const normalized = String(value || '').toLowerCase().replace(/\s+/g, '');
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return NUMBER_WORDS[normalized] || 0;
};

const parseClockParts = (value) => {
  const match = cleanText(value).toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (hours > 23 || minutes > 59) return null;
  if (match[3] === 'pm' && hours < 12) hours += 12;
  if (match[3] === 'am' && hours === 12) hours = 0;
  return { hours, minutes };
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
    if (days.length > 0) {
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
  const original = cleanText(input);
  const text = original.toLowerCase();
  if (!/\b(timer|alarm|alarms|remind|reminder|reminders|notify|alert)\b/.test(text)) return null;

  const now = new Date(nowValue);
  const durationMatch = text.match(new RegExp(`\\b(?:for|in)\\s+(${AMOUNT_PATTERN})\\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\\b`));
  const clockMatch = text.match(/\b(?:at|for|by)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/);
  const recurrenceMatch = parseRecurrence(text);
  const tomorrow = /\btomorrow\b/.test(text);
  const today = /\btoday\b/.test(text);
  const tonight = /\btonight\b/.test(text);
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
    const parts = parseClockParts(clockMatch[1]);
    if (!parts) return null;
    dueAt = new Date(now);
    dueAt.setSeconds(0, 0);
    dueAt.setHours(parts.hours, parts.minutes, 0, 0);
    if (tomorrow || (!today && dueAt.getTime() <= now.getTime())) dueAt.setDate(dueAt.getDate() + 1);
  } else if (tomorrow) {
    dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + 1);
    dueAt.setHours(9, 0, 0, 0);
  } else if (tonight) {
    dueAt = new Date(now);
    dueAt.setHours(21, 0, 0, 0);
    if (dueAt.getTime() <= now.getTime()) dueAt.setDate(dueAt.getDate() + 1);
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

  const kind = /\balarms?\b/.test(text)
    ? 'Alarm'
    : /\btimers?\b/.test(text)
      ? 'Timer'
      : 'Reminder';
  const reminderText = original
    .replace(/\b(?:please\s+)?(?:remind|notify|alert)\s+me\s+(?:(?:to|about|that)\b)?\s*/i, '')
    .replace(/\b(?:set|start|create|add|schedule)\s+(?:a\s+)?(?:new\s+)?(?:timer|alarm|reminder)\s*/i, '')
    .replace(/\b(?:daily|weekly)\s+(?:timer|alarm|reminder)\s*/i, '')
    .replace(recurrenceMatch?.phrase ? new RegExp(`\\b${recurrenceMatch.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') : /$^/, '')
    .replace(new RegExp(`\\b(?:for|in)\\s+${AMOUNT_PATTERN}\\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?)\\b`, 'i'), '')
    .replace(/\b(?:at|for|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, '')
    .replace(/\b(?:today|tomorrow|tonight)\b/i, '')
    .replace(/^\s*(?:to|about|that|for|on)\s+/i, '')
    .replace(/^\s*(?:set|start|create|add|schedule)\s+(?:to\s+)?/i, '')
    .replace(/\btomorrow\b/i, '')
    .trim();
  const message = kind === 'Timer'
    ? `Your ${durationMinutes || Math.max(1, Math.round((dueAt.getTime() - now.getTime()) / 60000))} minute timer is done.`
    : (reminderText || (kind === 'Alarm' ? 'Alarm' : 'Reminder'));

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
