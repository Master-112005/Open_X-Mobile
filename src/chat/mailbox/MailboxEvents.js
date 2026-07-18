/**
 * Mobile mailbox event names.
 */
export const MailboxEvents = Object.freeze({
  ENVELOPE_STORED: 'mobile.chat.mailbox.envelope.stored',
  ENVELOPE_RETRIEVED: 'mobile.chat.mailbox.envelope.retrieved',
  ENVELOPE_ACKNOWLEDGED: 'mobile.chat.mailbox.envelope.acknowledged',
  ENVELOPE_DELETED: 'mobile.chat.mailbox.envelope.deleted',
  MAILBOX_SYNCED: 'mobile.chat.mailbox.synced',
  MAILBOX_STATUS_UPDATED: 'mobile.chat.mailbox.status.updated',
  SEQUENCE_UPDATED: 'mobile.chat.mailbox.sequence.updated',
});

export default MailboxEvents;
