import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { StyleSheet } from 'react-native';

import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ProfileScreen from '../screens/ProfileScreen';
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
          headerShown: false,
          headerShadowVisible: false,
          headerTintColor: colors.text,
          animation: 'fade_from_bottom',
          gestureEnabled: true,
        }}
      >
        <Stack.Screen
          component={HomeScreen}
          name="Home"
          options={{ title: 'OpenX' }}
        />
        <Stack.Screen
          component={CalendarScreen}
          name="Calendar"
          options={{ headerTitle: 'Calendar' }}
        />
        <Stack.Screen
          component={SettingsScreen}
          name="Settings"
          options={{ headerTitle: 'Settings' }}
        />
        <Stack.Screen
          component={ProfileScreen}
          name="Profile"
          options={{ headerTitle: 'Profile' }}
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
});
