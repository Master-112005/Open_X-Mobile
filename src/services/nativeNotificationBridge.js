import { Linking, NativeEventEmitter, NativeModules, Platform } from 'react-native';

const MODULE_NAME = 'OpenXNotificationListener';
const RECEIVED_EVENT = 'OpenXNotificationReceived';

const getNativeModule = () => {
  if (Platform.OS !== 'android') return null;
  return NativeModules[MODULE_NAME] || null;
};

const normalizeNativeNotification = (payload = {}) => {
  const now = Date.now();
  const packageName = String(payload.packageName || payload.pkg || '').trim();
  const appName = String(payload.appName || payload.applicationName || packageName || 'Android').trim();
  const title = String(payload.title || payload.notificationTitle || appName || 'Notification').trim();
  const message = String(payload.message || payload.text || payload.body || payload.bigText || '').trim();

  return {
    notificationId: String(payload.notificationId || payload.id || payload.key || `${packageName || appName}-${now}`),
    appName,
    packageName,
    title,
    message,
    category: 'phone',
    priority: String(payload.priority || payload.importance || 'normal').toLowerCase(),
    timestamp: Number(payload.timestamp || payload.postTime) || now,
    repeatCount: Math.max(1, Math.round(Number(payload.repeatCount) || 1)),
    groupKey: String(payload.groupKey || payload.group || packageName || appName || 'android').toLowerCase(),
    source: 'android-notification-listener',
  };
};

export const isNativeNotificationBridgeAvailable = () => Boolean(getNativeModule());

export const openNotificationAccessSettings = async () => {
  if (Platform.OS !== 'android') return false;
  const nativeModule = getNativeModule();
  try {
    if (typeof nativeModule?.openNotificationAccessSettings === 'function') {
      await nativeModule.openNotificationAccessSettings();
      return true;
    }
    await Linking.openSettings();
  } catch {
    return false;
  }
  return false;
};

export const subscribeToNativeNotifications = (listener) => {
  const nativeModule = getNativeModule();
  if (!nativeModule || typeof listener !== 'function') return () => {};

  let subscription = null;
  try {
    const emitter = new NativeEventEmitter(nativeModule);
    subscription = emitter.addListener(RECEIVED_EVENT, (payload) => {
      listener(normalizeNativeNotification(payload));
    });
    const started = nativeModule.start?.();
    if (started && typeof started.catch === 'function') started.catch(() => {});
  } catch {
    return () => {};
  }

  return () => {
    try {
      subscription?.remove?.();
      const stopped = nativeModule.stop?.();
      if (stopped && typeof stopped.catch === 'function') stopped.catch(() => {});
    } catch {}
  };
};
