import { CryptoManager } from '../crypto';
import { fromBase64 } from '../crypto/Encoding';

/**
 * Mobile encrypted download manager.
 */
export class DownloadManager {
  /**
   * Creates download manager.
   * @param {object} options Dependencies.
   */
  constructor(options = {}) {
    this.client = options.client;
    this.integrity = options.integrity;
    this.crypto = options.crypto || new CryptoManager(options.cryptoConfig || {});
    this.eventBus = options.eventBus;
    this.events = options.events;
  }

  /**
   * Downloads, verifies, decrypts, and ACKs a transfer.
   * @param {object} input Download input.
   * @returns {Promise<object>} Download result.
   */
  async download(input = {}) {
    await this.crypto.initialize?.();
    const blobToken = String(input.blobToken || '').trim().toLowerCase();
    if (!/^blob_[a-f0-9]{64}$/.test(blobToken)) throw new Error('Blob token is invalid.');
    const key = fromBase64(input.localKey);
    if (key.byteLength !== 32) throw new Error('Local file key is invalid.');
    this.eventBus?.emit?.(this.events.DOWNLOAD_STARTED, { blobToken });
    const response = await this.client.download(blobToken);
    const encryptedBytes = fromBase64(response.encryptedBlob);
    await this.integrity.verify(encryptedBytes, response.hash);
    this.eventBus?.emit?.(this.events.INTEGRITY_VERIFIED, { transferId: response.transfer.transferId });
    const plaintext = new Uint8Array(await this.crypto.aes.decrypt({
      key,
      iv: response.transfer.encryption.iv,
      tag: response.transfer.encryption.tag,
      aad: response.transfer.encryption.aad,
      ciphertext: response.encryptedBlob,
    }));
    if (response.transfer.originalHash) await this.integrity.verify(plaintext, response.transfer.originalHash);
    this.eventBus?.emit?.(this.events.DECRYPTION_COMPLETED, { transferId: response.transfer.transferId });
    let acknowledgement = null;
    if (input.acknowledge !== false) {
      acknowledgement = await this.client.acknowledge({ transferId: response.transfer.transferId, status: 'Completed' });
      this.eventBus?.emit?.(this.events.TRANSFER_COMPLETED, { transferId: response.transfer.transferId });
    }
    return { transfer: response.transfer, plaintext, acknowledgement };
  }
}

export default DownloadManager;
