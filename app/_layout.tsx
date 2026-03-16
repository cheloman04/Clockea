import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onAuthScreen = segments[0] === 'login' || segments[0] === 'register';
    if (!user && !onAuthScreen) {
      router.replace('/login');
    } else if (user && onAuthScreen) {
      router.replace('/');
    }
  }, [loading, router, segments, user]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: '#1e3545' }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#233d4d' },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: '#ffffff', fontSize: 17 },
        headerTintColor: '#fe7f2d',
      }}
    >
      <Stack.Screen name="login"         options={{ headerShown: false }} />
      <Stack.Screen name="register"      options={{ headerShown: false }} />
      <Stack.Screen name="index"         options={{ headerShown: false }} />
      <Stack.Screen name="clock-in"      options={{ title: 'Clock In' }} />
      <Stack.Screen name="working"       options={{ headerShown: false }} />
      <Stack.Screen name="session-recap" options={{ headerShown: false }} />
      <Stack.Screen name="history"       options={{ headerShown: false }} />
      <Stack.Screen name="edit-session"  options={{ title: 'Edit Notes' }} />
      <Stack.Screen name="stats"         options={{ headerShown: false }} />
      <Stack.Screen name="create-team"   options={{ title: 'Create Team' }} />
      <Stack.Screen name="profile"       options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
