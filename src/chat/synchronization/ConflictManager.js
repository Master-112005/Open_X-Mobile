/**
 * Mobile conflict detector for duplicate and out-of-order envelopes.
 */
export class ConflictManager {
  /** @param {object[]} envelopes Envelopes. @returns {object} Conflict summary. */
  detect(envelopes = []) {
    const seenSequences = new Set();
    const seenMessages = new Set();
    const duplicates = [];
    envelopes.forEach((envelope) => {
      const sequence = Number(envelope.mailboxSequence || 0);
      if (seenSequences.has(sequence)) duplicates.push({ type: 'sequence', sequence, envelopeId: envelope.envelopeId });
      seenSequences.add(sequence);
      if (seenMessages.has(envelope.messageId)) duplicates.push({ type: 'message', messageId: envelope.messageId, envelopeId: envelope.envelopeId });
      seenMessages.add(envelope.messageId);
    });
    const outOfOrder = envelopes.some((envelope, index) => index > 0 && Number(envelope.mailboxSequence || 0) < Number(envelopes[index - 1].mailboxSequence || 0));
    return { duplicateCount: duplicates.length, duplicates, outOfOrder };
  }
}

export default ConflictManager;
