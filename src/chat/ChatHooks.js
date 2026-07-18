import { useChatContext } from './ChatProvider';

/**
 * Returns Mobile Chat health state.
 * @returns {object} Health state.
 */
export function useChatHealth() {
  return useChatContext().health;
}

/**
 * Returns Mobile Chat actions.
 * @returns {object} Chat actions.
 */
export function useChatActions() {
  const { connect, disconnect } = useChatContext();
  return { connect, disconnect };
}

export default { useChatHealth, useChatActions };
