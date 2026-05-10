import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    // Some Android deep links can open with an unexpected initial path.
    // Redirect to the app root so users always land on the team selection screen.
    const timer = setTimeout(() => {
      router.replace('/');
    }, 50);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#4caf50" />
      <Text style={styles.text}>Opening team selection...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    color: '#d5d5d5',
    fontSize: 14,
  },
});
