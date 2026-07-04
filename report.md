# OpenX Mobile Implementation Report

Project: OpenX Mobile

Package version: 1.0.0

Platform: Android-first mobile app

Runtime: Expo SDK 56, React 19, React Native 0.85

Report date: 2026-07-04

## 1. Executive Summary

OpenX Mobile is the companion app for OpenX Desktop. It provides a local-network mobile chat surface, QR pairing, session-backed command execution, desktop-controlled permissions, and bidirectional file transfer. The mobile app does not implement assistant NLP or automation itself. It sends plain text commands to OpenX Desktop and renders the desktop assistant response, structured choices, and file/search result cards in a mobile-friendly interface.

The current implementation includes:

- black glassmorphism mobile UI matching the OpenX assistant theme;
- launch screen with Open_X / Mobile branding;
- mobile chat with assistant-style message bubbles and structured choice cards;
- top floating control bar for files, connection status, QR scanner, and settings;
- QR pairing and manual connection fallback;
- local WebSocket communication with reconnect handling;
- session token validation and expiry handling;
- read-only permission display from OpenX Desktop;
- phone-to-desktop file sending;
- desktop-to-phone file receiving;
- local received-file storage under the app document directory;
- received-file management with tap-to-open, long-press action sheet, share, and delete;
- SHA-256 verification for outgoing and incoming transfers;
- transfer history capped at 100 records.

## 2. Codebase Scope

This report covers the OpenX Mobile repository:

```text
C:\Users\rakes\Documents\PROJECTS\open\OpenX_Mobile\mobile
```

Filtered project count:

- Files in report tree: 27
- Source files: 17
- Component files: 5
- Screen files: 4
- Service files: 5
- Root/config/documentation files: 9

The tree excludes local-only or generated noise:

```text
node_modules/
.git/
.expo/
```

## 3. High-Level Architecture

```text
User input / file picker / QR scanner
  -> React Native screen
  -> AppContext state and permission/session checks
  -> websocketService
  -> OpenX Desktop PhoneServer
  -> desktop Assistant.processCommand(text, 'phone')
  -> desktop automation or file-transfer action
  -> WebSocket response
  -> AppContext message/transfer state
  -> mobile chat, files, or settings UI
```

The mobile assistant contract is intentionally simple:

```text
OpenX Mobile -> plain text command -> OpenX Desktop assistant
```

The mobile app must not duplicate desktop NLP, NLU, routing, automation, plugin logic, or command parsing. It displays and forwards the desktop assistant behavior.

## 4. Main Module Responsibilities

| Module | Path | Responsibility |
|---|---|---|
| App root | `App.js` | Provides safe-area context, app provider, navigation, status bar, and launch overlay |
| Global state | `src/context/AppContext.jsx` | Owns chat messages, pairing state, session state, permissions, transfer history, and command/file actions |
| Navigation | `src/navigation/AppNavigator.jsx` | Defines the native-stack navigation between chat, QR pairing, settings, and transfers |
| Chat screen | `src/screens/HomeScreen.jsx` | Main mobile chat UI, top floating controls, composer, file selection, and structured choice submission |
| QR pairing screen | `src/screens/QRPairingScreen.jsx` | Camera-based QR scan flow and manual pairing fallback |
| Settings screen | `src/screens/SettingsScreen.jsx` | Desktop connection, pairing status, read-only permissions, and advanced connection settings |
| Transfers screen | `src/screens/TransfersScreen.jsx` | Received-file list, tap-to-open, long-press manage sheet, share, and delete |
| Chat bubble | `src/components/ChatBubble.jsx` | Renders assistant/user messages, result cards, and selectable clarification choices |
| Glass UI primitives | `src/components/GlassButton.jsx`, `src/components/GlassPanel.jsx`, `src/components/ScreenBackground.jsx`, `src/components/FadeInView.jsx` | Reusable theme-matching visual primitives and animation helpers |
| WebSocket service | `src/services/websocket.js` | Local WebSocket lifecycle, reconnects, command sending, chunked file transfer, transfer acknowledgements, and message fanout |
| File transfer service | `src/services/fileTransfer.js` | File picking, size checks, base64 conversion, SHA-256 hashing, incoming file storage, deletion, and transfer history |
| Permissions service | `src/services/permissions.js` | Normalizes and persists desktop-controlled phone permissions |
| QR pairing parser | `src/services/qrPairing.js` | Validates desktop QR payloads, IP/port, token, and expiry |
| Session service | `src/services/session.js` | Normalizes, validates, persists, and clears session tokens |
| Theme | `src/styles/theme.js` | Central colors, spacing, radius, gradients, and shadow tokens |

## 5. Critical Functions And Methods

### App And UI

| Function or method | File | Purpose |
|---|---|---|
| `App()` | `App.js` | Boots the app provider, navigation, dark status bar, and launch animation. |
| `AppNavigator()` | `src/navigation/AppNavigator.jsx` | Defines app screens and dark navigation theme. |
| `HomeScreen()` | `src/screens/HomeScreen.jsx` | Renders the chat surface, floating top control bar, connection indicator, composer, and file-send entry point. |
| `FloatingButton()` | `src/screens/HomeScreen.jsx` | Icon-only floating controls for files, QR, and settings. |
| `ConnectionDot()` | `src/screens/HomeScreen.jsx` | Shows connected/disconnected status without interrupting chat. |
| `handleChoice(value)` | `src/screens/HomeScreen.jsx` | Sends structured assistant choice numbers back to desktop. |
| `handlePickFile()` | `src/screens/HomeScreen.jsx` | Opens the document picker and stages a selected file for sending. |
| `handleSend()` | `src/screens/HomeScreen.jsx` | Sends either selected file transfer or text command based on composer state. |
| `ChatBubble()` | `src/components/ChatBubble.jsx` | Displays user/assistant messages with animation and structured content. |
| `normalizeResultEntries(message)` | `src/components/ChatBubble.jsx` | Converts desktop search/file result payloads into mobile result cards. |
| `ChoiceCards()` | `src/components/ChatBubble.jsx` | Renders desktop clarification choices as tappable cards. |
| `TransfersScreen()` | `src/screens/TransfersScreen.jsx` | Lists received files and manages open/share/delete behavior. |
| `FileRow()` | `src/screens/TransfersScreen.jsx` | Provides tap-to-open and long-press management for each transfer. |
| `openFile(item)` | `src/screens/TransfersScreen.jsx` | Opens received files through Android content URI or falls back to share. |
| `manageFile(item)` | `src/screens/TransfersScreen.jsx` | Opens the in-app black/glass file action sheet. |
| `deleteManagedFile()` | `src/screens/TransfersScreen.jsx` | Deletes a received file and removes its transfer record. |

### State, Pairing, And Command Flow

| Function or method | File | Purpose |
|---|---|---|
| `AppProvider()` | `src/context/AppContext.jsx` | Central provider for all app state and OpenX Desktop communication. |
| `createMessage(role, text, timestamp, metadata)` | `src/context/AppContext.jsx` | Normalizes chat messages and attaches assistant metadata such as choices. |
| `normalizeConnectionSettings(settings)` | `src/context/AppContext.jsx` | Converts saved or QR connection data into stable server IP/port values. |
| `applyPairingData(data)` | `src/context/AppContext.jsx` | Updates current device identity and pairing state. |
| `applySession(session)` | `src/context/AppContext.jsx` | Updates active session validity and expiry. |
| `applyPermissionState(permissionState)` | `src/context/AppContext.jsx` | Stores latest desktop permission state. |
| `recordTransfer(record)` | `src/context/AppContext.jsx` | Adds transfer history with a 100-record cap and persists it. |
| `sendMessage(text)` | `src/context/AppContext.jsx` | Sends a command to desktop if paired, permitted, and session-valid. |
| `saveSettings(address, port)` | `src/context/AppContext.jsx` | Saves manual desktop connection settings and reconnects. |
| `testConnection(address, port)` | `src/context/AppContext.jsx` | Tests WebSocket connectivity to OpenX Desktop. |
| `pairDevice(name, token)` | `src/context/AppContext.jsx` | Sends a pairing request and waits for desktop confirmation. |
| `sendFile(file)` | `src/context/AppContext.jsx` | Validates permissions/session, prepares a file, and sends it to desktop. |
| `deleteReceivedFile(recordId)` | `src/context/AppContext.jsx` | Deletes a stored received file and updates history. |
| `useApp()` | `src/context/AppContext.jsx` | Safe access hook for app state. |

### WebSocket Communication

| Function or method | File | Purpose |
|---|---|---|
| `OpenXWebSocketService.connect(host, port)` | `src/services/websocket.js` | Starts a local WebSocket connection to OpenX Desktop. |
| `OpenXWebSocketService.open(host, port, isReconnect)` | `src/services/websocket.js` | Creates the socket, binds lifecycle handlers, applies timeouts, and schedules retry. |
| `OpenXWebSocketService.disconnect()` | `src/services/websocket.js` | Closes socket, timers, and remembered transfer errors. |
| `OpenXWebSocketService.reconnect()` | `src/services/websocket.js` | Reopens the last known desktop connection. |
| `OpenXWebSocketService.sendCommand(message, metadata)` | `src/services/websocket.js` | Sends a validated phone command payload to desktop. |
| `OpenXWebSocketService.sendPairRequest(deviceId, deviceName, token)` | `src/services/websocket.js` | Sends a pairing request to desktop. |
| `OpenXWebSocketService.sendFileTransfer(payload)` | `src/services/websocket.js` | Sends file-transfer start, chunks, and completion with acknowledgement waits. |
| `OpenXWebSocketService.waitForTransferMessage(transferId, expectedTypes)` | `src/services/websocket.js` | Waits for desktop transfer acknowledgements or errors. |
| `OpenXWebSocketService.waitForSocketDrain()` | `src/services/websocket.js` | Prevents large transfer buffering from overwhelming the WebSocket. |
| `OpenXWebSocketService.sendTransferReceipt(payload)` | `src/services/websocket.js` | Acknowledges desktop-to-phone file delivery. |
| `OpenXWebSocketService.handleMessage(rawMessage)` | `src/services/websocket.js` | Parses desktop messages and dispatches known response/event types. |
| `OpenXWebSocketService.scheduleReconnect()` | `src/services/websocket.js` | Retries after connection loss unless manually disconnected. |
| `OpenXWebSocketService.subscribeToStatus(listener)` | `src/services/websocket.js` | Subscribes UI state to socket status changes. |
| `OpenXWebSocketService.subscribeToMessages(listener)` | `src/services/websocket.js` | Subscribes app state to desktop messages. |

### File Transfer And Storage

| Function or method | File | Purpose |
|---|---|---|
| `calculateFileHash(uri)` | `src/services/fileTransfer.js` | Computes SHA-256 for selected or stored files. |
| `pickTransferFile()` | `src/services/fileTransfer.js` | Opens system document picker and returns a validated file descriptor. |
| `prepareOutgoingFile(file)` | `src/services/fileTransfer.js` | Reads selected file as base64, checks size, and hashes data before sending. |
| `storeIncomingFile(payload)` | `src/services/fileTransfer.js` | Validates desktop file payload, writes it into app storage, verifies hash, and returns a transfer record. |
| `removeReceivedFile(record)` | `src/services/fileTransfer.js` | Deletes only files inside OpenX received storage. |
| `createTransferRecord(data)` | `src/services/fileTransfer.js` | Normalizes transfer history entries. |
| `loadTransferHistory()` | `src/services/fileTransfer.js` | Loads persisted transfer metadata. |
| `persistTransferHistory(history)` | `src/services/fileTransfer.js` | Saves transfer history with a 100-record cap. |
| `formatFileSize(size)` | `src/services/fileTransfer.js` | Formats transfer sizes for UI display. |

### Security, Permissions, And QR

| Function or method | File | Purpose |
|---|---|---|
| `parsePairingQrPayload(rawPayload, now)` | `src/services/qrPairing.js` | Validates QR JSON, LAN IP, port, token, and expiry. |
| `normalizePermissions(value, fallback)` | `src/services/permissions.js` | Normalizes desktop-controlled permissions. |
| `loadPermissionState()` | `src/services/permissions.js` | Loads persisted permission state. |
| `persistPermissionState(permissionState)` | `src/services/permissions.js` | Saves latest permission state from desktop. |
| `normalizeSession(value)` | `src/services/session.js` | Normalizes session token payloads from desktop. |
| `isSessionValid(session, now)` | `src/services/session.js` | Validates session token and expiry before commands/transfers. |
| `loadSession()` | `src/services/session.js` | Loads persisted session data. |
| `persistSession(session)` | `src/services/session.js` | Saves current desktop-issued session. |
| `clearPersistedSession()` | `src/services/session.js` | Removes expired or invalid session data. |

## 6. Phone Command And Assistant Integration

OpenX Mobile forwards commands through:

```text
HomeScreen
  -> sendMessage()
  -> websocketService.sendCommand()
  -> OpenX Desktop PhoneServer
  -> PhoneCommandRouter
  -> Assistant.processCommand(command, 'phone', phoneContext)
```

Important behavior:

- Mobile sends plain text only; desktop owns NLP, NLU, parser, router, NLE, automation, and response generation.
- Desktop responses are rendered as assistant messages.
- Structured desktop choices are stored in `message.choices` and rendered as tappable choice cards.
- When the desktop asks the user to choose a file/folder, tapping a card sends the option number back through the same command path.
- Phone-origin commands do not require the user to say "phone" when requesting files from desktop. The desktop uses the phone source and `phoneContext`.

## 7. File Transfer Architecture

### Phone To Desktop

```text
User taps +
  -> DocumentPicker
  -> prepareOutgoingFile()
  -> SHA-256 hash
  -> websocketService.sendFileTransfer()
  -> file-transfer-start
  -> file-transfer-chunk*
  -> file-transfer-complete
  -> desktop verification and storage
  -> file-transfer-success
  -> transfer history update
```

Transfer controls:

- maximum file size: 100 MB;
- chunk size: 256 KB raw-equivalent base64 slices;
- socket buffered amount threshold: 2 MB;
- transfer acknowledgement timeout: 30 seconds;
- remembered transfer errors capped at 50 entries;
- outgoing payload includes request ID, device ID, session token, timestamp, file size, and hash.

### Desktop To Phone

```text
Desktop sends incoming-file / file-transfer payload
  -> AppContext permission and session checks
  -> storeIncomingFile()
  -> received-files app document directory
  -> SHA-256 verification
  -> transfer receipt to desktop
  -> transfer history update
```

Received files are stored inside the app sandbox:

```text
FileSystem.documentDirectory/received-files/
```

The transfers UI lets the user:

- tap once to open the file;
- long press to open the in-app action sheet;
- share through the native share sheet;
- delete the stored file and its transfer record.

## 8. Local Storage

OpenX Mobile persists small metadata through AsyncStorage:

| Key | Purpose |
|---|---|
| `@openx/settings` | Desktop address and port |
| `@openx/pairing` | Device ID, device name, paired flag, paired timestamp |
| `@openx/permissions` | Latest desktop-controlled permission state |
| `@openx/session` | Session token and expiry metadata |
| `@openx/transfer-history` | Last 100 transfer records |

Binary received files are stored in the app document directory under `received-files/`.

Storage rules:

- file names are sanitized before storage;
- duplicate incoming names receive a short timestamp/random suffix;
- delete is constrained to OpenX received storage;
- failed transfers write metadata only;
- transfer history is capped to avoid unbounded growth.

## 9. Security And Safety Model

OpenX Mobile relies on these safety layers:

- pairing token required before trust is established;
- session token required for commands and transfers;
- session expiry blocks commands and file transfer;
- desktop permission state controls remote commands and transfer directions;
- incoming file payloads must include valid base64, declared size, and SHA-256 hash;
- outgoing files are size-checked and hashed before transfer;
- received-file delete is restricted to app-owned received storage;
- QR payload parser rejects invalid/expired pairing data;
- reconnect handling avoids silently sending commands while disconnected;
- no cloud assistant or cloud speech service is used by the mobile app.

## 10. UI And UX

The mobile UI is intentionally minimal and assistant-focused:

- black theme;
- glass panels and buttons;
- icon-first controls;
- floating top control bar so controls do not overlap chat;
- connection status indicator;
- full-screen chat surface;
- bottom composer with file add and send controls;
- structured file/folder choices rendered inside assistant bubbles;
- received-files screen with native open/share behavior;
- in-app file action sheet matching the OpenX theme.

Main UI files:

- `src/screens/HomeScreen.jsx`
- `src/screens/TransfersScreen.jsx`
- `src/screens/SettingsScreen.jsx`
- `src/screens/QRPairingScreen.jsx`
- `src/components/ChatBubble.jsx`
- `src/styles/theme.js`

## 11. Testing And Validation

Available scripts:

```powershell
npm start
npm run android
npm run ios
npm run web
npm run doctor
```

Current validation performed:

```powershell
npm run doctor
```

Result:

```text
21/21 Expo project checks passed.
```

The project currently does not define a dedicated lint or unit-test script. Runtime validation should include:

- QR pairing with a live OpenX Desktop instance;
- command send and structured choice selection;
- phone-origin desktop file search;
- desktop-to-phone file receive;
- tap-to-open received file;
- long-press share/delete flow;
- phone-to-desktop file send;
- reconnect after desktop restart;
- session expiry and re-pairing behavior.

## 12. Packaging

The app is Expo-based and Android-first.

Development:

```powershell
npm start
npm run android
```

Project health:

```powershell
npm run doctor
```

EAS build profiles are defined in:

```text
eas.json
```

Common Android build commands:

```powershell
eas build --profile development --platform android
eas build --profile preview --platform android
eas build --profile production --platform android
```

Android config highlights:

- package: `com.openx.mobile`;
- portrait orientation;
- dark UI style;
- camera permission for QR pairing;
- local cleartext WebSocket traffic enabled for `ws://` desktop connections;
- software keyboard resize enabled so chat input remains visible while typing.

## 13. Full Filtered Directory Tree

```text
OpenX_Mobile/mobile/
|-- assets/
|   `-- logo.png
|-- src/
|   |-- components/
|   |   |-- ChatBubble.jsx
|   |   |-- FadeInView.jsx
|   |   |-- GlassButton.jsx
|   |   |-- GlassPanel.jsx
|   |   `-- ScreenBackground.jsx
|   |-- context/
|   |   `-- AppContext.jsx
|   |-- navigation/
|   |   `-- AppNavigator.jsx
|   |-- screens/
|   |   |-- HomeScreen.jsx
|   |   |-- QRPairingScreen.jsx
|   |   |-- SettingsScreen.jsx
|   |   `-- TransfersScreen.jsx
|   |-- services/
|   |   |-- fileTransfer.js
|   |   |-- permissions.js
|   |   |-- qrPairing.js
|   |   |-- session.js
|   |   `-- websocket.js
|   `-- styles/
|       `-- theme.js
|-- .gitignore
|-- App.js
|-- app.json
|-- babel.config.js
|-- eas.json
|-- package.json
|-- package-lock.json
|-- README.md
`-- report.md
```
