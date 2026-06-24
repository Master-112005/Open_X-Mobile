import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
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
                <Text style={styles.settingsIcon}>⚙</Text>
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
  header: { backgroundColor: colors.background },
  headerTitle: { fontSize: 19, fontWeight: '700' },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  buttonPressed: { opacity: 0.7 },
  settingsIcon: { color: colors.textSecondary, fontSize: 18 },
});
