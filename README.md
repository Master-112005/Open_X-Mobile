# OpenX Mobile — Phase 8

An Android-first Expo application that connects to the OpenX Desktop WebSocket
server and provides a mobile assistant command interface.

## Requirements

- Node.js 20.19.4 or newer
- npm
- Android Studio emulator, or an Android device with Expo Go

## Install and run

```powershell
cd mobile
npm install
npm run android
```

To open Expo's development server without immediately launching Android:

```powershell
npm start
```

Then scan the displayed QR code with Expo Go on the same network, or press `a`
to launch an available Android emulator.

## Included packages

- Expo SDK 56 and React Native 0.85
- React Navigation native stack
- AsyncStorage for local desktop address and port settings
- Expo Crypto for the permanent UUID device identifier
- Expo Camera for QR-only pairing scans
- Expo Document Picker and File System for local file transfers
- React Native Safe Area Context and Screens

## Phase 8 security integration

1. Start OpenX Desktop's WebSocket server.
2. Keep the Android device and desktop on the same local network.
3. In Settings, enter the desktop's LAN IP and port `8080`.
4. Test the connection, then save the settings.
5. Select **Pair Device**, then either enter the code manually or select
   **Scan QR** and scan the code shown by OpenX Desktop.

The app creates one permanent UUID on first launch and stores pairing state in
AsyncStorage. Chat commands remain disabled until pairing succeeds. The app
reconnects automatically every five seconds without requiring re-pairing.

Paired devices can open **File Transfers** from Settings, select files up to
100 MB, and send them through the existing WebSocket connection. Incoming files
are stored in the app's persistent document directory. Transfer history stores
metadata only in AsyncStorage.

Desktop code, notifications, clipboard, SMS, calls, webcam, and battery sync are
not included.

OpenX Desktop can send read-only permission updates for remote commands, file
transfers, receiving files, sending files, and power actions. The latest values
and update timestamp are stored locally. Restricted actions are disabled by the
mobile client; permissions cannot be edited on mobile.

Session tokens and their issue/expiry timestamps are persisted locally. Every
command and file transfer includes a UUID request ID, timestamp, device ID, and
session token. File transfers include a SHA-256 hash, and incoming file hashes
are verified before the transfer is accepted.
