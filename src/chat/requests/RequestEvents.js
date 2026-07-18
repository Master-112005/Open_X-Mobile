/**
 * Mobile contact request event names.
 */
export const RequestEvents = Object.freeze({
  REQUEST_CREATE_STARTED: 'mobile.chat.request.create.started',
  REQUEST_CREATED: 'mobile.chat.request.created',
  REQUEST_CREATE_FAILED: 'mobile.chat.request.create.failed',
  REQUEST_ACCEPTED: 'mobile.chat.request.accepted',
  REQUEST_DELETED: 'mobile.chat.request.deleted',
  REQUEST_CANCELLED: 'mobile.chat.request.cancelled',
  REQUEST_BLOCKED: 'mobile.chat.request.blocked',
  TRUST_ESTABLISHED: 'mobile.chat.trust.established',
  BLOCK_REMOVED: 'mobile.chat.block.removed',
  NICKNAME_UPDATED: 'mobile.chat.nickname.updated',
  NICKNAME_DELETED: 'mobile.chat.nickname.deleted',
});

export default RequestEvents;
