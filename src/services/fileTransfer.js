import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export const MAX_HISTORY_ITEMS = 100;

const TRANSFER_HISTORY_KEY = '@openx/transfer-history';
const RECEIVED_DIRECTORY_NAME = 'received-files';

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const sanitizeFileName = (fileName) => {
  const leafName = fileName.split(/[\\/]/).pop() || 'received-file';
  const sanitized = leafName.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 120);
  return sanitized || 'received-file';
};

const createUniqueFileName = (fileName) => {
  const safeName = sanitizeFileName(fileName);
  const extensionIndex = safeName.lastIndexOf('.');

  if (extensionIndex <= 0) {
    return `${safeName}-${Date.now()}`;
  }

  return `${safeName.slice(0, extensionIndex)}-${Date.now()}${safeName.slice(extensionIndex)}`;
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

const arrayBufferToHex = (buffer) =>
  Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

export async function calculateFileHash(uri) {
  const bytes = await new File(uri).bytes();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return arrayBufferToHex(digest);
}

export async function pickTransferFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
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
    fileSize = info.size;
  }

  assertFileSize(fileSize);

  return {
    uri: asset.uri,
    fileName: sanitizeFileName(asset.name),
    fileSize,
    mimeType: asset.mimeType || 'application/octet-stream',
  };
}

export async function prepareOutgoingFile(file) {
  if (!file?.uri || !file.fileName) {
    throw new Error('Select a valid file first.');
  }

  try {
    const info = await FileSystem.getInfoAsync(file.uri);
    if (!info.exists || info.isDirectory) {
      throw new Error('Unable to access the selected file.');
    }
    assertFileSize(info.size);

    const data = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const encodedSize = getBase64ByteLength(data);
    assertFileSize(encodedSize);
    const hash = await calculateFileHash(file.uri);

    return {
      fileName: sanitizeFileName(file.fileName),
      fileSize: encodedSize,
      data,
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
    !/^[a-zA-Z0-9+/]*={0,2}$/.test(data)
  ) {
    throw new Error('Invalid incoming file payload.');
  }

  if (!FileSystem.documentDirectory) {
    throw new Error('Local file storage is unavailable.');
  }

  const directoryUri = `${FileSystem.documentDirectory}${RECEIVED_DIRECTORY_NAME}/`;
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
