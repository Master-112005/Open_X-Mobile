import BlobClient from './BlobClient';
import DownloadManager from './DownloadManager';
import IntegrityManager from './IntegrityManager';
import ThumbnailManager from './ThumbnailManager';
import TransferConfiguration from './TransferConfiguration';
import TransferEvents from './TransferEvents';
import TransferLogger from './TransferLogger';
import UploadManager from './UploadManager';

/**
 * Mobile Phase 12 transfer facade.
 */
export class TransferManager {
  /**
   * Creates transfer manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config instanceof TransferConfiguration ? options.config : new TransferConfiguration(options.config || {});
    this.eventBus = options.eventBus;
    this.logger = options.logger || new TransferLogger();
    this.integrity = options.integrity || new IntegrityManager();
    this.client = options.client || new BlobClient({ config: this.config, fetchImpl: options.fetchImpl });
    this.thumbnail = options.thumbnail || new ThumbnailManager({ config: this.config, integrity: this.integrity });
    this.uploadManager = options.uploadManager || new UploadManager({
      config: this.config,
      client: this.client,
      integrity: this.integrity,
      thumbnail: this.thumbnail,
      crypto: options.crypto,
      cryptoConfig: options.cryptoConfig,
      eventBus: this.eventBus,
      events: TransferEvents,
    });
    this.downloadManager = options.downloadManager || new DownloadManager({
      client: this.client,
      integrity: this.integrity,
      crypto: options.crypto,
      cryptoConfig: options.cryptoConfig,
      eventBus: this.eventBus,
      events: TransferEvents,
    });
    this.localTransfers = new Map();
  }

  /**
   * Starts encrypted transfer.
   * @param {object} input File input.
   * @returns {Promise<object>} Transfer result.
   */
  async startTransfer(input = {}) {
    const result = await this.uploadManager.upload(input);
    this.localTransfers.set(result.transfer.transferId, { ...result, source: input, status: 'Uploaded' });
    return result;
  }

  /** @param {object} input Download input. @returns {Promise<object>} Download result. */
  download(input = {}) { return this.downloadManager.download(input); }

  /** @param {string} transferId TransferID. @returns {Promise<object>} Status. */
  status(transferId) { return this.client.status(transferId); }

  /** @param {string} transferId TransferID. @returns {Promise<object>} Retry result. */
  retry(transferId) {
    const record = this.localTransfers.get(transferId);
    if (!record) throw new Error('Transfer is not available for retry.');
    this.eventBus?.emit?.(TransferEvents.RETRY_STARTED, { transferId });
    return this.startTransfer(record.source);
  }

  /** @param {string} transferId TransferID. @returns {Promise<object>} Resume result. */
  resume(transferId) { return this.retry(transferId); }

  /**
   * Cancels a transfer and deletes known server blob.
   * @param {string} transferId TransferID.
   * @returns {Promise<object>} Cancel result.
   */
  async cancel(transferId) {
    const record = this.localTransfers.get(transferId);
    if (record?.transfer?.blobToken) await this.client.deleteBlob(record.transfer.blobToken);
    this.localTransfers.set(transferId, { ...(record || {}), status: 'Cancelled' });
    return { transferId, status: 'Cancelled' };
  }
}

TransferManager.Events = TransferEvents;

export default TransferManager;
