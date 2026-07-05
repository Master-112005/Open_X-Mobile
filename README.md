# OpenX Mobile

OpenX Mobile is an Android-first Expo app for controlling and exchanging files
with OpenX Desktop over a local WebSocket connection. It provides a paired mobile
assistant interface, QR-based device setup, read-only desktop permissions, session
validation, local transfer history, and an optional cloud relay connection mode.

## Features

- Mobile assistant command screen for sending remote commands to OpenX Desktop.
- QR pairing flow for local LAN pairing and cloud relay pairing.
- Local QR pairing saves the desktop address, port, device identity, and session
  details after a successful scan.
- Cloud QR pairing connects only to the relay server and waits for desktop
  approval.
- Cloud mode registers the phone's existing permanent device ID with the relay.
- Cloud mode receives paired-device presence and cloud notifications from the relay.
- Manual pairing-code fallback for diagnostics and advanced setup.
- Automatic WebSocket reconnect every five seconds after network or desktop
  availability changes.
- Optional Cloud mode for connecting the phone to the OpenX Relay Server.
- Connection mode selection: Local direct-to-desktop or Cloud relay.
- Cloud reconnect with bounded exponential backoff and manual disconnect control.
- Read-only permission state controlled by OpenX Desktop:
  - remote commands
  - file transfer
  - receive files
  - send files
  - power actions
- File transfer support up to 100 MB per file.
- SHA-256 verification for outgoing and incoming file payloads.
- Local transfer history with the latest 100 transfer records.
- Persistent device UUID, pairing state, desktop settings, permissions, and
  session data through AsyncStorage.

## Tech Stack

- Expo SDK 56
- React 19 and React Native 0.85
- React Navigation native stack
- AsyncStorage for persisted app state
- Expo Camera for QR pairing
- Expo Crypto for UUIDs and SHA-256 hashes
- Expo Document Picker and File System for file transfers
- Expo Linear Gradient, Safe Area Context, and Screens for UI support

## Requirements

- Node.js 20.19.4 or newer
- npm
- Expo CLI through `npx expo` or the npm scripts in this project
- Android Studio emulator, or a physical Android device with Expo Go
- OpenX Desktop running its local WebSocket server on the same network

## Installation

From the repository root:

```powershell
cd mobile
npm install
```

Start the Expo development server:

```powershell
npm start
```

Launch Android directly:

```powershell
npm run android
```

You can also scan the Expo QR code with Expo Go while the phone and development
machine are on the same network.

## Available Scripts

```powershell
npm start        # Start Expo
npm run android  # Start Expo and open Android
npm run ios      # Start Expo and open iOS, if available
npm run web      # Start Expo for web
npm run doctor   # Run expo-doctor
```

The app is configured for Android first. The iOS and web scripts are present
because Expo provides them, but the current app behavior is intended for mobile
device pairing and local network use.

## Pairing Flow

1. Start OpenX Desktop and make sure its WebSocket server is running.
2. Connect the Android device and desktop to the same local network.
3. Open OpenX Mobile.
4. Go to Settings, then select Pair Device.
5. Select Scan QR to Pair.
6. Scan the QR code displayed by OpenX Desktop.

On success, the app stores the desktop address, port, device ID, device name,
pairing state, and session token locally. Commands and file transfers stay
disabled until pairing succeeds and a valid session is available.

For diagnostics, Settings includes Advanced Settings where you can manually enter
a desktop IP address and port. The default port is `8080`.

## Connection Modes

OpenX Mobile is local-first. Local mode remains the default and is the only mode
that supports QR pairing, desktop commands, permissions, sessions, and file
transfer in this phase.

Settings includes `Connection mode`:

- `Local`: connects directly to OpenX Desktop over local WiFi.
- `Cloud`: connects only to the OpenX Relay Server.

Only one provider is active at a time. Switching to Cloud disconnects the local
desktop socket. Switching back to Local disconnects the relay socket and restores
the direct desktop path.

Cloud mode persists:

- relay URL
- auto connect
- reconnect enabled
- heartbeat enabled
- connection timeout

Cloud mode currently implements relay QR pairing, Phase 6 opaque packet
transport, Phase 7 remote assistant commands, and Phase 8 cloud file transfer.
`RelayClient.sendRelayPacket(packet)` can send a validated `relay:packet`, and
`subscribeToRelayPackets(listener)` receives `relay:packet`, `relay:ack`, and
`relay:error` messages.

Cloud chat commands are sent as `assistant-command` packets to OpenX Desktop.
The desktop executes the existing assistant pipeline and returns the structured
assistant response through the relay.

Cloud file transfer sends metadata first, asks the receiver to accept or reject,
then transfers chunks with SHA-256 verification before storing the file in the
same received-files area used by the mobile app.

Cloud mode now supports relay QR pairing, cloud command transport, cloud file
transfer, paired-device presence, and cloud notification delivery. It does not
implement cloud voice streaming, screen sharing, cloud backup, or offline sync.

Cloud QR payloads contain only:

```json
{
  "version": 1,
  "relayUrl": "wss://openx-server.onrender.com/ws",
  "pairToken": "relay-generated-token",
  "expiresAt": 1767225600000
}
```

After scan, the phone connects to the relay server, sends a cloud pair request,
waits for desktop approval, and records the pairing state after approval. The
phone never connects directly to the desktop while pairing in Cloud mode.

The relay keeps device identity separate from connection identity. Reconnecting
the same phone reuses the existing `deviceId`; only the temporary relay
connection ID changes.

## WebSocket Protocol Expectations

OpenX Mobile connects to:

```text
ws://<desktop-address>:<port>
```

The QR payload is expected to be JSON with:

```json
{
  "serverIp": "192.168.1.100",
  "serverPort": 8080,
  "pairingToken": "ABC123XY",
  "expiresAt": 1767225600000
}
```

`expiresAt` may be a JavaScript millisecond timestamp or a Unix seconds
timestamp.

The mobile app sends these message types:

- `pair` with `deviceId`, `deviceName`, and `token`
- `command` with `message`, `requestId`, `timestamp`, `deviceId`, and
  `sessionToken`
- `file-transfer` with request metadata, file name, file size, base64 file data,
  and SHA-256 hash

The mobile app handles these desktop message types:

- `pair-success`
- `pair-failed`
- `response`
- `error`
- `permissions`
- `incoming-file`
- `session-renewed`
- `session-expired`
- `authentication-failed`
- `authentication-failure`
- `auth-failed`
- `auth-failure`
- `status`

## File Transfers

OpenX Mobile can send one selected file at a time through the active WebSocket
connection. Each file is read as base64, checked against the 100 MB limit, hashed
with SHA-256, and sent with request metadata.

Incoming files are accepted only when:

- the device is paired
- the local session is valid
- desktop permissions allow file transfers
- desktop permissions allow receiving files
- the payload has a valid declared size, base64 body, and SHA-256 hash

Received files are stored in the app document directory under `received-files`.
Transfer history stores metadata only and is capped at 100 items.

## Local Storage

The app persists these keys in AsyncStorage:

- `@openx/settings` for connection mode, desktop address/port, and cloud relay settings
- `@openx/pairing` for device identity and pairing status
- `@openx/permissions` for the latest desktop permission state
- `@openx/session` for the active session token and timestamps
- `@openx/transfer-history` for transfer metadata

The device UUID is generated once on first launch and kept on the phone.

## Android Configuration

The Expo config sets:

- package name: `com.openx.mobile`
- portrait orientation
- dark user interface style
- camera permission for QR scanning
- cleartext HTTP/WebSocket traffic enabled for local `ws://` desktop connections

## EAS Builds

The project includes `eas.json` profiles for development, preview, and
production builds:

```powershell
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile production --platform android
```

Install and authenticate the EAS CLI before using these commands.

## Troubleshooting

If pairing fails:

- Confirm OpenX Desktop is running and showing a fresh QR code.
- Confirm the phone and desktop are on the same local network.
- Check that the QR code has not expired.
- Try Advanced Settings with the desktop LAN IP and port `8080`.
- Make sure the desktop firewall allows local WebSocket connections.

If commands are disabled:

- Pair the device first.
- Confirm the app shows a valid connection.
- Confirm the desktop has allowed remote commands.
- Reconnect if the session has expired.

If file transfers are disabled:

- Confirm the device is paired and connected.
- Confirm desktop permissions allow file transfer.
- Confirm send or receive permissions match the action you are trying.
- Use files smaller than 100 MB.

## Current Scope

This app focuses on mobile pairing, remote command messages, permissions,
session validation, and file transfers. Desktop code, notifications, clipboard
sync, SMS, calls, webcam, and battery sync are outside the current mobile app
scope.
