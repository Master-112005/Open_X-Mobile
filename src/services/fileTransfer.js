import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import forge from 'node-forge/lib/forge';
import 'node-forge/lib/sha256';

export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export const MAX_HISTORY_ITEMS = 100;
export const FILE_READ_CHUNK_BYTES = 64 * 1024;

const TRANSFER_HISTORY_KEY = '@openx/transfer-history';
const RECEIVED_DIRECTORY_NAME = 'received-files';

const getReceivedDirectoryUri = () => {
  if (!FileSystem.documentDirectory) {
    throw new Error('Local file storage is unavailable.');
  }
  return `${FileSystem.documentDirectory}${RECEIVED_DIRECTORY_NAME}/`;
};

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createShortSuffix = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const sanitizeFileName = (fileName) => {
  const sourceName = String(fileName || '').trim();
  const leafName = sourceName.split(/[\\/]/).pop() || 'received-file';
  const sanitized = leafName.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 120);
  return sanitized || 'received-file';
};

const createUniqueFileName = (fileName) => {
  const safeName = sanitizeFileName(fileName);
  const extensionIndex = safeName.lastIndexOf('.');

  if (extensionIndex <= 0) {
    return `${safeName}-${createShortSuffix()}`;
  }

  return `${safeName.slice(0, extensionIndex)}-${createShortSuffix()}${safeName.slice(extensionIndex)}`;
};

const getBase64ByteLength = (data) => {
  if (!data) return 0;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
};

const assertFileSize = (size) => {
  if (!Number.isFinite(size) || size < 0) {
    throw new Error('Unable to determine the file size.');
  }

  if (size > MAX_FILE_SIZE) {
    throw new Error('File is larger than the 100 MB limit.');
  }
};

const normalizeBase64 = (data) => String(data || '').replace(/\s/g, '');

export async function readFileChunkBase64(uri, position, length) {
  if (!uri || !Number.isFinite(position) || position < 0 || !Number.isFinite(length) || length < 0) {
    throw new Error('Invalid file chunk request.');
  }
  if (length === 0) return '';

  const data = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  const normalized = normalizeBase64(data);
  if (normalized.length % 4 !== 0 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error('Invalid file chunk data.');
  }
  return normalized;
}

export async function calculateFileHash(uri, size = null) {
  const info = Number.isFinite(size)
    ? { exists: true, isDirectory: false, size }
    : await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) {
    throw new Error('Unable to access the selected file.');
  }

  const md = forge.md.sha256.create();
  const totalBytes = Number(info.size) || 0;
  for (let position = 0; position < totalBytes; position += FILE_READ_CHUNK_BYTES) {
    const length = Math.min(FILE_READ_CHUNK_BYTES, totalBytes - position);
    const chunk = await readFileChunkBase64(uri, position, length);
    md.update(forge.util.decode64(chunk), 'raw');
  }
  return md.digest().toHex();
}

const IMAGE_FILE_PATTERN = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i;

export const isImageTransferFile = (file) => {
  const mimeType = String(file?.mimeType || '').toLowerCase();
  const fileName = String(file?.fileName || file?.name || file?.uri || '');
  return mimeType.startsWith('image/') || IMAGE_FILE_PATTERN.test(fileName);
};

export async function pickTransferFile(options = {}) {
  const pickerType = options?.type || '*/*';
  const result = await DocumentPicker.getDocumentAsync({
    type: pickerType,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  let fileSize = asset.size;

  if (!Number.isFinite(fileSize)) {
    const info = await FileSystem.getInfoAsync(asset.uri);
    if (!info.exists || info.isDirectory) {
      throw new Error('Unable to access the selected file.');
    }
    fileSize = Number(info.size);
  }

  assertFileSize(fileSize);

  return {
    uri: asset.uri,
    fileName: sanitizeFileName(asset.name || asset.uri),
    fileSize,
    mimeType: asset.mimeType || 'application/octet-stream',
  };
}

export async function pickTransferImage() {
  return pickTransferFile({ type: 'image/*' });
}

export async function prepareOutgoingFile(file) {
  if (!file?.uri || !file.fileName) {
    throw new Error('Select a valid file first.');
  }

  try {
    const metadata = await prepareOutgoingFileMetadata(file);
    const data = await readFileChunkBase64(file.uri, 0, metadata.fileSize);
    const encodedSize = getBase64ByteLength(data);
    assertFileSize(encodedSize);

    return {
      fileName: metadata.fileName,
      fileSize: encodedSize,
      data,
      hash: metadata.hash,
    };
  } catch (error) {
    if (error.message?.includes('100 MB')) throw error;
    throw new Error('Unable to read the selected file.');
  }
}

export async function prepareOutgoingFileMetadata(file) {
  if (!file?.uri || !file.fileName) {
    throw new Error('Select a valid file first.');
  }

  try {
    const info = await FileSystem.getInfoAsync(file.uri);
    if (!info.exists || info.isDirectory) {
      throw new Error('Unable to access the selected file.');
    }
    assertFileSize(info.size);

    const hash = await calculateFileHash(file.uri, info.size);
    return {
      uri: file.uri,
      fileName: sanitizeFileName(file.fileName),
      fileSize: Number(info.size) || 0,
      mimeType: file.mimeType || 'application/octet-stream',
      hash,
    };
  } catch (error) {
    if (error.message?.includes('100 MB')) throw error;
    throw new Error('Unable to read the selected file.');
  }
}

export async function storeIncomingFile(payload) {
  const fileName =
    typeof payload?.fileName === 'string' ? payload.fileName.trim() : '';
  const declaredSize = Number(payload?.fileSize);
  const data = payload?.data;
  const expectedHash =
    typeof payload?.hash === 'string'
      ? payload.hash.trim().toLowerCase()
      : (typeof payload?.sha256 === 'string' ? payload.sha256.trim().toLowerCase() : '');

  if (
    !fileName ||
    !Number.isFinite(declaredSize) ||
    declaredSize < 0 ||
    typeof data !== 'string' ||
    !/^[a-f0-9]{64}$/.test(expectedHash)
  ) {
    throw new Error('Invalid incoming file payload.');
  }

  assertFileSize(declaredSize);
  const actualSize = getBase64ByteLength(data);
  assertFileSize(actualSize);

  if (
    actualSize !== declaredSize ||
    data.length % 4 !== 0 ||
    !/^[a-zA-Z0-9+/]*={0,2}$/.test(data)
  ) {
    throw new Error('Invalid incoming file payload.');
  }

  const directoryUri = getReceivedDirectoryUri();
  const directoryInfo = await FileSystem.getInfoAsync(directoryUri);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
  }

  const storedFileName = createUniqueFileName(fileName);
  const localUri = `${directoryUri}${encodeURIComponent(storedFileName)}`;

  try {
    await FileSystem.writeAsStringAsync(localUri, data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const actualHash = await calculateFileHash(localUri);
    if (actualHash !== expectedHash) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      throw new Error('File integrity verification failed.');
    }
  } catch (error) {
    if (error.message === 'File integrity verification failed.') throw error;
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
    throw new Error('Unable to verify and save the incoming file.');
  }

  return createTransferRecord({
    direction: 'received',
    fileName: sanitizeFileName(fileName),
    fileSize: actualSize,
    status: 'received',
    localUri,
    hash: expectedHash,
  });
}

export async function removeReceivedFile(record) {
  const localUri = String(record?.localUri || '').trim();
  if (!localUri) {
    return false;
  }

  const receivedDirectoryUri = getReceivedDirectoryUri();
  if (!localUri.startsWith(receivedDirectoryUri)) {
    throw new Error('This file is outside OpenX received storage.');
  }

  await FileSystem.deleteAsync(localUri, { idempotent: true });
  return true;
}

export function createTransferRecord({
  direction,
  fileName,
  fileSize,
  status,
  localUri = null,
  error = null,
  hash = null,
}) {
  return {
    id: createId(),
    direction,
    fileName: sanitizeFileName(fileName || 'Unknown file'),
    fileSize: Number.isFinite(fileSize) ? fileSize : 0,
    timestamp: Date.now(),
    status,
    localUri,
    error,
    hash,
  };
}

export async function loadTransferHistory() {
  try {
    const storedHistory = await AsyncStorage.getItem(TRANSFER_HISTORY_KEY);
    const parsed = storedHistory ? JSON.parse(storedHistory) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_ITEMS) : [];
  } catch {
    return [];
  }
}

export function persistTransferHistory(history) {
  return AsyncStorage.setItem(
    TRANSFER_HISTORY_KEY,
    JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)),
  );
}

export function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
