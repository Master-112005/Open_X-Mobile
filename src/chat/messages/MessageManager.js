import { CryptoManager } from '../crypto';
import MessageConfiguration from './MessageConfiguration';
import MessageEvents from './MessageEvents';
import MessageLogger from './MessageLogger';
import MessageClient from './MessageClient';
import MessageValidation from './MessageValidation';
import CompressionManager from './CompressionManager';
import MessageStorage from './MessageStorage';
import MessagePipeline from './MessagePipeline';
import MessageRouter from './MessageRouter';
import AcknowledgementManager from './AcknowledgementManager';
import RetryManager from './RetryManager';
import TypingManager from './TypingManager';

/**
 * Mobile Phase 8 encrypted one-to-one messaging facade.
 */
export class MessageManager {
  /**
   * Creates message manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof MessageConfiguration ? options.config : new MessageConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new MessageLogger();
    this.crypto = options.crypto || new CryptoManager(options.cryptoConfig || {});
    this.client = options.client || new MessageClient({ config: this.config, fetchImpl: options.fetchImpl });
    this.validation = options.validation || new MessageValidation({ config: this.config });
    this.compression = options.compression || new CompressionManager({ config: this.config });
    this.storage = options.storageManager || new MessageStorage({ config: this.config, storage: options.storage });
    this.pipeline = options.pipeline || new MessagePipeline({
      config: this.config,
      crypto: this.crypto,
      validation: this.validation,
      compression: this.compression,
      sessionResolver: options.sessionResolver,
    });
    this.router = options.router || new MessageRouter({
      client: this.client,
      connectionManager: options.connectionManager,
      storage: this.storage,
    });
    this.acknowledgement = options.acknowledgement || new AcknowledgementManager({
      client: this.client,
      mailboxManager: options.mailboxManager,
      storage: this.storage,
      eventBus: this.eventBus,
      events: MessageEvents,
    });
    this.retry = options.retry || new RetryManager({
      config: this.config,
      client: this.client,
      router: this.router,
      storage: this.storage,
      eventBus: this.eventBus,
      events: MessageEvents,
    });
    this.typing = options.typing || new TypingManager({
      client: this.client,
      connectionManager: options.connectionManager,
      eventBus: this.eventBus,
      events: MessageEvents,
    });
    this.synchronizationManager = options.synchronizationManager;
  }

  /**
   * Initializes crypto and message storage.
   */
  async initialize() {
    await this.crypto.initialize?.();
    await this.storage.initialize();
  }

  /** @param {object} input Input. @returns {Promise<object>} Send result. */
  sendText(input = {}) { return this.send({ ...input, messageType: 'Text' }); }

  /** @param {object} input Input. @returns {Promise<object>} Send result. */
  sendEmoji(input = {}) { return this.send({ ...input, messageType: 'Emoji' }); }

  /**
   * Sends encrypted message.
   * @param {object} input Input.
   * @returns {Promise<object>} Result.
   */
  async send(input = {}) {
    await this.initialize();
    const message = await this.pipeline.createEncryptedMessage(input);
    await this.storage.upsertMessage(message);
    this.eventBus?.emit?.(MessageEvents.MESSAGE_ENCRYPTED, { messageId: message.messageId });
    const delivery = await this.router.route(message);
    this.eventBus?.emit?.(MessageEvents.MESSAGE_SENT, { messageId: message.messageId, delivery });
    return { message, delivery };
  }

  /**
   * Receives encrypted envelope.
   * @param {object} input Input.
   * @returns {Promise<object>} Result.
   */
  async receiveEnvelope(input = {}) {
    await this.initialize();
    const result = await this.pipeline.receiveEncryptedEnvelope(input);
    await this.storage.upsertMessage(result.message);
    this.eventBus?.emit?.(MessageEvents.MESSAGE_RECEIVED, { messageId: result.message.messageId });
    return result;
  }

  /**
   * Syncs mailbox and processes envelopes.
   * @param {object} input Input.
   * @returns {Promise<object>} Sync result.
   */
  async syncMailbox(input = {}) {
    const synchronizationManager = input.synchronizationManager || this.synchronizationManager;
    if (synchronizationManager?.synchronize) return synchronizationManager.synchronize(input);
    const sync = await this.acknowledgement.mailboxManager.sync(input);
    const received = [];
    for (const envelope of sync.envelopes || []) received.push(await this.receiveEnvelope({ ...input, envelope }));
    if (sync.envelopes?.length) {
      await this.acknowledgement.acknowledgeMailbox({
        deviceId: input.deviceId,
        highestContiguousSequence: Math.max(...sync.envelopes.map((envelope) => envelope.mailboxSequence)),
      });
    }
    return { sync, received };
  }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  acknowledge(input = {}) { return this.acknowledgement.acknowledge(input); }

  /** @param {object} input Input. @returns {Promise<object>} Result. */
  markRead(input = {}) { return this.acknowledgement.markRead(input); }

  /** @param {object} input Input. @returns {Promise<object|boolean>} Result. */
  typingStart(input = {}) { return this.typing.start(input); }

  /** @param {object} input Input. @returns {Promise<object|boolean>} Result. */
  typingStop(input = {}) { return this.typing.stop(input); }
}

export default MessageManager;
