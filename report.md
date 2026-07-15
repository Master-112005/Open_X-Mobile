# OpenX Mobile App Report

Report date: 2026-07-14

Package: `openx-mobile`

Version source: `package.json`

Current version: `3.0.0`

Runtime: Expo SDK 56, React 19.2.3, React Native 0.85.3

## Summary

OpenX Mobile is the Android-first companion app for OpenX Desktop. The current app is cloud-first: local LAN QR pairing is rejected, and cloud relay QR pairing is the supported path. The app handles chat commands, mobile-side schedules, phone notifications, profile state, permissions, sessions, cloud relay state, and file transfer.

## Validation

Passed:

```powershell
npm run doctor
```

Result:

```text
21/21 Expo project checks passed. No issues detected.
```

No dedicated lint or unit-test script is currently defined.

## Main Modules

- `src/context/AppContext.jsx`: global pairing, session, profile, permissions, schedule, notification, command, and transfer state.
- `src/services/relayClient.js`: cloud relay connection, pairing, E2EE packet handling, notifications, presence, reconnects.
- `src/services/cloudFileTransfer.js`: cloud file send/receive flow.
- `src/services/fileTransfer.js`: local file preparation, storage, hashing, and history.
- `src/services/mobileScheduleIntelligence.js`: mobile-side timer/reminder/alarm parsing.
- `src/services/scheduleStore.js`: schedule persistence.
- `src/services/nativeNotificationBridge.js`: native notification normalization bridge.
- `plugins/withOpenXNotificationListener.js`: native Android notification listener plugin.
- `src/screens/HomeScreen.jsx`: chat and command surface.
- `src/screens/QRPairingScreen.jsx`: QR scan and cloud pairing flow.
- `src/screens/ProfileScreen.jsx`: synced profile UI.
- `src/screens/CalendarScreen.jsx`: schedule UI.
- `src/screens/SettingsScreen.jsx`: connection, cloud, and permissions UI.
- `src/screens/TransfersScreen.jsx`: received file management.

## Current Capabilities

- Cloud QR pairing with relay token validation.
- Pairing/session/permission persistence.
- Secure relay packet support through E2EE helpers.
- Mobile reminders, timers, alarms, and local notification scheduling.
- Dirty schedule tracking for reconnect sync.
- Phone app notification capture and forwarding to desktop.
- Rapid notification de-dupe/batching before forwarding.
- Cloud notification create/list/read/dismiss/clear operations.
- Phone-to-desktop and desktop-to-phone file transfer.
- Transfer history capped to avoid unbounded growth.
- Profile fields and edit flow in mobile UI.

## Risks

- Expo Doctor does not replace physical Android validation.
- Native notification listener requires a custom development/production Android build.
- Cloud file transfer should be stress-tested on low-memory devices.
- No mobile unit tests currently guard QR parsing, schedule NLP, notification batching, or relay packet handling.

## Recommended Next Actions

1. Add lint and unit-test scripts.
2. Add tests for QR parsing, schedule intelligence, notification normalization, relay packet handling, and cloud file transfer.
3. Validate on a real Android device with notification listener permission enabled.
4. Test reconnect sync after the desktop and relay are restarted.
5. Profile memory during large file transfers.

