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
