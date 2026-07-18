export const TransferEvents = Object.freeze({
  TRANSFER_STARTED: 'mobile.chat.file.transfer.started',
  TRANSFER_PROGRESS: 'mobile.chat.file.transfer.progress',
  UPLOAD_COMPLETED: 'mobile.chat.file.upload.completed',
  DOWNLOAD_STARTED: 'mobile.chat.file.download.started',
  INTEGRITY_VERIFIED: 'mobile.chat.file.integrity.verified',
  DECRYPTION_COMPLETED: 'mobile.chat.file.decryption.completed',
  TRANSFER_COMPLETED: 'mobile.chat.file.transfer.completed',
  TRANSFER_FAILED: 'mobile.chat.file.transfer.failed',
  RETRY_STARTED: 'mobile.chat.file.retry.started',
  BLOB_DELETED: 'mobile.chat.file.blob.deleted',
});

export default TransferEvents;
