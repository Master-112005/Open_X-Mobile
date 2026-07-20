const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

function loadScheduleIntelligence() {
  const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'mobileScheduleIntelligence.js');
  const source = fs.readFileSync(sourcePath, 'utf8').replace(/export const /g, 'const ');
  return new Function(`${source}; return { parseMobileScheduleCommand, nextScheduleDueForRecurrence };`)();
}

test('mobile NLP parses weekly multi-day reminder commands', () => {
  const { parseMobileScheduleCommand } = loadScheduleIntelligence();
  const now = new Date('2026-07-13T12:00:00+05:30').getTime();
  const parsed = parseMobileScheduleCommand('remind me every saturday monday to eat lunch at 8pm', now);

  assert.equal(parsed.kind, 'Reminder');
  assert.equal(parsed.message, 'eat lunch');
  assert.equal(parsed.recurrence, 'weekly:saturday,monday');
  assert.equal(parsed.metadata.recurrence, 'weekly:saturday,monday');
});

test('mobile NLP parses daily reminders and weekday alarms', () => {
  const { parseMobileScheduleCommand } = loadScheduleIntelligence();
  const now = new Date('2026-07-13T12:00:00+05:30').getTime();
  const reminder = parseMobileScheduleCommand('set daily reminder to drink water at 9 am', now);
  const alarm = parseMobileScheduleCommand('set alarm every weekday at 7:30 am to wake up', now);

  assert.equal(reminder.message, 'drink water');
  assert.equal(reminder.recurrence, 'daily');
  assert.equal(alarm.kind, 'Alarm');
  assert.equal(alarm.message, 'wake up');
  assert.equal(alarm.recurrence, 'weekday');
});

test('mobile NLP preserves space-separated PM clock minutes for reminders', () => {
  const { parseMobileScheduleCommand } = loadScheduleIntelligence();
  const now = new Date('2026-07-20T08:00:00+05:30').getTime();
  const parsed = parseMobileScheduleCommand('set reminder at 9 30 pm', now);

  assert.equal(parsed.kind, 'Reminder');
  assert.equal(parsed.message, 'Reminder');
  assert.equal(parsed.dueAt, '2026-07-20T16:00:00.000Z');
});

test('mobile NLP extracts reminder intent from trailing remind me wording', () => {
  const { parseMobileScheduleCommand } = loadScheduleIntelligence();
  const now = new Date('2026-07-20T08:00:00+05:30').getTime();
  const parsed = parseMobileScheduleCommand('i have a meeting at 6pm tomorrow remind me', now);

  assert.equal(parsed.kind, 'Reminder');
  assert.equal(parsed.message, 'meeting');
  assert.equal(parsed.dueAt, '2026-07-21T12:30:00.000Z');
});

test('mobile NLP parses spoken alarm and reminder clock phrases', () => {
  const { parseMobileScheduleCommand } = loadScheduleIntelligence();
  const now = new Date('2026-07-20T08:00:00+05:30').getTime();
  const alarm = parseMobileScheduleCommand('wake me up at six thirty am tomorrow', now);
  const reminder = parseMobileScheduleCommand('remind me to call rishi at nine thirty pm', now);

  assert.equal(alarm.kind, 'Alarm');
  assert.equal(alarm.dueAt, '2026-07-21T01:00:00.000Z');
  assert.equal(reminder.kind, 'Reminder');
  assert.equal(reminder.message, 'call rishi');
  assert.equal(reminder.dueAt, '2026-07-20T16:00:00.000Z');
});

test('mobile NLP parses desktop-style date and natural period reminder commands', () => {
  const { parseMobileScheduleCommand } = loadScheduleIntelligence();
  const now = new Date('2026-07-20T08:00:00+05:30').getTime();
  const morning = parseMobileScheduleCommand('remind me tomorrow morning to submit homework', now);
  const nextWeek = parseMobileScheduleCommand('set reminder next week to renew pass', now);
  const namedDate = parseMobileScheduleCommand('remind me on december 1 at five pm to pay rent', now);

  assert.equal(morning.kind, 'Reminder');
  assert.equal(morning.message, 'submit homework');
  assert.equal(morning.dueAt, '2026-07-21T03:30:00.000Z');
  assert.equal(nextWeek.message, 'renew pass');
  assert.equal(nextWeek.dueAt, '2026-07-27T03:30:00.000Z');
  assert.equal(namedDate.message, 'pay rent');
  assert.equal(namedDate.dueAt, '2026-12-01T11:30:00.000Z');
});

test('mobile NLP parses one-off weekday, after-duration, and half-past clock commands', () => {
  const { parseMobileScheduleCommand } = loadScheduleIntelligence();
  const now = new Date('2026-07-20T08:00:00+05:30').getTime();
  const weekday = parseMobileScheduleCommand('set alarm next monday at 7 15 am to wake up', now);
  const duration = parseMobileScheduleCommand('remind me to drink water after 45 minutes', now);
  const halfPast = parseMobileScheduleCommand('set alarm at half past six am tomorrow to wake up', now);

  assert.equal(weekday.kind, 'Alarm');
  assert.equal(weekday.message, 'wake up');
  assert.equal(weekday.recurrence, undefined);
  assert.equal(weekday.dueAt, '2026-07-27T01:45:00.000Z');
  assert.equal(duration.kind, 'Reminder');
  assert.equal(duration.message, 'drink water');
  assert.equal(duration.dueAt, '2026-07-20T03:15:00.000Z');
  assert.equal(halfPast.kind, 'Alarm');
  assert.equal(halfPast.message, 'wake up');
  assert.equal(halfPast.dueAt, '2026-07-21T01:00:00.000Z');
});

test('mobile NLP classifies plural alarm wording', () => {
  const { parseMobileScheduleCommand } = loadScheduleIntelligence();
  const now = new Date('2026-07-13T12:00:00+05:30').getTime();
  const alarm = parseMobileScheduleCommand('set alarms every day at 6 am', now);

  assert.equal(alarm.kind, 'Alarm');
  assert.equal(alarm.recurrence, 'daily');
});

test('mobile recurrence advances past the previous due time', () => {
  const { nextScheduleDueForRecurrence } = loadScheduleIntelligence();
  const now = new Date('2026-07-13T12:00:00+05:30').getTime();
  const next = nextScheduleDueForRecurrence('weekly:monday,saturday', '2026-07-13T20:00:00+05:30', now);

  assert.equal(next.toISOString(), '2026-07-18T14:30:00.000Z');
});
