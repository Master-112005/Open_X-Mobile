import ChatConfiguration from './ChatConfiguration';
import ChatConnectionManager from './ChatConnectionManager';
import ChatEventBus from './ChatEventBus';
import ChatEvents from './ChatEvents';
import ChatHealth from './ChatHealth';
import ChatLifecycle from './ChatLifecycle';
import ChatLogger from './ChatLogger';
import ChatStatusManager from './ChatStatusManager';
import ChatStorage from './ChatStorage';
import ChatVersionManager from './ChatVersionManager';
import { DeviceManager } from './devices';
import { ContactDiscoveryManager } from './discovery';
import { MailboxManager } from './mailbox';
import { MessageManager } from './messages';
import { SynchronizationManager } from './synchronization';
import { MultiDeviceManager } from './multidevice';
import { ConnectionEngine } from './connection';
import { TransferManager } from './transfer';
import { ConversationManager } from './conversations';
import { SecurityManager } from './security';
import {
  BatteryOptimizer,
  ConnectionOptimizer,
  MemoryOptimizer,
  MetricsManager,
  MonitoringManager,
  PerformanceManager,
  StorageOptimizer,
  SynchronizationOptimizer,
} from './infrastructure';
import {
  CrashRecoveryManager,
  PerformanceReporter,
  ProductionValidator,
  QualityManager,
  ReleaseLogger,
} from './quality';
import {
  BlockManager,
  ContactRequestManager,
  NicknameManager,
  RequestConfiguration,
  RequestLogger,
  RequestService,
  RequestValidation,
  TrustManager,
} from './requests';

/**
 * Mobile Chat composition root.
 */
export class ChatManager {
  /**
   * Creates a Mobile Chat manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof ChatConfiguration
      ? options.config
      : new ChatConfiguration(options.config || {});
    this.logger = options.logger || new ChatLogger({ level: options.logLevel || 'info' });
    this.eventBus = options.eventBus || new ChatEventBus({ logger: this.logger });
    this.statusManager = new ChatStatusManager();
    this.versionManager = new ChatVersionManager({
      protocolVersion: this.config.protocolVersion,
      moduleVersion: options.moduleVersion || '0.1.0',
    });
    this.storage = options.storage || new ChatStorage(options.storageOptions || {});
    this.connectionManager = new ChatConnectionManager({
      config: this.config,
      logger: this.logger,
      eventBus: this.eventBus,
      statusManager: this.statusManager,
    });
    this.health = new ChatHealth({
      statusManager: this.statusManager,
      connectionManager: this.connectionManager,
      versionManager: this.versionManager,
    });
    this.lifecycle = new ChatLifecycle({
      eventBus: this.eventBus,
      statusManager: this.statusManager,
    });
    this.deviceManager = options.deviceManager || new DeviceManager({
      config: options.deviceConfig || {},
      eventBus: this.eventBus,
      logger: options.deviceLogger,
      fetchImpl: options.fetchImpl,
    });
    this.discoveryManager = options.discoveryManager || new ContactDiscoveryManager({
      config: options.discoveryConfig || {},
      eventBus: this.eventBus,
      logger: options.discoveryLogger,
      fetchImpl: options.fetchImpl,
    });
    const requestConfig = options.requestConfig instanceof RequestConfiguration
      ? options.requestConfig
      : new RequestConfiguration(options.requestConfig || {});
    const requestLogger = options.requestLogger || new RequestLogger();
    const requestValidator = options.requestValidator || new RequestValidation({ config: requestConfig });
    const requestService = options.requestService || new RequestService({ config: requestConfig, fetchImpl: options.fetchImpl });
    this.requestManager = options.requestManager || new ContactRequestManager({
      config: requestConfig,
      eventBus: this.eventBus,
      logger: requestLogger,
      validator: requestValidator,
      service: requestService,
    });
    this.trustManager = options.trustManager || new TrustManager({
      config: requestConfig,
      eventBus: this.eventBus,
      logger: requestLogger,
      validator: requestValidator,
      service: requestService,
    });
    this.blockManager = options.blockManager || new BlockManager({
      config: requestConfig,
      eventBus: this.eventBus,
      logger: requestLogger,
      validator: requestValidator,
      service: requestService,
    });
    this.nicknameManager = options.nicknameManager || new NicknameManager({
      config: requestConfig,
      eventBus: this.eventBus,
      logger: requestLogger,
      validator: requestValidator,
    });
    this.mailboxManager = options.mailboxManager || new MailboxManager({
      config: options.mailboxConfig || {},
      eventBus: this.eventBus,
      logger: options.mailboxLogger,
      fetchImpl: options.fetchImpl,
      storage: options.storage,
    });
    this.messageManager = options.messageManager || new MessageManager({
      config: options.messageConfig || {},
      eventBus: this.eventBus,
      logger: options.messageLogger,
      fetchImpl: options.fetchImpl,
      connectionManager: this.connectionManager,
      mailboxManager: this.mailboxManager,
      crypto: options.cryptoManager,
      cryptoConfig: options.cryptoConfig || {},
      storage: options.storage,
      sessionResolver: options.sessionResolver,
    });
    this.synchronizationManager = options.synchronizationManager || new SynchronizationManager({
      config: options.synchronizationConfig || {},
      eventBus: this.eventBus,
      logger: options.synchronizationLogger,
      fetchImpl: options.fetchImpl,
      storage: options.storage,
      messageManager: this.messageManager,
    });
    this.messageManager.synchronizationManager = this.synchronizationManager;
    this.multiDeviceManager = options.multiDeviceManager || new MultiDeviceManager({
      config: options.multiDeviceConfig || {},
      eventBus: this.eventBus,
      logger: options.multiDeviceLogger,
      fetchImpl: options.fetchImpl,
      storage: options.storage,
    });
    this.connectionEngine = options.connectionEngine || new ConnectionEngine({
      config: options.connectionConfig || {},
      connectionManager: this.connectionManager,
      synchronizationManager: this.synchronizationManager,
      eventBus: this.eventBus,
      logger: options.connectionLogger,
      fetchImpl: options.fetchImpl,
      tokenProvider: options.pushTokenProvider,
      networkProvider: options.networkProvider,
    });
    this.eventBus.on('connection:identified', (event) => this.connectionEngine.acceptSession(event));
    this.transferManager = options.transferManager || new TransferManager({
      config: options.transferConfig || {},
      eventBus: this.eventBus,
      logger: options.transferLogger,
      fetchImpl: options.fetchImpl,
      crypto: options.cryptoManager,
      cryptoConfig: options.cryptoConfig || {},
    });
    this.conversationManager = options.conversationManager || new ConversationManager({
      config: options.conversationConfig || {},
      eventBus: this.eventBus,
      logger: options.conversationLogger,
    });
    this.securityManager = options.securityManager || new SecurityManager({
      config: options.securityConfig || {},
      eventBus: this.eventBus,
      logger: options.securityLogger,
      fetchImpl: options.fetchImpl,
    });
    this.metricsManager = options.metricsManager || new MetricsManager({
      eventBus: this.eventBus,
      maxSamples: this.config.optimization.maxMetricSamples,
    });
    this.performanceManager = options.performanceManager || new PerformanceManager({
      metrics: this.metricsManager,
      eventBus: this.eventBus,
      slowOperationMs: this.config.optimization.slowOperationMs,
    });
    this.batteryOptimizer = options.batteryOptimizer || new BatteryOptimizer({
      eventBus: this.eventBus,
      lowBatteryThreshold: this.config.optimization.lowBatteryThreshold,
    });
    this.connectionOptimizer = options.connectionOptimizer || new ConnectionOptimizer({
      config: this.config,
      eventBus: this.eventBus,
    });
    this.storageOptimizer = options.storageOptimizer || new StorageOptimizer({
      eventBus: this.eventBus,
      maxRecords: this.config.optimization.maxLocalRecords,
    });
    this.memoryOptimizer = options.memoryOptimizer || new MemoryOptimizer({
      eventBus: this.eventBus,
      heapWarningBytes: this.config.optimization.heapWarningBytes,
    });
    this.synchronizationOptimizer = options.synchronizationOptimizer || new SynchronizationOptimizer({
      eventBus: this.eventBus,
      battery: this.batteryOptimizer,
      defaultBatchSize: this.config.optimization.defaultSyncBatchSize,
      maxBatchSize: this.config.optimization.maxSyncBatchSize,
    });
    this.monitoringManager = options.monitoringManager || new MonitoringManager({
      metrics: this.metricsManager,
      performance: this.performanceManager,
      battery: this.batteryOptimizer,
      connection: this.connectionOptimizer,
      storage: this.storageOptimizer,
      memory: this.memoryOptimizer,
      synchronization: this.synchronizationOptimizer,
    });
    this.infrastructureOptimization = Object.freeze({
      metrics: this.metricsManager,
      performance: this.performanceManager,
      battery: this.batteryOptimizer,
      connection: this.connectionOptimizer,
      storage: this.storageOptimizer,
      memory: this.memoryOptimizer,
      synchronization: this.synchronizationOptimizer,
      monitoring: this.monitoringManager,
    });
    this.releaseLogger = options.releaseLogger || new ReleaseLogger({
      maxEntries: this.config.optimization.maxReleaseLogEntries,
    });
    this.crashRecoveryManager = options.crashRecoveryManager || new CrashRecoveryManager({
      eventBus: this.eventBus,
      releaseLogger: this.releaseLogger,
    });
    this.performanceReporter = options.performanceReporter || new PerformanceReporter({
      metrics: this.metricsManager,
      performance: this.performanceManager,
      monitoring: this.monitoringManager,
      battery: this.batteryOptimizer,
      benchmarks: options.productionBenchmarks,
    });
    this.productionValidator = options.productionValidator || new ProductionValidator({
      config: this.config,
      healthProvider: () => this.getHealth(),
      infrastructure: this.infrastructureOptimization,
      crashRecovery: this.crashRecoveryManager,
      performanceReporter: this.performanceReporter,
    });
    this.qualityManager = options.qualityManager || new QualityManager({
      productionValidator: this.productionValidator,
      performanceReporter: this.performanceReporter,
      crashRecovery: this.crashRecoveryManager,
      releaseLogger: this.releaseLogger,
    });
    this.productionReadiness = Object.freeze({
      quality: this.qualityManager,
      validator: this.productionValidator,
      performance: this.performanceReporter,
      crashRecovery: this.crashRecoveryManager,
      releaseLogger: this.releaseLogger,
    });
  }

  /**
   * Starts Mobile Chat architecture and initializes storage namespace.
   * @returns {Promise<object>} Storage metadata.
   */
  async start() {
    this.lifecycle.start();
    const storage = await this.storage.initialize();
    const device = await this.deviceManager.start();
    return { storage, device };
  }

  /**
   * Stops Mobile Chat architecture.
   */
  stop() {
    this.connectionManager.disconnect();
    this.lifecycle.stop();
  }

  /**
   * Connects the Mobile Chat connection layer.
   * @returns {Promise<object>} Connection status.
   */
  connect() {
    return this.connectionManager.connect();
  }

  /**
   * Disconnects the Mobile Chat connection layer.
   */
  disconnect() {
    this.connectionManager.disconnect();
  }

  /**
   * Registers an event listener.
   * @param {string} eventName Event name.
   * @param {Function} listener Listener function.
   * @returns {Function} Unsubscribe function.
   */
  on(eventName, listener) {
    return this.eventBus.on(eventName, listener);
  }

  /**
   * Returns health snapshot.
   * @returns {object} Health snapshot.
   */
  getHealth() {
    return {
      ...this.health.getHealth(),
      infrastructure: this.monitoringManager.getStatus(),
    };
  }

  /**
   * Returns the trusted device manager.
   * @returns {DeviceManager} Device manager.
   */
  getDeviceManager() {
    return this.deviceManager;
  }

  /**
   * Returns the contact discovery manager.
   * @returns {ContactDiscoveryManager} Contact discovery manager.
   */
  getDiscoveryManager() {
    return this.discoveryManager;
  }

  /**
   * Returns the contact request manager.
   * @returns {ContactRequestManager} Request manager.
   */
  getRequestManager() {
    return this.requestManager;
  }

  /**
   * Returns the trust manager.
   * @returns {TrustManager} Trust manager.
   */
  getTrustManager() {
    return this.trustManager;
  }

  /**
   * Returns the block manager.
   * @returns {BlockManager} Block manager.
   */
  getBlockManager() {
    return this.blockManager;
  }

  /**
   * Returns the private nickname manager.
   * @returns {NicknameManager} Nickname manager.
   */
  getNicknameManager() {
    return this.nicknameManager;
  }

  /**
   * Returns encrypted mailbox manager.
   * @returns {MailboxManager} Mailbox manager.
   */
  getMailboxManager() {
    return this.mailboxManager;
  }

  /**
   * Returns encrypted message manager.
   * @returns {MessageManager} Message manager.
   */
  getMessageManager() {
    return this.messageManager;
  }

  /**
   * Returns reliable synchronization manager.
   * @returns {SynchronizationManager} Synchronization manager.
   */
  getSynchronizationManager() {
    return this.synchronizationManager;
  }

  /**
   * Returns multi-device manager.
   * @returns {MultiDeviceManager} Multi-device manager.
   */
  getMultiDeviceManager() {
    return this.multiDeviceManager;
  }

  /**
   * Returns connection and presence engine.
   * @returns {ConnectionEngine} Connection engine.
   */
  getConnectionEngine() {
    return this.connectionEngine;
  }

  /**
   * Returns encrypted file-transfer manager.
   * @returns {TransferManager} Transfer manager.
   */
  getTransferManager() {
    return this.transferManager;
  }

  /**
   * Returns local conversation manager.
   * @returns {ConversationManager} Conversation manager.
   */
  getConversationManager() {
    return this.conversationManager;
  }

  /**
   * Returns centralized security manager.
   * @returns {SecurityManager} Security manager.
   */
  getSecurityManager() {
    return this.securityManager;
  }

  /**
   * Returns Mobile Chat infrastructure optimization managers.
   * @returns {object} Infrastructure optimization managers.
   */
  getInfrastructureOptimization() {
    return this.infrastructureOptimization;
  }

  /**
   * Returns Mobile Chat production readiness managers.
   * @returns {object} Production readiness managers.
   */
  getProductionReadiness() {
    return this.productionReadiness;
  }

  /**
   * Builds the Mobile Chat production readiness report.
   * @returns {object} Production readiness report.
   */
  getProductionReadinessReport() {
    return this.qualityManager.createReport();
  }
}

ChatManager.Events = ChatEvents;

export default ChatManager;
