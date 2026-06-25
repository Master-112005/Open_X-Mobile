import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import PairDeviceScreen from '../screens/PairDeviceScreen';
import QRPairingScreen from '../screens/QRPairingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TransfersScreen from '../screens/TransfersScreen';
import { colors } from '../styles/theme';

const Stack = createNativeStackNavigator();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          contentStyle: styles.content,
          headerShadowVisible: false,
          headerStyle: styles.header,
          headerTintColor: colors.text,
          headerTitleStyle: styles.headerTitle,
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen
          component={HomeScreen}
          name="Home"
          options={({ navigation }) => ({
            headerTitle: 'OpenX',
            headerRight: () => (
              <Pressable
                accessibilityLabel="Open settings"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => navigation.navigate('Settings')}
                style={({ pressed }) => [
                  styles.settingsButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <LinearGradient
                  colors={[colors.surfaceElevated, colors.surface]}
                  style={styles.settingsGradient}
                >
                  <Text style={styles.settingsIcon}>{'\u2699'}</Text>
                </LinearGradient>
              </Pressable>
            ),
          })}
        />
        <Stack.Screen
          component={SettingsScreen}
          name="Settings"
          options={{ headerTitle: 'Settings' }}
        />
        <Stack.Screen
          component={PairDeviceScreen}
          name="PairDevice"
          options={{ headerTitle: 'Pair Device' }}
        />
        <Stack.Screen
          component={QRPairingScreen}
          name="QRPairing"
          options={{ headerTitle: 'Scan QR' }}
        />
        <Stack.Screen
          component={TransfersScreen}
          name="Transfers"
          options={{ headerTitle: 'Transfers' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: colors.background },
  header: { backgroundColor: colors.backgroundAlt },
  headerTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  settingsButton: {
    borderRadius: 12,
    height: 38,
    overflow: 'hidden',
    width: 38,
  },
  settingsGradient: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.7 },
  settingsIcon: { color: colors.textSecondary, fontSize: 18 },
});
