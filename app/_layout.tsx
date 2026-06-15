import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <> 
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
          contentStyle: { backgroundColor: '#0a0a0a' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'World Cup 2026', headerShown: false }} />
        <Stack.Screen name="[teamId]" options={{ title: '', headerTransparent: true }} />
      </Stack>
    </>
  );
}
