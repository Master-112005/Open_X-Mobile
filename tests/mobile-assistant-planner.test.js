const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const appConfig = require('../app.config');

function loadPlanner() {
  const sourcePath = path.resolve(__dirname, '..', 'src', 'services', 'mobileAssistantPlanner.js');
  const source = fs.readFileSync(sourcePath, 'utf8').replace(/export function /g, 'function ');
  return new Function(`${source}; return { buildMobileSchedulePrompt, validateMobileScheduleReply };`)();
}

test('mobile LLM schedule interpretation only accepts an exact trusted schedule', () => {
  const { buildMobileSchedulePrompt, validateMobileScheduleReply } = loadPlanner();
  const expected = { kind: 'Reminder', message: 'drink water', dueAt: '2026-10-02T12:00:00.000Z', recurrence: null };
  const encoded = JSON.stringify(expected);
  assert.match(buildMobileSchedulePrompt('remind me in one minute to drink water', expected), /Trusted candidate/);
  assert.equal(validateMobileScheduleReply(encoded, expected), true);
  assert.equal(validateMobileScheduleReply(JSON.stringify({ ...expected, message: 'drink coffee' }), expected), false);
  assert.equal(validateMobileScheduleReply(JSON.stringify({ ...expected, dueAt: '2026-10-02T12:01:00.000Z' }), expected), false);
  assert.equal(validateMobileScheduleReply('not JSON', expected), false);
});

test('mobile build includes the local model runtime and exact Android reminders', () => {
  const expo = appConfig.expo;
  assert.equal(expo.newArchEnabled, true);
  assert.ok(expo.plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === 'llama.rn'));
  assert.ok(expo.android.permissions.includes('android.permission.SCHEDULE_EXACT_ALARM'));
  assert.equal(fs.statSync(path.resolve(__dirname, '..', '..', 'Llama-3.2-1B', 'Llama-3.2-1B-Instruct-Q4_K_M.gguf')).size, 807694464);
});
