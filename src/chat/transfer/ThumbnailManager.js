import { utf8 } from '../crypto/Encoding';

/**
 * Creates mobile encrypted thumbnail preview payloads.
 */
export class ThumbnailManager {
  /**
   * Creates thumbnail manager.
   * @param {object} options Dependencies.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.integrity = options.integrity;
  }

  /**
   * Generates thumbnail plaintext metadata for images.
   * @param {object} input File input.
   * @returns {Promise<Uint8Array|null>} Thumbnail bytes.
   */
  async generate(input = {}) {
    if (input.fileCategory !== 'Image') return null;
    return utf8(JSON.stringify({
      fileName: input.fileName,
      sourceHash: await this.integrity.sha256(input.bytes),
      generatedAt: new Date().toISOString(),
      maxDimension: this.config.thumbnailMaxDimension,
    }));
  }
}

export default ThumbnailManager;
