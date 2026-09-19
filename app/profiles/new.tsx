import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import type { AgeBand } from '../../src/domain/profile/types'
import { openAppDatabase } from '../../src/storage/database'
import { createProfileRepository } from '../../src/storage/profileRepository'

const ageBands: AgeBand[] = ['4-5', '6-7', '8-9']

export default function NewProfileScreen() {
  const [nickname, setNickname] = useState('')
  const [ageBand, setAgeBand] = useState<AgeBand>('4-5')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveProfile() {
    setSaving(true)
    setError(null)
    try {
      const database = await openAppDatabase()
      await createProfileRepository(database).create({ nickname, ageBand })
      router.replace('/')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a child profile</Text>
      <Text>This adult setup stays on this device.</Text>
      <TextInput
        accessibilityLabel="Profile nickname"
        onChangeText={setNickname}
        placeholder="Nickname"
        style={styles.input}
        value={nickname}
      />
      <Text style={styles.label}>Choose an age group</Text>
      <View style={styles.ageChoices}>
        {ageBands.map((band) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: ageBand === band }}
            key={band}
            onPress={() => setAgeBand(band)}
            style={[styles.ageChoice, ageBand === band && styles.selectedChoice]}
          >
            <Text>{band}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={() => void saveProfile()}
        style={styles.primaryButton}
      >
        <Text>{saving ? 'Saving…' : 'Save profile'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
  label: { fontSize: 18, fontWeight: '600' },
  input: { borderRadius: 10, borderWidth: 1, padding: 14 },
  ageChoices: { flexDirection: 'row', gap: 8 },
  ageChoice: { borderRadius: 10, borderWidth: 1, padding: 14 },
  selectedChoice: { backgroundColor: '#DFF4FF' },
  primaryButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 14 },
})
