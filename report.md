# OpenX Mobile Repository Report

Report date: 2026-07-21

Repository: `OpenX_Mobile`

Canonical report: `OpenX_Mobile/report.md`

Primary app path: `mobile`

Package: `openx-mobile`

Version source: `mobile/package.json`

Current version: `5.0.0`

Git repository path: `OpenX_Mobile/mobile`

Branch / commit: `chatintegration` / `9c52201`

## Scope Scanned

This report was regenerated from the current OpenX Mobile working tree. The scan covers the Expo app, React Native screens, UI components, app context/provider, navigation, cloud relay services, QR pairing, local schedule intelligence, file transfer, OpenX Chat mobile runtime, crypto/session/message modules, tests, assets, package metadata, and Expo configuration.

Excluded or collapsed generated/dependency-heavy folders:

- `.expo/`
- `.git/`
- `build/`
- `coverage/`
- `dist/`
- `graphify-out/`
- `node_modules/`

Current filtered scan size:

- `223` files after exclusions.
- `200` files under `mobile/src/`.
- `172` files under `mobile/src/chat/`.
- `7` screen files under `mobile/src/screens/`.
- `8` component files under `mobile/src/components/`.
- `10` service files under `mobile/src/services/`.
- `1` test files under `mobile/tests/`.
- `1` asset files under `mobile/assets/`.

Top-level file distribution:

| Area | Files |
|---|---:|
| `mobile` | 211 |
| `.idea` | 8 |
| `.codex` | 1 |
| `AGENTS.md` | 1 |
| `report.md` | 1 |
| `view.xml` | 1 |

File type distribution:

| Extension | Files |
|---|---:|
| `.js` | 187 |
| `.jsx` | 17 |
| `.xml` | 7 |
| `.json` | 4 |
| `.md` | 4 |
| `[no-ext]` | 2 |
| `.iml` | 1 |
| `.png` | 1 |

## Current Working Tree

The top-level `OpenX_Mobile` directory is documentation-oriented. The actual Git repository is nested at `OpenX_Mobile/mobile`. This report documents the current workspace state and does not revert or discard any existing changes.

Current `mobile` Git status snapshot:

- Mobile Git working tree appears clean for tracked files.

## Product Purpose

OpenX Mobile is the mobile companion for OpenX Desktop. It provides assistant command entry, cloud pairing, schedule sync, local reminder/alarm/timer fallback, file transfer, QR pairing, profile/settings UI, and OpenX Chat mobile messaging.

The current mobile design is cloud-first. The app connects through the OpenX cloud relay and OpenX Chat Server instead of relying on insecure local LAN fallback. When OpenX Desktop is connected, commands can be forwarded to the desktop assistant. When desktop is unavailable, mobile keeps local schedule intelligence for reminders, alarms, and timers.

Main product responsibilities:

- Pair with OpenX Desktop through cloud QR and desktop approval.
- Send assistant commands to desktop through relay packets.
- Keep local schedule fallback for reminders, alarms, and timers.
- Sync schedules and profile data with desktop when connected.
- Send and receive files through the cloud transfer path.
- Register/login with OpenX Chat Server.
- Add contacts, accept/reject requests, and send/receive OpenX Chat messages.
- Persist settings, pairing state, profile, schedules, transfer history, and chat state locally.
- Present an iOS-style dark glass UI with bottom dock navigation and segmented controls.

## Technology And Language Inventory

| Area | Technology |
|---|---|
| App framework | Expo `~56.0.16` |
| Mobile UI runtime | React Native `0.85.3` |
| React | `19.2.3` |
| Main language | JavaScript and JSX |
| Navigation | `@react-navigation/native`, `@react-navigation/native-stack` |
| Local storage | `@react-native-async-storage/async-storage` |
| Secure storage | `expo-secure-store` for secrets such as cloud E2EE master key |
| Cryptography primitives | `expo-crypto`, WebCrypto where available, `node-forge` fallback for AES/HKDF paths |
| Camera / QR | `expo-camera` |
| Notifications | `expo-notifications` for local schedule notifications |
| Files | `expo-document-picker`, `expo-file-system`, `expo-sharing` |
| Icons | `@expo/vector-icons` / Ionicons |
| Styling | React Native StyleSheet, shared theme in `src/styles/theme.js`, glass components |
| Tests | Node-based tests under `mobile/tests` |

## Models And Intelligence Assets

OpenX Mobile does not currently include local ONNX, TFLite, Core ML, or other ML model files. Its local intelligence is implemented in JavaScript.

Current intelligence components:

- `mobile/src/services/mobileScheduleIntelligence.js`: deterministic local parser for reminders, alarms, timers, durations, dates, weekdays, recurrence, spoken clock times, natural periods, and noisy schedule wording.
- `mobile/src/context/AppContext.jsx`: command routing between mobile-local schedule handling and cloud/desktop forwarding.
- `mobile/src/components/ChatBubble.jsx`: structured assistant result rendering, visual result cards, choices, and message bubble display.
- OpenX Desktop remains the full assistant/NLP authority when mobile is connected to desktop.

No mobile-local speech, image, face, or large language model assets were found in the filtered scan.

## Expo Configuration

Configuration source: `mobile/app.config.js`.

| Setting | Value |
|---|---|
| App name | `OpenX Mobile` |
| Slug | `openxmobile` |
| Version source | `mobile/package.json` |
| Orientation | `portrait` |
| Theme | dark UI style |
| Android package | `com.openx.mobile` |
| iOS bundle ID | `com.openx.mobile` |
| Android cleartext traffic | disabled through `expo-build-properties` |
| Camera | QR scanner enabled; microphone disabled |
| Android permissions | `CAMERA`, `POST_NOTIFICATIONS` |
| EAS project ID | `36f7718d-5153-4915-889f-09613b0a433b` |

Configured Expo plugins:

- `expo-build-properties`
- `expo-camera`
- `expo-font`
- `expo-notifications`
- `expo-secure-store`
- `expo-sharing`

## Main Runtime Entrypoints And Important Methods

| File | Important classes/functions | Responsibility |
|---|---|---|
| `mobile/App.js` | `AppErrorBoundary`, `AppRuntime`, `App` | App bootstrap, recovery boundary, provider wiring, runtime restart after UI crash. |
| `mobile/src/context/AppContext.jsx` | `AppProvider`, `ensurePairingIdentity`, `activateCloudMode`, `sendCloudScheduleSync`, `flushDirtyScheduleSync`, `sendCloudProfileSync`, `ensureNotificationPermission`, `scheduleLocalScheduleNotification`, `requestScheduleSync`, `sendCommand`, `sendFile`, `connect`, `disconnect`, profile/settings persistence helpers | Central mobile app state, pairing, settings, session, schedules, relay events, command handling, local notifications, file transfer, and history. |
| `mobile/src/navigation/AppNavigator.jsx` | `AppNavigator` | Native stack navigation and theme integration. |
| `mobile/src/screens/HomeScreen.jsx` | home/assistant UI handlers | Assistant/chat toggle, command composer, bottom dock entry point. |
| `mobile/src/screens/MobileChatPanel.jsx` | `clearMobileChatStorage`, `normalizeServerUrl`, `chatWebSocketUrl`, `makeLocalMessage`, `loadChatState`, `persistChatMessages`, `openConversation`, `sendMessage`, `syncMailbox`, chat recovery boundary | OpenX Chat mobile UI and local chat state. |
| `mobile/src/screens/CalendarScreen.jsx` | calendar/day-plan UI and schedule actions | Mobile calendar, day plan, reminder/alarm/timer popup and sync entry points. |
| `mobile/src/screens/QRPairingScreen.jsx` | camera permission and QR scan handlers | Cloud QR pairing scanner. |
| `mobile/src/screens/TransfersScreen.jsx` | transfer rendering and file open helpers | Transfer history and file actions. |
| `mobile/src/screens/SettingsScreen.jsx` | settings sections, profile/system controls | Mobile settings UI. |
| `mobile/src/screens/ProfileScreen.jsx` | profile form handlers | User profile editing and sync. |
| `mobile/src/components/SegmentedSlider.jsx` | segmented slider control | iOS-style segmented control used across top bars and settings. |
| `mobile/src/components/MobileBottomDock.jsx` | bottom dock navigation | Fixed bottom icon navigation. |
| `mobile/src/components/ChatBubble.jsx` | `normalizeResultEntries`, `ResultCards`, `ChoiceCards`, `ChatBubble` | Assistant/user message bubbles and structured result cards. |
| `mobile/src/services/mobileScheduleIntelligence.js` | `parseMobileScheduleCommand`, `nextScheduleDueForRecurrence`, `formatScheduleDue` | Local schedule NLP parser. |
| `mobile/src/services/relayClient.js` | relay connect/send/subscribe helpers | OpenX cloud relay client. |
| `mobile/src/services/cloudFileTransfer.js` | cloud transfer packet and checksum helpers | Relay file transfer support. |
| `mobile/src/services/fileTransfer.js` | document picker, read/write, history | Local file selection, received-file storage, transfer history. |
| `mobile/src/services/e2ee.js` | `generateSecret`, packet encryption helpers | Cloud E2EE packet helper. |
| `mobile/src/services/qrPairing.js` | QR payload parsing/validation | Cloud QR pairing parsing. |
| `mobile/src/services/scheduleStore.js` | schedule persistence helpers | Local schedule storage. |
| `mobile/src/chat/ChatManager.js` | `ChatManager` | Mobile Chat composition root. |
| `mobile/src/chat/accounts/AccountService.js` | account/register/login requests | OpenX Chat account API client. |
| `mobile/src/chat/messages/MessageManager.js` | `initialize`, `sendText`, `send`, `receiveEnvelope`, `syncMailbox` | Encrypted message lifecycle. |
| `mobile/src/chat/messages/MessagePipeline.js` | `createEncryptedMessage`, `receiveEncryptedEnvelope`, `resolveSessionKey` | Encrypt/decrypt message payloads. |
| `mobile/src/chat/messages/MessageRouter.js` | `route` | WebSocket primary delivery with HTTP/local queue fallback. |
| `mobile/src/chat/messages/MessageStorage.js` | `upsertMessage`, `setStatus`, `markRead`, `prune`, `persist` | AsyncStorage-backed bounded message storage. |
| `mobile/src/chat/crypto/CryptoManager.js` | `CryptoManager` | Mobile crypto facade. |
| `mobile/src/chat/crypto/AESManager.js` | AES-GCM encryption/decryption | Message encryption support with WebCrypto/node-forge paths. |
| `mobile/src/chat/crypto/HKDFManager.js` | HKDF-SHA256 derivation | Session/message key derivation. |
| `mobile/src/chat/crypto/RandomManager.js` | secure random bytes | Uses `expo-crypto` when available. |
| `mobile/src/chat/crypto/SecureStorageManager.js` | secure storage abstraction | Stores encrypted local secrets. |
| `mobile/src/chat/conversations/ConversationManager.js` | conversation lifecycle | Local conversations, search, pin/mute/archive, pagination. |
| `mobile/src/chat/synchronization/SynchronizationManager.js` | `synchronize`, `sync` | Reliable mailbox/message synchronization. |
| `mobile/src/chat/mailbox/MailboxManager.js` | mailbox sync and ACK | Offline message recovery. |
| `mobile/src/chat/connection/ConnectionEngine.js` | connection lifecycle | Chat server connection, heartbeat, reconnect. |
| `mobile/src/chat/infrastructure/PerformanceManager.js` | performance coordination | Battery, storage, memory, connection and sync optimization. |
| `mobile/src/chat/quality/QualityManager.js` | quality/release validation | Production readiness hooks. |

## Mobile App State And Storage

OpenX Mobile uses AsyncStorage for normal app state and SecureStore for selected secrets. Storage is intentionally local to the mobile device.

Important storage keys and areas found in the scan:

| Key/area | Purpose |
|---|---|
| `@openx/settings` | Relay/server/settings state. |
| `@openx/pairing` | Mobile device identity and cloud pairing metadata. |
| `@openx/profile` | User profile fields for sync with desktop. |
| `@openx/chat-history-v1` | Assistant chat history, capped to 300 messages. |
| `@openx/schedules/dirty` | Schedule IDs waiting for sync. |
| `openx.cloud.e2eeMasterKey` in SecureStore | Cloud packet E2EE master key. |
| `@openx-mobile/chat/session-v1` | OpenX Chat account/session state. |
| `@openx-mobile/chat/messages-v1` | Mobile OpenX Chat messages, capped per relationship. |
| `@openx-mobile/chat/pinned-v1` | Pinned chat metadata. |
| `@openx-mobile/chat/sync-v1` | Chat sync cursor/state. |
| `@openx-mobile/chat/device-key-v1` | Local mobile chat device key/id. |
| Transfer history store | File transfer history and received-file metadata. |
| Schedule store | Local reminders, alarms, timers, recurrence. |

Storage safety behavior:

- Assistant chat history is bounded by `MAX_MOBILE_CHAT_HISTORY = 300`.
- OpenX Chat relationship histories are bounded by `MAX_RELATIONSHIP_MESSAGES = 300`.
- Large assistant message data is sanitized before persistence.
- SecureStore is used for the cloud E2EE master key.
- File transfer history is bounded.
- Local chat recovery can clear mobile chat state without clearing server account data.

## Assistant Command And Desktop Forwarding Workflow

When the phone is paired and cloud relay is connected, mobile commands are intended to be processed by OpenX Desktop. When desktop is not connected, mobile can execute a local fallback for schedules.

```text
User command in Home screen
  -> AppContext sendCommand
  -> if cloud relay paired and connected
       -> create assistant-command relay packet
       -> OpenX Desktop Assistant.processCommand
       -> relay response packet
       -> mobile app appends assistant response
  -> else if schedule command can be parsed locally
       -> parseMobileScheduleCommand
       -> save local schedule
       -> schedule local notification
       -> mark dirty for later desktop sync
  -> else
       -> show connection/waiting state
```

This design keeps the full assistant intelligence on desktop when available while preserving basic mobile usefulness for alarms, reminders, and timers offline.

## Mobile Schedule Intelligence Detail

`mobile/src/services/mobileScheduleIntelligence.js` implements deterministic schedule parsing in JavaScript. It is not a model file. It provides the mobile fallback intelligence for alarms, reminders, and timers.

Supported schedule understanding includes:

- Numeric and spoken numbers.
- Timers such as `in 10 minutes`, `after two hours`, `for 30 mins`.
- Clock times such as `9:30 pm`, `930 pm`, `nine thirty pm`, `half past nine`.
- Date words such as today, tomorrow, tonight, morning, evening, night.
- Weekdays and next/this weekday.
- Month names and numeric dates.
- Recurrence such as daily, weekly, weekdays, weekends, every Monday.
- Noisy spellings such as `tommorow`, `alram`, `remider`.
- Cleanup of reminder text so `i have a meeting at 6pm tomorrow remind me` becomes a reminder for `meeting`.

Schedule sync flow:

```text
local schedule created/updated
  -> scheduleStore persists locally
  -> local notification scheduled
  -> schedule ID marked dirty
  -> if relay connected, dirty schedules flush to desktop
  -> desktop can send schedule snapshot back
  -> mobile clears synced dirty IDs
```

## Cloud Relay And Pairing Workflow

OpenX Mobile is cloud-first. Legacy local QR/LAN pairing is not the product flow. Android cleartext traffic is disabled, so the app does not silently fall back to insecure local `ws://` behavior.

Pairing workflow:

```text
OpenX Desktop connected to relay
  -> desktop generates Cloud QR
  -> mobile QRPairingScreen scans QR
  -> qrPairing service validates payload
  -> mobile sends pair request through relay
  -> desktop asks approval
  -> desktop approves
  -> mobile stores pairing metadata
  -> future commands/file transfers use relay
```

Relay responsibilities in mobile:

- Connect/reconnect to relay.
- Send assistant command packets.
- Receive assistant command responses.
- Send profile sync packets.
- Send schedule sync packets.
- Send cloud file transfer packets.
- Handle relay errors and pending request timeouts.

## File Transfer Workflow

OpenX Mobile supports file selection and cloud relay transfer to/from desktop.

Sender workflow:

```text
DocumentPicker selects file
  -> fileTransfer reads metadata and base64 source as needed
  -> cloudFileTransfer creates transfer metadata
  -> receiver approval is requested
  -> one chunk is sent at a time
  -> receiver acknowledges chunk
  -> final size/hash check completes transfer
  -> transfer history is recorded
```

Receiver workflow:

```text
incoming metadata packet
  -> user sees transfer prompt/status
  -> chunks are accepted and verified
  -> file is written to app document storage
  -> completed record appears in Transfers screen
  -> file can be opened/shared through platform APIs
```

## OpenX Chat Mobile Runtime Detail

OpenX Chat mobile code under `mobile/src/chat` mirrors the server and desktop chat architecture. It is split into account, connection, crypto, devices, discovery, requests, conversations, messages, mailbox, sync, multi-device, security, transfer, infrastructure, and quality modules.

Chat setup workflow:

```text
MobileChatPanel
  -> user enters server URL, username, password
  -> AccountService registration/login request
  -> mobile device ID is created/reused
  -> device registration/trust state is stored
  -> relationships and mailbox sync become available
```

Chat send workflow:

```text
conversation open
  -> user sends text
  -> makeLocalMessage creates optimistic local message
  -> MessageManager / MobileChatPanel API path sends to server
  -> MessageRouter uses WebSocket/HTTP or queues locally
  -> local status becomes sending/sent/delivered/queued/failed
  -> local per-relationship message history is pruned to 300
```

Chat receive/sync workflow:

```text
WebSocket message or mailbox poll
  -> incoming envelope is decoded/decrypted when runtime is available
  -> local relationship conversation is found or created
  -> message is stored locally
  -> mailbox sequence cursor is updated
  -> UI refreshes conversation list and open chat
```

Important chat domains:

- `accounts/`: account registration/login API client.
- `connection/`: WebSocket, heartbeat, recovery, push/wake, presence, background state.
- `crypto/`: AES, HKDF, random, identity/device/session keys, replay, secure storage.
- `devices/`: mobile device lifecycle and registry.
- `discovery/`: username/contact lookup and validation.
- `requests/`: contact requests, trust, block, nickname.
- `conversations/`: conversation model, local storage, search, pin, mute, archive, pagination, sorting.
- `messages/`: message model, validation, encryption pipeline, router, storage, retry, ACK, typing.
- `mailbox/`: offline envelope recovery and sequence ACK.
- `synchronization/`: cursor, ACK, sequence, conflict, recovery, retry.
- `multidevice/`: synchronization copy and device consistency metadata.
- `security/`: PIN/recovery/trust/session/security policy clients.
- `infrastructure/`: battery, memory, storage, connection, sync optimization and metrics.
- `quality/`: crash recovery, production validation, release logging and performance reporting.

## Cryptography And Security Detail

Mobile chat cryptography is modular and uses proven primitives. The mobile code does not define a new cryptographic algorithm.

Cryptographic modules found:

| Module | Responsibility |
|---|---|
| `AESManager` | AES-GCM encryption/decryption API with WebCrypto and node-forge paths. |
| `HKDFManager` | HKDF-SHA256 key derivation. |
| `RandomManager` | Secure random bytes through Expo Crypto. |
| `IdentityManager` | Identity key lifecycle. |
| `KeyManager` | Device/session key generation and validation. |
| `SessionManager` | Session creation, validation, expiration, renewal, destruction. |
| `ReplayManager` | Nonce replay detection. |
| `KeyRotation` | Rotation framework. |
| `SecureStorageManager` | Local secret persistence abstraction. |
| `CryptoValidation` | Key, IV, tag, nonce, fingerprint validation. |

Security rules:

- Private keys and raw session keys must not be logged.
- Message plaintext must not be written to logs.
- Passwords must not be logged.
- SecureStore is used for the cloud E2EE master key.
- AsyncStorage stores normal app state and encrypted/structured chat state.
- Android cleartext traffic is disabled.
- QR pairing requires Cloud QR payloads rather than legacy local payloads.

## UI And UX Structure

OpenX Mobile uses a dark glass visual language with iOS-style segmented sliders, fixed bottom dock navigation, rounded panels, and icon-first controls.

Important UI components:

- `ScreenBackground`: shared page background.
- `GlassPanel`: reusable translucent panel.
- `GlassButton`: reusable themed button.
- `SegmentedSlider`: iOS-style segmented control.
- `MobileBottomDock`: fixed bottom app navigation.
- `ChatBubble`: assistant/user message and structured result rendering.
- `OpenXNotice`: user-facing notice/toast surface.
- `FadeInView`: lightweight entrance animation.

Primary screens:

- `HomeScreen`: assistant command and chat top-level switch.
- `MobileChatPanel`: OpenX Chat list/conversation/setup/recovery UI.
- `CalendarScreen`: calendar, day plan, reminders, alarms, timers, schedule popup.
- `QRPairingScreen`: camera QR pairing.
- `TransfersScreen`: send/receive transfer history.
- `SettingsScreen`: system/profile/settings controls.
- `ProfileScreen`: profile editing.

## Performance And Stability Strategy

Mobile performance matters because chat, relay, local schedules, file transfer, and UI all run in one React Native app. Current strategies visible in code:

- Top-level `AppErrorBoundary` can restart the React interface without clearing pairing or transfer history.
- Mobile chat panel has local recovery and `clearMobileChatStorage` for corrupted local chat state.
- Message lists use `FlatList`.
- Chat messages are capped per relationship.
- Assistant chat history is capped.
- Transfer history is bounded.
- Schedule dirty IDs are tracked for incremental sync.
- Connection managers separate heartbeat, recovery, presence, background, push, and network logic.
- Infrastructure modules include battery, memory, storage, connection, synchronization, metrics, monitoring, and performance managers.
- Android cleartext traffic is disabled for safer production networking.

## Production Readiness Notes

Before a mobile release, verify:

- `npm run doctor` passes from `OpenX_Mobile/mobile`.
- App starts on a clean install.
- QR scanner requests camera permission and scans Cloud QR payloads.
- Legacy/local QR payloads are rejected with useful text.
- Cloud relay connect/reconnect works after app background/foreground.
- Desktop command forwarding works when desktop is connected.
- Local schedule parsing works when desktop is disconnected.
- Dirty schedule sync flushes after reconnect.
- Local notifications fire for reminders, alarms, and timers.
- File send and receive works with checksum verification.
- OpenX Chat account setup works against the deployed chat server.
- Contact discovery/request/accept flow works.
- Mobile messages send, receive, and mailbox sync after reconnect.
- Chat local state cap stays at 300 messages per relationship.
- Recovery UI appears instead of app crash on corrupt chat state.
- No logs expose passwords, raw private keys, session keys, message plaintext, or E2EE master keys.

## Important Risks And Follow-Up Areas

- Mobile chat currently contains both a full modular chat runtime and a screen-level chat implementation. Keep their contracts aligned so message status, mailbox sync, and storage behavior do not diverge.
- SecureStorageManager under `mobile/src/chat/crypto` uses an abstraction backed by AsyncStorage in code paths; production key material should continue moving toward platform secure storage wherever feasible.
- WebCrypto availability varies by React Native runtime. The node-forge fallback path must remain tested.
- File transfer uses base64 in Expo file APIs. Very large files should be tested carefully for mobile memory pressure.
- Schedule language parsing is deterministic and strong for common reminders/alarms/timers, but it is not the full desktop NLP pipeline. Connected desktop should remain the authority for complex commands.
- Background delivery and push wake behavior must be tested on real Android/iOS devices because simulator behavior differs.

## Validation Performed For This Documentation Update

This update is documentation-only. Runtime tests are not required for this report rewrite. Recommended validation commands:

```powershell
cd OpenX_Mobile\mobile
npm run doctor
node tests\mobile-schedule-intelligence.test.js
```

Markdown whitespace validation used for this report:

```powershell
$bad=@(); $i=0; Get-Content report.md | ForEach-Object { $i++; if ($_ -match '\s+$') { $bad += $i } }; if ($bad.Count) { "Trailing whitespace lines: $($bad -join ', ')"; exit 1 } else { 'No trailing whitespace found.' }
```

The filtered file count was also rechecked after generation:

```text
223 files after exclusions
```

## Full Filtered Directory Tree

The tree below includes all files and folders from the filtered scan. Dependency/generated/local-heavy folders are shown by folder name with contents omitted.

```text
OpenX_Mobile/
|-- .codex/
|   `-- hooks.json
|-- .idea/
|   |-- caches/
|   |   `-- deviceStreaming.xml
|   |-- .gitignore
|   |-- deviceManager.xml
|   |-- misc.xml
|   |-- modules.xml
|   |-- OpenX Mobile.iml
|   |-- vcs.xml
|   `-- workspace.xml
|-- graphify-out/ (contents omitted)
|-- mobile/
|   |-- .expo/ (contents omitted)
|   |-- .git/ (contents omitted)
|   |-- assets/
|   |   `-- logo.png
|   |-- node_modules/ (contents omitted)
|   |-- plugins/
|   |-- src/
|   |   |-- chat/
|   |   |   |-- accounts/
|   |   |   |   |-- AccountService.js
|   |   |   |   `-- index.js
|   |   |   |-- connection/
|   |   |   |   |-- BackgroundManager.js
|   |   |   |   |-- ConnectionConfiguration.js
|   |   |   |   |-- ConnectionEngine.js
|   |   |   |   |-- ConnectionEvents.js
|   |   |   |   |-- ConnectionLogger.js
|   |   |   |   |-- HeartbeatManager.js
|   |   |   |   |-- index.js
|   |   |   |   |-- NetworkMonitor.js
|   |   |   |   |-- PresenceManager.js
|   |   |   |   |-- PushManager.js
|   |   |   |   |-- RecoveryManager.js
|   |   |   |   |-- SessionManager.js
|   |   |   |   `-- WakeManager.js
|   |   |   |-- conversations/
|   |   |   |   |-- ArchiveManager.js
|   |   |   |   |-- ConversationConfiguration.js
|   |   |   |   |-- ConversationEvents.js
|   |   |   |   |-- ConversationLogger.js
|   |   |   |   |-- ConversationManager.js
|   |   |   |   |-- ConversationModel.js
|   |   |   |   |-- ConversationService.js
|   |   |   |   |-- ConversationStorage.js
|   |   |   |   |-- ConversationValidation.js
|   |   |   |   |-- index.js
|   |   |   |   |-- IndexManager.js
|   |   |   |   |-- MuteManager.js
|   |   |   |   |-- PaginationManager.js
|   |   |   |   |-- PinManager.js
|   |   |   |   |-- SearchManager.js
|   |   |   |   |-- SearchService.js
|   |   |   |   `-- SortingManager.js
|   |   |   |-- crypto/
|   |   |   |   |-- AESManager.js
|   |   |   |   |-- CryptoConfiguration.js
|   |   |   |   |-- CryptoErrors.js
|   |   |   |   |-- CryptoEvents.js
|   |   |   |   |-- CryptoLogger.js
|   |   |   |   |-- CryptoManager.js
|   |   |   |   |-- CryptoValidation.js
|   |   |   |   |-- Encoding.js
|   |   |   |   |-- HKDFManager.js
|   |   |   |   |-- IdentityManager.js
|   |   |   |   |-- index.js
|   |   |   |   |-- KeyManager.js
|   |   |   |   |-- KeyRotation.js
|   |   |   |   |-- RandomManager.js
|   |   |   |   |-- ReplayManager.js
|   |   |   |   |-- SecureStorageManager.js
|   |   |   |   `-- SessionManager.js
|   |   |   |-- devices/
|   |   |   |   |-- DeviceConfiguration.js
|   |   |   |   |-- DeviceEvents.js
|   |   |   |   |-- DeviceLifecycle.js
|   |   |   |   |-- DeviceLogger.js
|   |   |   |   |-- DeviceManager.js
|   |   |   |   |-- DeviceRegistry.js
|   |   |   |   |-- DeviceService.js
|   |   |   |   |-- DeviceStatus.js
|   |   |   |   `-- index.js
|   |   |   |-- discovery/
|   |   |   |   |-- ContactDiscoveryManager.js
|   |   |   |   |-- DiscoveryConfiguration.js
|   |   |   |   |-- DiscoveryEvents.js
|   |   |   |   |-- DiscoveryLogger.js
|   |   |   |   |-- DiscoveryService.js
|   |   |   |   |-- DiscoveryValidation.js
|   |   |   |   `-- index.js
|   |   |   |-- infrastructure/
|   |   |   |   |-- BatteryOptimizer.js
|   |   |   |   |-- ConnectionOptimizer.js
|   |   |   |   |-- index.js
|   |   |   |   |-- InfrastructureEvents.js
|   |   |   |   |-- MemoryOptimizer.js
|   |   |   |   |-- MetricsManager.js
|   |   |   |   |-- MonitoringManager.js
|   |   |   |   |-- PerformanceManager.js
|   |   |   |   |-- StorageOptimizer.js
|   |   |   |   `-- SynchronizationOptimizer.js
|   |   |   |-- mailbox/
|   |   |   |   |-- AcknowledgementManager.js
|   |   |   |   |-- index.js
|   |   |   |   |-- MailboxClient.js
|   |   |   |   |-- MailboxConfiguration.js
|   |   |   |   |-- MailboxEvents.js
|   |   |   |   |-- MailboxLogger.js
|   |   |   |   |-- MailboxManager.js
|   |   |   |   |-- MailboxSyncManager.js
|   |   |   |   `-- SequenceManager.js
|   |   |   |-- messages/
|   |   |   |   |-- AcknowledgementManager.js
|   |   |   |   |-- CompressionManager.js
|   |   |   |   |-- index.js
|   |   |   |   |-- MessageClient.js
|   |   |   |   |-- MessageConfiguration.js
|   |   |   |   |-- MessageConstants.js
|   |   |   |   |-- MessageEvents.js
|   |   |   |   |-- MessageLogger.js
|   |   |   |   |-- MessageManager.js
|   |   |   |   |-- MessageModel.js
|   |   |   |   |-- MessagePipeline.js
|   |   |   |   |-- MessageRouter.js
|   |   |   |   |-- MessageStorage.js
|   |   |   |   |-- MessageValidation.js
|   |   |   |   |-- RetryManager.js
|   |   |   |   `-- TypingManager.js
|   |   |   |-- multidevice/
|   |   |   |   |-- DeviceConsistencyManager.js
|   |   |   |   |-- DeviceEvents.js
|   |   |   |   |-- DeviceLogger.js
|   |   |   |   |-- DeviceSynchronizationManager.js
|   |   |   |   |-- index.js
|   |   |   |   |-- MultiDeviceClient.js
|   |   |   |   |-- MultiDeviceConfiguration.js
|   |   |   |   |-- MultiDeviceManager.js
|   |   |   |   `-- SynchronizationCopyManager.js
|   |   |   |-- quality/
|   |   |   |   |-- CrashRecoveryManager.js
|   |   |   |   |-- index.js
|   |   |   |   |-- PerformanceReporter.js
|   |   |   |   |-- ProductionValidator.js
|   |   |   |   |-- QualityManager.js
|   |   |   |   `-- ReleaseLogger.js
|   |   |   |-- requests/
|   |   |   |   |-- BlockManager.js
|   |   |   |   |-- ContactRequestManager.js
|   |   |   |   |-- index.js
|   |   |   |   |-- NicknameManager.js
|   |   |   |   |-- RequestConfiguration.js
|   |   |   |   |-- RequestEvents.js
|   |   |   |   |-- RequestLogger.js
|   |   |   |   |-- RequestService.js
|   |   |   |   |-- RequestValidation.js
|   |   |   |   `-- TrustManager.js
|   |   |   |-- security/
|   |   |   |   |-- index.js
|   |   |   |   |-- RecoveryManager.js
|   |   |   |   |-- RegistrationPinManager.js
|   |   |   |   |-- SecurityClient.js
|   |   |   |   |-- SecurityEvents.js
|   |   |   |   |-- SecurityLogger.js
|   |   |   |   |-- SecurityManager.js
|   |   |   |   |-- SecurityPolicyManager.js
|   |   |   |   |-- SessionManager.js
|   |   |   |   `-- TrustManager.js
|   |   |   |-- synchronization/
|   |   |   |   |-- ACKManager.js
|   |   |   |   |-- ConflictManager.js
|   |   |   |   |-- index.js
|   |   |   |   |-- RecoveryManager.js
|   |   |   |   |-- RetryManager.js
|   |   |   |   |-- SequenceManager.js
|   |   |   |   |-- SynchronizationClient.js
|   |   |   |   |-- SynchronizationConfiguration.js
|   |   |   |   |-- SynchronizationCursor.js
|   |   |   |   |-- SynchronizationEngine.js
|   |   |   |   |-- SynchronizationEvents.js
|   |   |   |   |-- SynchronizationLogger.js
|   |   |   |   `-- SynchronizationManager.js
|   |   |   |-- transfer/
|   |   |   |   |-- BlobClient.js
|   |   |   |   |-- DownloadManager.js
|   |   |   |   |-- index.js
|   |   |   |   |-- IntegrityManager.js
|   |   |   |   |-- ThumbnailManager.js
|   |   |   |   |-- TransferConfiguration.js
|   |   |   |   |-- TransferEvents.js
|   |   |   |   |-- TransferLogger.js
|   |   |   |   |-- TransferManager.js
|   |   |   |   `-- UploadManager.js
|   |   |   |-- ChatConfiguration.js
|   |   |   |-- ChatConnectionManager.js
|   |   |   |-- ChatEventBus.js
|   |   |   |-- ChatEvents.js
|   |   |   |-- ChatHealth.js
|   |   |   |-- ChatHooks.js
|   |   |   |-- ChatLifecycle.js
|   |   |   |-- ChatLogger.js
|   |   |   |-- ChatManager.js
|   |   |   |-- ChatProvider.js
|   |   |   |-- ChatStatusManager.js
|   |   |   |-- ChatStorage.js
|   |   |   |-- ChatVersionManager.js
|   |   |   `-- index.js
|   |   |-- components/
|   |   |   |-- ChatBubble.jsx
|   |   |   |-- FadeInView.jsx
|   |   |   |-- GlassButton.jsx
|   |   |   |-- GlassPanel.jsx
|   |   |   |-- MobileBottomDock.jsx
|   |   |   |-- OpenXNotice.jsx
|   |   |   |-- ScreenBackground.jsx
|   |   |   `-- SegmentedSlider.jsx
|   |   |-- context/
|   |   |   `-- AppContext.jsx
|   |   |-- navigation/
|   |   |   `-- AppNavigator.jsx
|   |   |-- screens/
|   |   |   |-- CalendarScreen.jsx
|   |   |   |-- HomeScreen.jsx
|   |   |   |-- MobileChatPanel.jsx
|   |   |   |-- ProfileScreen.jsx
|   |   |   |-- QRPairingScreen.jsx
|   |   |   |-- SettingsScreen.jsx
|   |   |   `-- TransfersScreen.jsx
|   |   |-- services/
|   |   |   |-- cloudFileTransfer.js
|   |   |   |-- e2ee.js
|   |   |   |-- fileTransfer.js
|   |   |   |-- mobileScheduleIntelligence.js
|   |   |   |-- permissions.js
|   |   |   |-- qrPairing.js
|   |   |   |-- relayClient.js
|   |   |   |-- scheduleStore.js
|   |   |   |-- session.js
|   |   |   `-- websocket.js
|   |   `-- styles/
|   |       `-- theme.js
|   |-- tests/
|   |   `-- mobile-schedule-intelligence.test.js
|   |-- .gitignore
|   |-- app.config.js
|   |-- App.js
|   |-- babel.config.js
|   |-- eas.json
|   |-- package-lock.json
|   |-- package.json
|   |-- README.md
|   `-- report.md
|-- AGENTS.md
|-- report.md
`-- view.xml
```
