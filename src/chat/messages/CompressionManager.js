import { fromBase64, toBase64, text, utf8 } from '../crypto/Encoding';
import { MessageConstants } from './MessageConstants';

/**
 * Mobile compression manager with no-op baseline and CompressionStream hook.
 */
export class CompressionManager {
  /**
   * Creates compression manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
  }

  /**
   * Compresses serialized encrypted payload.
   * @param {string} value Payload.
   * @returns {Promise<object>} Compression result.
   */
  async compress(value) {
    const bytes = utf8(String(value || ''));
    if (!this.config.compressionAlgorithms.includes('gzip') || bytes.byteLength < this.config.compressionThresholdBytes || typeof CompressionStream === 'undefined') {
      return {
        data: toBase64(bytes),
        compression: { algorithm: MessageConstants.COMPRESSION_ALGORITHM.NONE, compressed: false, originalSize: bytes.byteLength, compressedSize: bytes.byteLength, version: '1' },
      };
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return {
      data: toBase64(compressed),
      compression: { algorithm: MessageConstants.COMPRESSION_ALGORITHM.GZIP, compressed: true, originalSize: bytes.byteLength, compressedSize: compressed.byteLength, version: '1' },
    };
  }

  /**
   * Decompresses serialized encrypted payload.
   * @param {string} data Data.
   * @param {object} compression Metadata.
   * @returns {Promise<string>} Serialized encrypted payload.
   */
  async decompress(data, compression = {}) {
    const bytes = fromBase64(data);
    if ((compression.algorithm || 'none') !== MessageConstants.COMPRESSION_ALGORITHM.GZIP) return text(bytes);
    if (typeof DecompressionStream === 'undefined') throw new Error('Gzip decompression is unavailable on this device.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return text(new Uint8Array(await new Response(stream).arrayBuffer()));
  }
}

export default CompressionManager;
