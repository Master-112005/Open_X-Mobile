import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_STORAGE_ROOT = '@openx-chat';

/**
 * Mobile Chat storage abstraction for future tables.
 */
export class ChatStorage {
  /**
   * Creates storage abstraction.
   * @param {object} options Storage options.
   */
  constructor(options = {}) {
    this.rootKey = options.rootKey || CHAT_STORAGE_ROOT;
    this.initializedKey = `${this.rootKey}/initialized`;
    this.schemaKey = `${this.rootKey}/schema`;
  }

  /**
   * Initializes the storage namespace without creating chat data.
   * @returns {Promise<object>} Storage metadata.
   */
  async initialize() {
    const metadata = {
      initialized: true,
      schemaVersion: 1,
      tables: {
        conversations: 'phase13-local-state',
        conversationMetadata: 'phase13-local-state',
        conversationIndex: 'phase13-local-state',
        pinnedChats: 'phase13-local-state',
        archivedChats: 'phase13-local-state',
        mutedChats: 'phase13-local-state',
        deletedChats: 'phase13-local-state',
        searchIndex: 'phase13-local-state',
        conversationHistory: 'phase13-local-state',
        localStatistics: 'phase13-local-state',
        futureFolders: 'phase13-placeholder',
        contacts: 'future',
        messages: 'phase8-local-encrypted',
        messageStatus: 'phase8-local-state',
        readState: 'phase8-local-state',
        retryQueue: 'phase8-local-state',
        typingState: 'phase8-ephemeral',
        compressionMetadata: 'phase8-local-state',
        mailbox: 'phase7-server-side',
        mailboxSequences: 'phase7-local-state',
        synchronizationCursors: 'phase9-local-state',
        acknowledgementHistory: 'phase9-local-state',
        recoveryHistory: 'phase9-local-state',
        syncRetryQueue: 'phase9-local-state',
        conflictLog: 'phase9-local-state',
        sequenceState: 'phase9-local-state',
        multiDeviceAccounts: 'phase10-local-state',
        deviceSynchronization: 'phase10-local-state',
        synchronizationCopies: 'phase10-local-state',
        deviceConsistency: 'phase10-local-state',
        deviceQueues: 'phase10-local-state',
        routingHistory: 'phase10-local-state',
        connectionState: 'phase11-local-state',
        sessionState: 'phase11-local-state',
        pushTokens: 'phase11-local-state',
        presenceState: 'phase11-local-state',
        recoveryHistory: 'phase11-local-state',
        connectionHistory: 'phase11-local-state',
        wakeHistory: 'phase11-local-state',
        futurePushMetadata: 'phase11-local-state',
        fileTransfers: 'phase12-local-state',
        encryptedTempFiles: 'phase12-local-state',
        decryptedFiles: 'phase12-local-state',
        thumbnailCache: 'phase12-local-state',
        transferAudit: 'phase12-local-state',
        registrationPins: 'phase14-secure-server-state',
        trustedDevices: 'phase14-local-cache',
        recoveryRequests: 'phase14-server-state',
        sessionHistory: 'phase14-local-state',
        loginHistory: 'phase14-local-cache',
        securityAudit: 'phase14-server-state',
        securityPolicies: 'phase14-local-cache',
        threatEvents: 'phase14-server-state',
        identityWarnings: 'phase14-local-cache',
        revocationHistory: 'phase14-server-state',
      },
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.multiSet([
      [this.initializedKey, 'true'],
      [this.schemaKey, JSON.stringify(metadata)],
    ]);
    return metadata;
  }

  /**
   * Returns storage metadata.
   * @returns {Promise<object|null>} Storage metadata or null.
   */
  async getMetadata() {
    const value = await AsyncStorage.getItem(this.schemaKey);
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      await AsyncStorage.removeItem(this.schemaKey);
      return null;
    }
  }
}

export default ChatStorage;
