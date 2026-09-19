import { Link } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import type { Profile } from '../src/domain/profile/types'
import { openAppDatabase } from '../src/storage/database'
import { createProfileRepository } from '../src/storage/profileRepository'

export default function ParentScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([])

  async function refresh() {
    const database = await openAppDatabase()
    setProfiles(await createProfileRepository(database).list())
  }

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

    return () => {
      active = false
    }
  }, [])

  function confirmDelete(profile: Profile) {
    Alert.alert(
      'Delete this profile?',
      `This removes ${profile.nickname}'s local progress from this device.`,
      [
        { text: 'Keep profile', style: 'cancel' },
        {
          text: 'I am an adult — delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const database = await openAppDatabase()
              await createProfileRepository(database).delete(profile.id)
              await refresh()
            })()
          },
        },
      ],
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adult setup</Text>
      <Text>Profiles and progress stay on this device.</Text>
      <Link href="/profiles/new" asChild>
        <Pressable accessibilityRole="button" style={styles.button}>
          <Text>Create a child profile</Text>
        </Pressable>
      </Link>
      {profiles.map((profile) => (
        <View key={profile.id} style={styles.profileRow}>
          <Text>{profile.nickname}</Text>
          <Pressable accessibilityRole="button" onPress={() => confirmDelete(profile)}>
            <Text>Delete</Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
  button: { alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 14 },
  profileRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
})
