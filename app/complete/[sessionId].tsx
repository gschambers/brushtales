import { Link, useLocalSearchParams } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

export default function CompleteScreen() {
  const { completed } = useLocalSearchParams<{ completed?: string }>()
  const didComplete = completed === 'true'
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{didComplete ? 'Adventure complete!' : 'Adventure saved for now'}</Text>
      <Text>{didComplete ? 'You kept exploring with the Sky Reef crew.' : 'The Sky Reef crew will be ready whenever you want to continue.'}</Text>
      <Link href="/" asChild>
        <Pressable accessibilityRole="button" style={styles.button}>
          <Text>Back to profiles</Text>
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, padding: 24, justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '700' },
  button: { alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 14 },
})
