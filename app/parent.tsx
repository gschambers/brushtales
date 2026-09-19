import { Link } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import type { AgeBand, Profile } from '../src/domain/profile/types'
import type { SessionSummary } from '../src/domain/session/types'
import { openAppDatabase } from '../src/storage/database'
import { createProfileRepository } from '../src/storage/profileRepository'
import { createSessionRepository } from '../src/storage/sessionRepository'
import { ReminderService } from '../src/platform/reminders'

const ageBands: AgeBand[] = ['4-5', '6-7', '8-9']

export default function ParentScreen() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [history, setHistory] = useState<Record<string, SessionSummary[]>>({})
  const [verified, setVerified] = useState(false)
  const [morning, setMorning] = useState('07:30')
  const [evening, setEvening] = useState('19:30')
  const [reminderMessage, setReminderMessage] = useState<string | null>(null)
  const reminders = useMemo(() => new ReminderService(), [])

  async function refresh() {
    const database = await openAppDatabase()
    const nextProfiles = await createProfileRepository(database).list()
    const sessionRepository = createSessionRepository(database)
    const nextHistory = await Promise.all(nextProfiles.map(async (profile) => [
      profile.id,
      await sessionRepository.listForProfile(profile.id),
    ] as const))
    setProfiles(nextProfiles)
    setHistory(Object.fromEntries(nextHistory))
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

  async function saveReminders() {
    const permission = await reminders.requestPermission()
    if (permission !== 'granted') {
      setReminderMessage('Reminders are unavailable without notification permission. Your times were not sent anywhere.')
      return
    }
    await reminders.scheduleMorningEvening({ morning: morning || null, evening: evening || null })
    setReminderMessage('Morning and evening reminders saved on this device.')
  }

  async function changeAgeBand(profile: Profile) {
    const currentIndex = ageBands.indexOf(profile.ageBand)
    const nextAgeBand = ageBands[(currentIndex + 1) % ageBands.length]
    const database = await openAppDatabase()
    await createProfileRepository(database).updateAgeBand(profile.id, nextAgeBand)
    await refresh()
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adult setup</Text>
      <Text>Profiles and progress stay on this device.</Text>
      <Text>No camera frames, face images, voice recordings, or biometric identifiers are stored.</Text>
      {!verified ? (
        <Pressable accessibilityRole="button" onPress={() => setVerified(true)} style={styles.button}>
          <Text>I am an adult — continue</Text>
        </Pressable>
      ) : null}
      {verified ? (
        <>
      <Link href="/profiles/new" asChild>
        <Pressable accessibilityRole="button" style={styles.button}>
          <Text>Create a child profile</Text>
        </Pressable>
      </Link>
      <Text style={styles.sectionTitle}>Reminders</Text>
      <TextInput accessibilityLabel="Morning reminder time" onChangeText={setMorning} placeholder="Morning (HH:MM)" style={styles.input} value={morning} />
      <TextInput accessibilityLabel="Evening reminder time" onChangeText={setEvening} placeholder="Evening (HH:MM)" style={styles.input} value={evening} />
      <Pressable accessibilityRole="button" onPress={() => void saveReminders()} style={styles.button}>
        <Text>Save reminders</Text>
      </Pressable>
      {reminderMessage ? <Text>{reminderMessage}</Text> : null}
      {profiles.map((profile) => (
        <View key={profile.id} style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Text>{profile.nickname} · age {profile.ageBand}</Text>
            <Pressable accessibilityLabel={`Change ${profile.nickname} age group`} accessibilityRole="button" onPress={() => void changeAgeBand(profile)}>
              <Text>Change age group</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionTitle}>Coarse session history</Text>
          {(history[profile.id] ?? []).length === 0 ? <Text>No sessions yet.</Text> : null}
          {(history[profile.id] ?? []).map((summary, index) => (
            <Text key={`${summary.storyId}-${index}`}>
              {summary.createdAt ? new Date(summary.createdAt).toLocaleDateString() : 'Date unavailable'} · {summary.storyId} · {Math.round(summary.completedDurationMs / 1000)} seconds · {summary.completed ? 'completed' : 'stopped'}
            </Text>
          ))}
          <Pressable accessibilityRole="button" onPress={() => confirmDelete(profile)}>
            <Text>Delete profile</Text>
          </Pressable>
        </View>
      ))}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  input: { borderRadius: 10, borderWidth: 1, padding: 12 },
  button: { alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 14 },
  profileCard: { borderBottomWidth: 1, gap: 8, paddingVertical: 14 },
  profileRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
})
