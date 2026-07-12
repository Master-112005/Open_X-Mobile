const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const MODULE_DIR = 'notifications';
const MODULE_CLASS = 'OpenXNotificationModule';
const PACKAGE_CLASS = 'OpenXNotificationPackage';
const SERVICE_CLASS = 'OpenXNotificationListenerService';
const SERVICE_NAME = `.${MODULE_DIR}.${SERVICE_CLASS}`;

function writeIfChanged(filePath, contents) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function kotlinPackageName(config) {
  return config.android?.package || 'com.openx.mobile';
}

function kotlinSourceRoot(platformProjectRoot, packageName) {
  return path.join(platformProjectRoot, 'app', 'src', 'main', 'java', ...packageName.split('.'));
}

function notificationModuleSource(packageName) {
  return `package ${packageName}.${MODULE_DIR}

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

class ${MODULE_CLASS}(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "OpenXNotificationListener"

  init {
    reactContextRef = WeakReference(reactContext)
  }

  @ReactMethod
  fun addListener(eventName: String) {
  }

  @ReactMethod
  fun removeListeners(count: Int) {
  }

  @ReactMethod
  fun start(promise: Promise) {
    promise.resolve(isNotificationAccessEnabled(reactContext))
  }

  @ReactMethod
  fun stop(promise: Promise) {
    promise.resolve(true)
  }

  @ReactMethod
  fun openNotificationAccessSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("open-settings-failed", error)
    }
  }

  companion object {
    const val EVENT_NAME = "OpenXNotificationReceived"
    private var reactContextRef: WeakReference<ReactApplicationContext>? = null

    fun emitNotification(payload: WritableMap) {
      val context = reactContextRef?.get() ?: return
      if (!context.hasActiveCatalystInstance()) return
      context
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_NAME, payload)
    }

    private fun isNotificationAccessEnabled(context: Context): Boolean {
      val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
      val expected = ComponentName(context, ${SERVICE_CLASS}::class.java).flattenToString()
      return TextUtils.SimpleStringSplitter(':').let { splitter ->
        splitter.setString(flat)
        splitter.any { ComponentName.unflattenFromString(it)?.flattenToString() == expected }
      }
    }
  }
}
`;
}

function notificationPackageSource(packageName) {
  return `package ${packageName}.${MODULE_DIR}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ${PACKAGE_CLASS} : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(${MODULE_CLASS}(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;
}

function notificationServiceSource(packageName) {
  return `package ${packageName}.${MODULE_DIR}

import android.app.Notification
import android.content.pm.PackageManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.facebook.react.bridge.Arguments

class ${SERVICE_CLASS} : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null || sbn.packageName == packageName) return
    val extras = sbn.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
    val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()
    val message = listOf(bigText, text, subText).firstOrNull { it.isNotBlank() }.orEmpty()
    if (title.isBlank() && message.isBlank()) return

    val payload = Arguments.createMap()
    payload.putString("notificationId", sbn.key)
    payload.putString("key", sbn.key)
    payload.putString("packageName", sbn.packageName)
    payload.putString("appName", appNameForPackage(sbn.packageName))
    payload.putString("title", title)
    payload.putString("message", message)
    payload.putString("groupKey", sbn.notification.group ?: sbn.packageName)
    payload.putString("priority", priorityLabel(sbn))
    payload.putDouble("timestamp", sbn.postTime.toDouble())
    OpenXNotificationModule.emitNotification(payload)
  }

  private fun appNameForPackage(packageName: String): String {
    return try {
      val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
      packageManager.getApplicationLabel(applicationInfo).toString()
    } catch (_: PackageManager.NameNotFoundException) {
      packageName
    }
  }

  private fun priorityLabel(sbn: StatusBarNotification): String {
    return when {
      sbn.notification.priority >= Notification.PRIORITY_HIGH -> "high"
      sbn.notification.priority <= Notification.PRIORITY_LOW -> "low"
      else -> "normal"
    }
  }
}
`;
}

function patchMainApplication(platformProjectRoot, packageName) {
  const appRoot = kotlinSourceRoot(platformProjectRoot, packageName);
  const candidates = [
    path.join(appRoot, 'MainApplication.kt'),
    path.join(appRoot, 'MainApplication.java')
  ];
  const mainApplicationPath = candidates.find(candidate => fs.existsSync(candidate));
  if (!mainApplicationPath) return;

  let source = fs.readFileSync(mainApplicationPath, 'utf8');
  if (source.includes(`${MODULE_DIR}.${PACKAGE_CLASS}`)) return;

  if (mainApplicationPath.endsWith('.kt')) {
    const importLine = `import ${packageName}.${MODULE_DIR}.${PACKAGE_CLASS}\n`;
    if (!source.includes(importLine)) {
      source = /import com\.facebook\.react\.defaults\.DefaultReactNativeHost\n/.test(source)
        ? source.replace(/import com\.facebook\.react\.defaults\.DefaultReactNativeHost\n/, match => `${match}${importLine}`)
        : source.replace(/package [^\n]+\n/, match => `${match}\n${importLine}`);
    }
    source = source.replace(
      /PackageList\(this\)\.packages\.apply\s*\{/,
      match => `${match}\n        add(${PACKAGE_CLASS}())`
    );
  } else {
    const importLine = `import ${packageName}.${MODULE_DIR}.${PACKAGE_CLASS};\n`;
    if (!source.includes(importLine)) {
      source = /import com\.facebook\.react\.PackageList;\n/.test(source)
        ? source.replace(/import com\.facebook\.react\.PackageList;\n/, match => `${match}${importLine}`)
        : source.replace(/package [^\n]+;\n/, match => `${match}\n${importLine}`);
    }
    source = source.replace(
      /List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);\n/,
      match => `${match}          packages.add(new ${PACKAGE_CLASS}());\n`
    );
  }

  fs.writeFileSync(mainApplicationPath, source);
}

function addNotificationListenerService(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application.service = application.service || [];
  const existing = application.service.find(service => service.$?.['android:name'] === SERVICE_NAME);
  const service = existing || { $: { 'android:name': SERVICE_NAME } };
  service.$ = {
    ...service.$,
    'android:name': SERVICE_NAME,
    'android:label': 'OpenX Notification Listener',
    'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
    'android:exported': 'true'
  };
  service['intent-filter'] = [{
    action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }]
  }];
  if (!existing) application.service.push(service);
  return androidManifest;
}

module.exports = function withOpenXNotificationListener(config) {
  config = withAndroidManifest(config, nextConfig => {
    nextConfig.modResults = addNotificationListenerService(nextConfig.modResults);
    return nextConfig;
  });

  return withDangerousMod(config, ['android', nextConfig => {
    const packageName = kotlinPackageName(nextConfig);
    const sourceRoot = path.join(kotlinSourceRoot(nextConfig.modRequest.platformProjectRoot, packageName), MODULE_DIR);
    writeIfChanged(path.join(sourceRoot, `${MODULE_CLASS}.kt`), notificationModuleSource(packageName));
    writeIfChanged(path.join(sourceRoot, `${PACKAGE_CLASS}.kt`), notificationPackageSource(packageName));
    writeIfChanged(path.join(sourceRoot, `${SERVICE_CLASS}.kt`), notificationServiceSource(packageName));
    patchMainApplication(nextConfig.modRequest.platformProjectRoot, packageName);
    return nextConfig;
  }]);
};
