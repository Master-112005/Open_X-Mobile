import { parseIntentPhrase, splitCommandClauses } from './desktopLanguageAnalysis';
import { parseMobileScheduleCommand } from './mobileScheduleIntelligence';

export function routeMobileCommand(input, nowValue = Date.now()) {
  const command = String(input || '').trim();
  if (!command) return { route: 'empty', command, clauses: [] };

  const clauses = splitCommandClauses(command);
  const intentPhrase = parseIntentPhrase(command);
  const schedule = clauses.length === 1
    ? parseMobileScheduleCommand(command, nowValue)
    : null;

  return schedule
    ? { route: 'local-schedule', command, clauses, intentPhrase, schedule }
    : { route: 'desktop', command, clauses, intentPhrase };
}
