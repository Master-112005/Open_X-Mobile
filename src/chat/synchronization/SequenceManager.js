/**
 * Mobile sequence validation and contiguous ACK calculation.
 */
export class SequenceManager {
  /** @param {object[]} envelopes Envelopes. @returns {object[]} Sorted envelopes. */
  sort(envelopes = []) {
    return [...envelopes].sort((a, b) => Number(a.mailboxSequence || 0) - Number(b.mailboxSequence || 0));
  }

  /** @param {object[]} envelopes Envelopes. @param {number} afterSequence Start sequence. @returns {object[]} Gaps. */
  detectGaps(envelopes = [], afterSequence = 0) {
    const gaps = [];
    let expected = Number(afterSequence || 0) + 1;
    for (const envelope of this.sort(envelopes)) {
      const sequence = Number(envelope.mailboxSequence || 0);
      if (sequence > expected) gaps.push({ from: expected, to: sequence - 1 });
      if (sequence >= expected) expected = sequence + 1;
    }
    return gaps;
  }

  /** @param {number[]} sequences Applied sequences. @param {number} afterSequence Start sequence. @returns {number} Highest contiguous sequence. */
  highestContiguous(sequences = [], afterSequence = 0) {
    const sorted = [...new Set(sequences.map(Number))].sort((a, b) => a - b);
    let current = Number(afterSequence || 0);
    for (const sequence of sorted) {
      if (sequence === current + 1) current = sequence;
      else if (sequence > current + 1) break;
    }
    return current;
  }
}

export default SequenceManager;
