/**
 * Mobile recovery helper for missing sequence gaps.
 */
export class RecoveryManager {
  /** @param {object[]} gaps Gaps. @returns {object} Recovery state. */
  inspect(gaps = []) {
    return { required: gaps.length > 0, status: gaps.length ? 'Required' : 'NotRequired', gaps };
  }
}

export default RecoveryManager;
