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
  if (!/\b(timer|alarm|remind|reminder)\b/.test(text)) return null;

  const now = new Date(nowValue);
  const durationMatch = text.match(new RegExp(`\\b(?:for|in)\\s+(${AMOUNT_PATTERN})\\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\\b`));
  const clockMatch = text.match(/\b(?:at|for)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/);
  const tomorrow = /\btomorrow\b/.test(text);
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
    if (tomorrow || dueAt.getTime() <= now.getTime()) dueAt.setDate(dueAt.getDate() + 1);
  } else if (tomorrow) {
    dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + 1);
    dueAt.setHours(9, 0, 0, 0);
  }

  if (!dueAt || !Number.isFinite(dueAt.getTime())) return null;

  const kind = /\balarm\b/.test(text)
    ? 'Alarm'
    : /\btimer\b/.test(text)
      ? 'Timer'
      : 'Reminder';
  const reminderText = original
    .replace(/\b(?:please\s+)?remind\s+me\s+(?:to|about|that)?\s*/i, '')
    .replace(/\b(?:set|start|create|add)\s+(?:a\s+)?(?:timer|alarm|reminder)\s*/i, '')
    .replace(new RegExp(`\\b(?:for|in)\\s+${AMOUNT_PATTERN}\\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?)\\b`, 'i'), '')
    .replace(/\b(?:at|for)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, '')
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
    source: 'mobile',
    metadata: durationMinutes > 0 ? { durationMinutes, parsedFrom: original } : { parsedFrom: original },
  };
};
