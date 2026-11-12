import LinkSense from '@linksense/react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const SDK_KEY = process.env.EXPO_PUBLIC_LINKSENSE_SDK_KEY ?? '';

export default function App() {
  const [deferred, setDeferred] = useState('resolving…');
  const [opened, setOpened] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = LinkSense.onDeepLink(url => setOpened(url));
    LinkSense.configure({ sdkKey: SDK_KEY, logLevel: 'debug' })
      .then(() => LinkSense.start())
      .then(url => setDeferred(url ?? 'none (organic install or warm start)'))
      .catch((error: Error & { code?: string }) => setDeferred(`error ${error.code}: ${error.message}`));
    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LinkSense example</Text>
      <Text testID="deferred">Deferred deep link: {deferred}</Text>
      <Text testID="opened">Last link open: {opened ?? '—'}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 20, fontWeight: '600' },
});
