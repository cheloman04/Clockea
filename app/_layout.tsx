import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function AppLogo() {
  return (
    <Text style={{ fontSize: 20, fontWeight: '900', color: '#fe7f2d', letterSpacing: 4, marginLeft: 16, marginRight: 12 }}>
      CLOCKEA
    </Text>
  );
}

function ProfileButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 2,
        borderColor: '#fe7f2d',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#233d4d',
        marginRight: 20,
      }}
      onPress={() => router.push('/profile')}
      activeOpacity={0.85}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fe7f2d', marginBottom: 2 }} />
      <View style={{ width: 18, height: 8, borderTopLeftRadius: 9, borderTopRightRadius: 9, backgroundColor: '#fe7f2d' }} />
    </TouchableOpacity>
  );
}

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
  }, [user, loading]);

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
        headerLeftContainerStyle: { paddingLeft: 4 },
        headerRightContainerStyle: { paddingRight: 4 },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: '', headerLeft: () => <AppLogo />, headerRight: () => <ProfileButton /> }} />
      <Stack.Screen name="clock-in" options={{ title: 'Clock In' }} />
      <Stack.Screen name="working" options={{ headerShown: false }} />
      <Stack.Screen name="session-recap" options={{ headerShown: false }} />
      <Stack.Screen name="history" options={{ title: 'History' }} />
      <Stack.Screen name="edit-session" options={{ title: 'Edit Notes' }} />
      <Stack.Screen name="stats" options={{ title: 'Analytics' }} />
      <Stack.Screen name="create-team" options={{ title: 'Create Team' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
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
