import { Link, useLocalSearchParams } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

export default function StoriesScreen() {
  const { profileId } = useLocalSearchParams<{ profileId?: string }>()
  const suffix = profileId ? `?profileId=${encodeURIComponent(profileId)}` : ''

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose an adventure</Text>
      <Text>Keep brushing while the story unfolds.</Text>
      <Link href={`/session/sky-reef${suffix}`} asChild>
        <Pressable accessibilityRole="button" style={styles.storyCard}>
          <Text style={styles.storyTitle}>Sky Reef</Text>
          <Text>A gentle voyage through glowing clouds.</Text>
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, padding: 24, justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '700' },
  storyCard: { borderRadius: 16, borderWidth: 2, gap: 8, padding: 20 },
  storyTitle: { fontSize: 24, fontWeight: '700' },
})
