import { Link, router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { Profile } from '../src/domain/profile/types'
import { openAppDatabase } from '../src/storage/database'
import { createProfileRepository } from '../src/storage/profileRepository'

export default function HomeScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void openAppDatabase()
      .then((database) => createProfileRepository(database).list())
      .then((nextProfiles) => {
        if (active) setProfiles(nextProfiles)
      })
      .catch(() => {
        if (active) setProfiles([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose your explorer</Text>
      <Text style={styles.subtitle}>Pick a profile to begin an adventure.</Text>
      {loading ? <Text>Getting things ready…</Text> : null}
      {!loading && profiles.length === 0 ? <Text>No explorers yet.</Text> : null}
      {profiles.map((profile) => (
        <Pressable
          accessibilityRole="button"
          key={profile.id}
          style={styles.profile}
          onPress={() => router.push(`/stories?profileId=${encodeURIComponent(profile.id)}`)}
        >
          <Text style={styles.avatar} accessibilityLabel={`${profile.avatarKey} avatar`}>
            ★
          </Text>
          <Text style={styles.profileName}>{profile.nickname}</Text>
        </Pressable>
      ))}
      <Link href="/parent" asChild>
        <Pressable accessibilityRole="button" style={styles.secondaryButton}>
          <Text>Adult setup</Text>
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, padding: 24, justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '700' },
  subtitle: { fontSize: 18 },
  profile: { alignItems: 'center', borderRadius: 16, borderWidth: 2, padding: 16 },
  avatar: { fontSize: 36 },
  profileName: { fontSize: 20, fontWeight: '600' },
  secondaryButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 14 },
})
