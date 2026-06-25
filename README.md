# OpenX Mobile

OpenX Mobile is an Android-first Expo app for controlling and exchanging files
with OpenX Desktop over a local WebSocket connection. It provides a paired mobile
assistant interface, QR-based device setup, read-only desktop permissions, session
validation, and local transfer history.

## Features

- Mobile assistant command screen for sending remote commands to OpenX Desktop.
- QR pairing flow that saves the desktop address, port, device identity, and
  session details after a successful scan.
- Manual pairing-code fallback for diagnostics and advanced setup.
- Automatic WebSocket reconnect every five seconds after network or desktop
  availability changes.
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

- `@openx/settings` for desktop address and port
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
