import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { initDb } from '../database/storage';

export default function RootLayout() {
  useEffect(() => {
    initDb();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#233d4d' },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: '#ffffff', fontSize: 17 },
        headerTintColor: '#fe7f2d',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Clockea' }} />
      <Stack.Screen name="clock-in" options={{ title: 'Clock In' }} />
      <Stack.Screen name="working" options={{ headerShown: false }} />
      <Stack.Screen name="session-recap" options={{ headerShown: false }} />
      <Stack.Screen name="history" options={{ title: 'History' }} />
      <Stack.Screen name="stats" options={{ title: 'Analytics' }} />
    </Stack>
  );
}
