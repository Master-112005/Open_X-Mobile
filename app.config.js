const packageJson = require('./package.json');

module.exports = {
  expo: {
    name: 'OpenX Mobile',
    slug: 'openxmobile',
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

    ios: {
      bundleIdentifier: 'com.openx.mobile',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },

    extra: {
      eas: {
        projectId: '36f7718d-5153-4915-889f-09613b0a433b'
      }
    }
  }
};
