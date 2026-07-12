const packageJson = require('./package.json');

module.exports = {
  expo: {
    name: 'OpenX Mobile',
    slug: 'openx-mobile',
    version: packageJson.version,
    orientation: 'portrait',
    icon: './assets/logo.png',
    userInterfaceStyle: 'dark',
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: false
          }
        }
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Allow OpenX Mobile to scan pairing QR codes.',
          microphonePermission: false,
          recordAudioAndroid: false,
          barcodeScannerEnabled: true
        }
      ],
      'expo-font',
      'expo-notifications',
      'expo-secure-store',
      'expo-sharing'
    ],
    android: {
      package: 'com.openx.mobile',
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        foregroundImage: './assets/logo.png',
        backgroundColor: '#070B14'
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        'android.permission.CAMERA',
        'android.permission.POST_NOTIFICATIONS'
      ]
    },
    extra: {
      eas: {
        projectId: 'a47c13bd-78f2-43f7-a225-c97ce99f417c'
      }
    },
    ios: {
      bundleIdentifier: 'com.openx.mobile',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    }
  }
};
