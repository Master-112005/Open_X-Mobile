# OpenX Mobile

OpenX Mobile is the cloud companion for OpenX Desktop. It connects only through the OpenX relay server; direct LAN WebSocket connections and local pairing are no longer part of the product flow.

## Features

- Cloud QR pairing with explicit desktop approval.
- Remote assistant commands and structured clarification choices.
- Paired-device presence and reconnect status.
- Schedule synchronization and local schedule notifications.
- Cloud notification forwarding.
- Bidirectional cloud file transfer with metadata approval, chunk acknowledgements, per-chunk SHA-256 checks, final integrity verification, pause/resume/cancel, bounded history, and unique destination names.
- Persistent device identity, cloud pairing metadata, settings, schedules, permissions, and transfer history.
- A top-level UI recovery boundary that can restart the React interface without clearing saved pairing or transfer data.

## Requirements

- Node.js and npm supported by the current Expo SDK.
- Android or iOS device with network access to the configured `wss://` OpenX relay.
- OpenX Desktop connected to the same relay account.

## Development

```powershell
npm install
npm start
npm run android
```

Run the compatibility check before release:

```powershell
npm run doctor
```

## Pairing

1. In OpenX Desktop, open `Settings -> Phone` and connect to the relay.
2. Generate a Cloud QR code. Windows identity verification protects QR creation.
3. In OpenX Mobile, open the QR scanner and scan the Cloud QR.
4. Approve the request in OpenX Desktop.
5. The mobile app stores the cloud pairing metadata and uses the relay for every subsequent operation.

Legacy local QR payloads are rejected with instructions to generate a Cloud QR. Android cleartext traffic is disabled, so the app does not silently fall back to an insecure `ws://` LAN connection.

## File transfer lifecycle

```text
metadata
  -> receiver approval
  -> one acknowledged chunk at a time
  -> per-chunk checksum verification
  -> final size/hash verification
  -> durable file record
```

The sender keeps one base64 source and slices only the current chunk instead of duplicating the entire file into a second chunk array. Received-byte progress is tracked incrementally, avoiding repeated joins of all received chunks.

## Persistence

- `@openx/settings`: cloud relay settings.
- `@openx/pairing`: device identity and cloud pairing metadata.
- `@openx/transfer-history`: bounded transfer history.
- Session, permission, and schedule stores remain available for migration compatibility.

## Troubleshooting

- Pairing failure: confirm both clients use the same relay URL and that the desktop is connected before generating the QR.
- Reconnect loop: verify the relay uses `wss://`, the device has internet access, and the saved relay URL is correct.
- File transfer failure: keep both devices connected, accept the incoming transfer, and ensure the destination has enough storage.
- Legacy/local QR error: regenerate the QR from the Cloud pairing panel in OpenX Desktop.

## On-device alarms and reminders

OpenX Mobile parses alarms, reminders, and timers locally using its built-in NLP, then saves them and schedules phone notifications. This works without a Desktop connection; pending schedule changes sync when the phone reconnects to its paired Desktop.
