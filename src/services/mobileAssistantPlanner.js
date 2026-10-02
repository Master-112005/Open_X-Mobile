export function buildMobileSchedulePrompt(command, expected) {
  return [
    "Interpret the user's alarm, reminder, or timer using the trusted local schedule candidate below.",
    'Return only JSON with kind, message, dueAt, and recurrence. Preserve the candidate values exactly; do not invent or change any value.',
    `Trusted candidate: ${JSON.stringify({ kind: expected.kind, message: expected.message, dueAt: expected.dueAt, recurrence: expected.recurrence || null })}`,
    `User request: ${String(command || '').trim()}`,
  ].join('\n');
}

export function validateMobileScheduleReply(response, expected) {
  const text = String(response || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const value = JSON.parse(text);
    const sameMessage = String(value.message || '').trim().replace(/\s+/g, ' ').toLowerCase() ===
      String(expected.message || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const dueAt = new Date(value.dueAt).getTime();
    const expectedDueAt = new Date(expected.dueAt).getTime();
    return value.kind === expected.kind && sameMessage && dueAt === expectedDueAt &&
      (value.recurrence || null) === (expected.recurrence || null);
  } catch {
    return false;
  }
}
