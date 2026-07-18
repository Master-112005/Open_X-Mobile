import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import ChatManager from './ChatManager';

const ChatContext = createContext(null);

/**
 * Provides Mobile Chat architecture dependencies to future UI without rendering chat UI.
 * @param {object} props Provider props.
 * @returns {React.ReactElement} Provider element.
 */
export function ChatProvider({ children, managerOptions = {} }) {
  const manager = useMemo(() => new ChatManager(managerOptions), [managerOptions]);
  const [health, setHealth] = useState(manager.getHealth());

  useEffect(() => {
    let mounted = true;
    manager.start().then(() => {
      if (mounted) setHealth(manager.getHealth());
    }).catch((error) => {
      manager.logger.warn('Mobile Chat provider start failed', { error: error.message });
    });
    const unsubscribe = manager.on(ChatManager.Events.HEALTH_CHANGED, () => {
      if (mounted) setHealth(manager.getHealth());
    });
    return () => {
      mounted = false;
      unsubscribe();
      manager.stop();
    };
  }, [manager]);

  return React.createElement(ChatContext.Provider, {
    value: {
      manager,
      health,
      connect: () => manager.connect(),
      disconnect: () => manager.disconnect(),
    },
  }, children);
}

/**
 * Reads the Mobile Chat context.
 * @returns {object} Chat context.
 */
export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChatContext must be used inside ChatProvider.');
  return context;
}

export default ChatProvider;
