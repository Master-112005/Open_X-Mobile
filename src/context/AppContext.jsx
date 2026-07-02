import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  createTransferRecord,
  loadTransferHistory,
  persistTransferHistory,
  prepareOutgoingFile,
  storeIncomingFile,
} from '../services/fileTransfer';
import {
  DEFAULT_PERMISSIONS,
  loadPermissionState,
  normalizePermissions,
  persistPermissionState,
} from '../services/permissions';
import {
  EMPTY_SESSION,
  clearPersistedSession,
  isSessionValid,
  loadSession,
  normalizeSession,
  persistSession,
} from '../services/session';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { websocketService } from '../services/websocket';

const SETTINGS_KEY = '@openx/settings';
const PAIRING_KEY = '@openx/pairing';
const DEFAULT_PORT = '8080';
const DEFAULT_DEVICE_NAME = 'My Android Phone';
const PAIRING_TIMEOUT_MS = 15000;
const CONNECTION_ERROR_MESSAGE = 'Waiting for OpenX Desktop...';

const parseStoredObject = (value) => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const createMessage = (role, text, timestamp = Date.now()) => {
  const parsedTimestamp = new Date(timestamp);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    text,
    timestamp: Number.isNaN(parsedTimestamp.getTime())
      ? new Date().toISOString()
      : parsedTimestamp.toISOString(),
  };
};

const initialMessages = [];

const initialPairingData = {
  deviceId: '',
  deviceName: DEFAULT_DEVICE_NAME,
  paired: false,
  pairedAt: null,
};

const normalizeConnectionSettings = (settings) => {
  const serverIp = String(
    settings.serverIp ?? settings.desktopAddress ?? '',
  ).trim();
  const serverPort = String(
    settings.serverPort ?? settings.desktopPort ?? DEFAULT_PORT,
  ).trim();

  return {
    serverIp,
    serverPort: serverPort || DEFAULT_PORT,
    desktopAddress: serverIp,
    desktopPort: serverPort || DEFAULT_PORT,
  };
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [messages, setMessages] = useState(initialMessages);
  const [connectionStatus, setConnectionStatus] = useState(
    websocketService.getStatus(),
  );
  const [desktopAddress, setDesktopAddress] = useState('');
  const [desktopPort, setDesktopPort] = useState(DEFAULT_PORT);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState(DEFAULT_DEVICE_NAME);
  const [paired, setPaired] = useState(false);
  const [pairedAt, setPairedAt] = useState(null);
  const [pairingLoaded, setPairingLoaded] = useState(false);
  const [transferHistory, setTransferHistory] = useState([]);
  const [transfersLoaded, setTransfersLoaded] = useState(false);
  const [lastTransferEvent, setLastTransferEvent] = useState(null);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [permissionsLastUpdated, setPermissionsLastUpdated] = useState(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const pairingDataRef = useRef(initialPairingData);
  const pendingPairingRef = useRef(null);
  const transferHistoryRef = useRef([]);
  const permissionsRef = useRef(DEFAULT_PERMISSIONS);
  const sessionRef = useRef(EMPTY_SESSION);

  const applyPairingData = useCallback((data) => {
    pairingDataRef.current = data;
    setDeviceId(data.deviceId);
    setDeviceName(data.deviceName);
    setPaired(data.paired);
    setPairedAt(data.pairedAt);
  }, []);

  const recordTransfer = useCallback((record) => {
    const nextHistory = [record, ...transferHistoryRef.current].slice(0, 100);
    transferHistoryRef.current = nextHistory;
    setTransferHistory(nextHistory);
    persistTransferHistory(nextHistory).catch(() => {
      setLastTransferEvent({
        id: Date.now(),
        type: 'error',
        message: 'Unable to save transfer history.',
      });
    });
    return record;
  }, []);

  const applyPermissionState = useCallback((permissionState) => {
    permissionsRef.current = permissionState.permissions;
    setPermissions(permissionState.permissions);
    setPermissionsLastUpdated(permissionState.lastUpdated);
  }, []);

  const applySession = useCallback((session) => {
    sessionRef.current = session;
    setSessionValid(isSessionValid(session));
    setSessionExpiresAt(session.expiresAt);
  }, []);

  useEffect(() => {
    let mounted = true;

    const rejectPendingPairing = (message) => {
      const pending = pendingPairingRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingPairingRef.current = null;
      pending.reject(new Error(message));
    };

    const handleSecurityFailure = (message) => {
      applySession({ ...EMPTY_SESSION });
      clearPersistedSession().catch(() => {
        console.warn('Unable to clear expired OpenX session.');
      });
      setMessages((current) => [
        ...current,
        createMessage('assistant', message),
      ]);
    };

    const unsubscribeStatus = websocketService.subscribeToStatus((status) => {
      if (mounted) setConnectionStatus(status);
      if (status === 'disconnected' || status === 'error') {
        rejectPendingPairing(CONNECTION_ERROR_MESSAGE);
      }
    });

    const unsubscribeMessages = websocketService.subscribeToMessages(
      (message) => {
        if (!mounted) return;

        if (message.type === 'pair-success') {
          const pending = pendingPairingRef.current;
          const previousPairingData = pairingDataRef.current;
          const currentConnection = websocketService.getConnectionConfig();
          const receivedConnection = normalizeConnectionSettings({
            serverIp: message.serverIp || currentConnection.serverIp,
            serverPort: message.serverPort || currentConnection.serverPort,
          });
          const nextPairingData = {
            ...previousPairingData,
            deviceId: message.deviceId || previousPairingData.deviceId,
            deviceName:
              pending?.deviceName || pairingDataRef.current.deviceName,
            paired: true,
            pairedAt: Date.now(),
          };
          const receivedSession = normalizeSession(message);

          if (receivedSession.sessionToken) {
            applySession(receivedSession);
            persistSession(receivedSession).catch(() => {
              console.warn('Unable to persist OpenX session.');
            });
          }

          applyPairingData(nextPairingData);
          setDesktopAddress(receivedConnection.serverIp);
          setDesktopPort(receivedConnection.serverPort);
          Promise.all([
            AsyncStorage.setItem(PAIRING_KEY, JSON.stringify(nextPairingData)),
            AsyncStorage.setItem(
              SETTINGS_KEY,
              JSON.stringify(receivedConnection),
            ),
          ])
            .then(() => {
              if (!pending || pendingPairingRef.current !== pending) return;
              clearTimeout(pending.timer);
              pendingPairingRef.current = null;
              pending.resolve(nextPairingData);
            })
            .catch(() => {
              applyPairingData(previousPairingData);
              if (!pending || pendingPairingRef.current !== pending) return;
              clearTimeout(pending.timer);
              pendingPairingRef.current = null;
              pending.reject(new Error('Unable to save pairing information.'));
            });
          return;
        }

        if (message.type === 'pair-failed') {
          rejectPendingPairing('Invalid or expired pairing code.');
          return;
        }

        if (message.type === 'session-renewed') {
          const renewedSession = normalizeSession(message);
          if (!isSessionValid(renewedSession)) {
            handleSecurityFailure('Device authentication failed. Please reconnect.');
            return;
          }
          applySession(renewedSession);
          persistSession(renewedSession).catch(() => {
            console.warn('Unable to persist renewed OpenX session.');
          });
          return;
        }

        if (message.type === 'session-expired') {
          handleSecurityFailure('Session expired. Please reconnect.');
          return;
        }

        if (
          message.type === 'authentication-failed' ||
          message.type === 'authentication-failure' ||
          message.type === 'auth-failed' ||
          message.type === 'auth-failure'
        ) {
          handleSecurityFailure('Device authentication failed. Please reconnect.');
          return;
        }

        if (message.type === 'error') {
          const errorCode = String(message.code || '').toUpperCase();
          const errorMessage = String(message.message || '');
          if (
            errorCode === 'SESSION_EXPIRED' ||
            /session expired/i.test(errorMessage)
          ) {
            handleSecurityFailure('Session expired. Please reconnect.');
            return;
          }
          if (
            errorCode === 'AUTHENTICATION_FAILED' ||
            errorCode === 'DEVICE_AUTHENTICATION_FAILED' ||
            errorCode === 'AUTH_FAILED' ||
            /authentication failed/i.test(errorMessage)
          ) {
            handleSecurityFailure(
              'Device authentication failed. Please reconnect.',
            );
            return;
          }
        }

        if (message.type === 'permissions') {
          const permissionState = {
            permissions: normalizePermissions(
              message.permissions,
              permissionsRef.current,
            ),
            lastUpdated: Date.now(),
          };
          applyPermissionState(permissionState);
          persistPermissionState(permissionState).catch(() => {
            console.warn('Unable to persist desktop permissions.');
          });
          return;
        }

        if (message.type === 'incoming-file' || message.type === 'file-transfer') {
          if (!pairingDataRef.current.paired) {
            const errorMessage = 'Pair device before transferring files.';
            recordTransfer(
              createTransferRecord({
                direction: 'received',
                fileName: message.fileName,
                fileSize: Number(message.fileSize),
                status: 'failed',
                error: errorMessage,
              }),
            );
            setLastTransferEvent({
              id: Date.now(),
              type: 'error',
              message: errorMessage,
            });
            return;
          }

          if (!isSessionValid(sessionRef.current)) {
            const errorMessage = 'Session expired. Please reconnect.';
            recordTransfer(
              createTransferRecord({
                direction: 'received',
                fileName: message.fileName,
                fileSize: Number(message.fileSize),
                status: 'failed',
                error: errorMessage,
              }),
            );
            setLastTransferEvent({
              id: Date.now(),
              type: 'error',
              message: errorMessage,
            });
            return;
          }

          if (!permissionsRef.current.fileTransfer) {
            const errorMessage = 'File transfers disabled by desktop.';
            recordTransfer(
              createTransferRecord({
                direction: 'received',
                fileName: message.fileName,
                fileSize: Number(message.fileSize),
                status: 'failed',
                error: errorMessage,
              }),
            );
            setLastTransferEvent({
              id: Date.now(),
              type: 'error',
              message: errorMessage,
            });
            return;
          }

          if (!permissionsRef.current.receiveFiles) {
            const errorMessage = 'Receiving files disabled by desktop.';
            recordTransfer(
              createTransferRecord({
                direction: 'received',
                fileName: message.fileName,
                fileSize: Number(message.fileSize),
                status: 'failed',
                error: errorMessage,
              }),
            );
            setLastTransferEvent({
              id: Date.now(),
              type: 'error',
              message: errorMessage,
            });
            return;
          }

          storeIncomingFile(message)
            .then((record) => {
              if (!mounted) return;
              recordTransfer(record);
              setLastTransferEvent({
                id: Date.now(),
                type: 'success',
                message: `${record.fileName} was received successfully.`,
              });
            })
            .catch((error) => {
              if (!mounted) return;
              recordTransfer(
                createTransferRecord({
                  direction: 'received',
                  fileName: message.fileName,
                  fileSize: Number(message.fileSize),
                  status: 'failed',
                  error: error.message,
                }),
              );
              setLastTransferEvent({
                id: Date.now(),
                type: 'error',
                message: error.message,
              });
            });
          return;
        }

        const responseText =
          message.message ||
          (message.type === 'error'
            ? 'Unable to execute command.'
            : 'Command completed.');

        setMessages((current) => [
          ...current,
          createMessage('assistant', responseText, message.timestamp),
        ]);
      },
    );

    async function loadLocalData() {
      try {
        const [
          savedSettings,
          savedPairing,
          savedTransferHistory,
          savedPermissionState,
          savedSession,
        ] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(PAIRING_KEY),
          loadTransferHistory(),
          loadPermissionState(),
          loadSession(),
        ]);
        if (!mounted) return;

        const parsedSettings = normalizeConnectionSettings(
          parseStoredObject(savedSettings),
        );
        const parsedPairing = parseStoredObject(savedPairing);
        const savedAddress = parsedSettings.serverIp;
        const savedPort = parsedSettings.serverPort;
        const nextPairingData = {
          deviceId: parsedPairing.deviceId || Crypto.randomUUID(),
          deviceName: parsedPairing.deviceName || DEFAULT_DEVICE_NAME,
          paired: parsedPairing.paired === true,
          pairedAt: parsedPairing.pairedAt ?? null,
        };

        setDesktopAddress(savedAddress);
        setDesktopPort(savedPort);
        applyPairingData(nextPairingData);
        transferHistoryRef.current = savedTransferHistory;
        setTransferHistory(savedTransferHistory);
        applyPermissionState(savedPermissionState);
        applySession(savedSession);
        await AsyncStorage.setItem(
          PAIRING_KEY,
          JSON.stringify(nextPairingData),
        );

        if (savedAddress && savedPort) {
          websocketService.connect(savedAddress, savedPort).catch(() => {
            // Status and indefinite retries are managed by the service.
          });
        }
      } catch (error) {
        console.warn('Unable to load OpenX local data.', error);
      } finally {
        if (mounted) {
          setSettingsLoaded(true);
          setPairingLoaded(true);
          setTransfersLoaded(true);
          setPermissionsLoaded(true);
          setSessionLoaded(true);
        }
      }
    }

    loadLocalData();

    return () => {
      mounted = false;
      const pending = pendingPairingRef.current;
      if (pending) clearTimeout(pending.timer);
      pendingPairingRef.current = null;
      unsubscribeStatus();
      unsubscribeMessages();
      websocketService.disconnect();
    };
  }, [
    applyPairingData,
    applyPermissionState,
    applySession,
    recordTransfer,
  ]);

  useEffect(() => {
    let timer;

    const checkExpiration = () => {
      const remaining = sessionRef.current.expiresAt - Date.now();
      if (!isSessionValid(sessionRef.current)) {
        setSessionValid(false);
        return;
      }
      timer = setTimeout(checkExpiration, Math.min(remaining + 10, 2147483647));
    };

    if (sessionValid) checkExpiration();
    return () => clearTimeout(timer);
  }, [sessionExpiresAt, sessionValid]);

  const sendMessage = useCallback(
    (text) => {
      const normalizedText = text.trim();
      if (
        !normalizedText ||
        !paired ||
        !permissionsRef.current.remoteCommands
      ) {
        return false;
      }

      if (!isSessionValid(sessionRef.current)) {
        setMessages((current) => [
          ...current,
          createMessage('assistant', 'Session expired. Please reconnect.'),
        ]);
        setSessionValid(false);
        return true;
      }

      const payload = websocketService.sendCommand(normalizedText, {
        requestId: Crypto.randomUUID(),
        timestamp: Date.now(),
        deviceId: pairingDataRef.current.deviceId,
        sessionToken: sessionRef.current.sessionToken,
      });
      setMessages((current) => [
        ...current,
        createMessage('user', normalizedText, payload?.timestamp),
        ...(!payload
          ? [createMessage('assistant', CONNECTION_ERROR_MESSAGE)]
          : []),
      ]);

      return true;
    },
    [paired],
  );

  const saveSettings = useCallback(async (address, port) => {
    const nextSettings = normalizeConnectionSettings({
      serverIp: address,
      serverPort: port,
    });

    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    setDesktopAddress(nextSettings.serverIp);
    setDesktopPort(nextSettings.serverPort);

    if (nextSettings.serverIp) {
      websocketService
        .connect(nextSettings.serverIp, nextSettings.serverPort)
        .catch(() => {
          // Saving succeeds independently; the UI reflects connection failure.
        });
    } else {
      websocketService.disconnect();
    }
  }, []);

  const testConnection = useCallback((address, port) => {
    return websocketService.connect(address.trim(), port.trim());
  }, []);

  const pairDevice = useCallback((name, token) => {
    const normalizedName = name.trim();
    const normalizedToken = token.trim().toUpperCase();
    const currentPairing = pairingDataRef.current;

    if (!currentPairing.deviceId || !normalizedName || !normalizedToken) {
      return Promise.reject(new Error('Device name and pairing code are required.'));
    }

    if (websocketService.getStatus() !== 'connected') {
      return Promise.reject(new Error(CONNECTION_ERROR_MESSAGE));
    }

    applySession({ ...EMPTY_SESSION });
    clearPersistedSession().catch(() => {
      console.warn('Unable to reset the previous OpenX session.');
    });

    const previous = pendingPairingRef.current;
    if (previous) {
      clearTimeout(previous.timer);
      previous.reject(new Error('A new pairing attempt was started.'));
    }

    const nextPairingData = {
      ...currentPairing,
      deviceName: normalizedName,
    };
    applyPairingData(nextPairingData);
    AsyncStorage.setItem(PAIRING_KEY, JSON.stringify(nextPairingData)).catch(
      () => {
        // Pair success performs a required persistence check before resolving.
      },
    );

    return new Promise((resolve, reject) => {
      const pending = {
        deviceName: normalizedName,
        resolve,
        reject,
        timer: null,
      };

      pending.timer = setTimeout(() => {
        if (pendingPairingRef.current !== pending) return;
        pendingPairingRef.current = null;
        reject(new Error('Pairing request timed out.'));
      }, PAIRING_TIMEOUT_MS);

      pendingPairingRef.current = pending;
      const sent = websocketService.sendPairRequest(
        currentPairing.deviceId,
        normalizedName,
        normalizedToken,
      );

      if (!sent) {
        clearTimeout(pending.timer);
        pendingPairingRef.current = null;
        reject(new Error(CONNECTION_ERROR_MESSAGE));
      }
    });
  }, [applyPairingData, applySession]);

  const sendFile = useCallback(
    async (file) => {
      const pairingData = pairingDataRef.current;

      if (!pairingData.paired) {
        throw new Error('Pair device before transferring files.');
      }

      if (!permissionsRef.current.fileTransfer) {
        throw new Error('File transfers disabled by desktop.');
      }

      if (!permissionsRef.current.sendFiles) {
        throw new Error('Sending files disabled by desktop.');
      }

      if (!isSessionValid(sessionRef.current)) {
        setSessionValid(false);
        throw new Error('Session expired. Please reconnect.');
      }

      if (websocketService.getStatus() !== 'connected') {
        throw new Error(
          'Connection lost. Reconnect to OpenX Desktop and try again.',
        );
      }

      try {
        const outgoingFile = await prepareOutgoingFile(file);
        if (!permissionsRef.current.fileTransfer) {
          throw new Error('File transfers disabled by desktop.');
        }
        if (!permissionsRef.current.sendFiles) {
          throw new Error('Sending files disabled by desktop.');
        }
        const sent = await websocketService.sendFileTransfer({
          requestId: Crypto.randomUUID(),
          timestamp: Date.now(),
          deviceId: pairingData.deviceId,
          sessionToken: sessionRef.current.sessionToken,
          ...outgoingFile,
        });

        if (!sent) {
          throw new Error(
            'Transfer failed. Reconnect to OpenX Desktop and try again.',
          );
        }

        return recordTransfer(
          createTransferRecord({
            direction: 'sent',
            fileName: outgoingFile.fileName,
            fileSize: outgoingFile.fileSize,
            status: 'sent',
          }),
        );
      } catch (error) {
        recordTransfer(
          createTransferRecord({
            direction: 'sent',
            fileName: file?.fileName,
            fileSize: file?.fileSize,
            status: 'failed',
            error: error.message,
          }),
        );
        throw error;
      }
    },
    [recordTransfer],
  );

  const clearTransferEvent = useCallback(() => {
    setLastTransferEvent(null);
  }, []);

  const value = useMemo(
    () => ({
      messages,
      connectionStatus,
      desktopAddress,
      desktopPort,
      settingsLoaded,
      deviceId,
      deviceName,
      paired,
      pairedAt,
      pairingLoaded,
      transferHistory,
      transfersLoaded,
      lastTransferEvent,
      permissions,
      permissionsLastUpdated,
      permissionsLoaded,
      sessionValid,
      sessionLoaded,
      sendMessage,
      saveSettings,
      testConnection,
      pairDevice,
      sendFile,
      clearTransferEvent,
    }),
    [
      messages,
      connectionStatus,
      desktopAddress,
      desktopPort,
      settingsLoaded,
      deviceId,
      deviceName,
      paired,
      pairedAt,
      pairingLoaded,
      transferHistory,
      transfersLoaded,
      lastTransferEvent,
      permissions,
      permissionsLastUpdated,
      permissionsLoaded,
      sessionValid,
      sessionLoaded,
      sendMessage,
      saveSettings,
      testConnection,
      pairDevice,
      sendFile,
      clearTransferEvent,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider.');
  }
  return context;
}
