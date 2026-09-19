import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Camera, useCameraDevice } from 'react-native-vision-camera'

import type { AgeBand } from '../../src/domain/profile/types'
import type { StoryGraph, StoryState } from '../../src/domain/story/types'
import { advanceStory } from '../../src/domain/story/storyGraph'
import storyGraphJson from '../../src/content/story/sky-reef.json'
import { LocalAudioPlayer, type AudioPlayer } from '../../src/audio/audioPlayer'
import { SessionEngine, SystemMonotonicClock, type SessionInput } from '../../src/domain/session/sessionEngine'
import type { KeepAwakeController } from '../../src/platform/keepAwake'
import { ExpoKeepAwakeController } from '../../src/platform/keepAwake'
import { requestCameraPermission } from '../../src/platform/permissions'
import type { SensingAdapter } from '../../src/sensing/sensingAdapter'
import { NativeSensingAdapter } from '../../src/sensing/nativeSensingAdapter'
import { openAppDatabase } from '../../src/storage/database'
import { createSessionRepository } from '../../src/storage/sessionRepository'

const storyGraph = storyGraphJson as unknown as StoryGraph

export interface SessionScreenProps {
  storyId: string
  profileId?: string
  ageBand?: AgeBand
  sensing?: SensingAdapter
  audio?: AudioPlayer
  keepAwake?: KeepAwakeController
}

const durationMs = 120_000

export default function SessionRoute() {
  const { storyId, profileId } = useLocalSearchParams<{ storyId: string; profileId?: string }>()
  return <SessionScreen storyId={storyId ?? 'sky-reef'} profileId={profileId} />
}

export function SessionScreen({
  storyId,
  profileId,
  ageBand = '6-7',
  sensing: sensingOverride,
  audio: audioOverride,
  keepAwake: keepAwakeOverride,
}: SessionScreenProps) {
  const sensing = useMemo(() => sensingOverride ?? new NativeSensingAdapter(), [sensingOverride])
  const audio = useMemo(() => audioOverride ?? new LocalAudioPlayer(), [audioOverride])
  const keepAwake = useMemo(() => keepAwakeOverride ?? new ExpoKeepAwakeController(), [keepAwakeOverride])
  const engine = useMemo(
    () => new SessionEngine({ clock: new SystemMonotonicClock(), sensing, audio, keepAwake }),
    [audio, keepAwake, sensing],
  )
  const [started, setStarted] = useState(false)
  const [audioOnly, setAudioOnly] = useState(false)
  const [wakeLockRevoked, setWakeLockRevoked] = useState(false)
  const [snapshot, setSnapshot] = useState(engine.snapshot())
  const [storyState, setStoryState] = useState<StoryState>({
    storyId,
    nodeId: storyGraph.startNodeId,
    choices: {},
  })
  const cameraDevice = useCameraDevice('front')

  useEffect(() => {
    const unsubscribe = keepAwake.onStateChange?.((state) => {
      if (state === 'revoked') setWakeLockRevoked(true)
    })
    return unsubscribe
  }, [keepAwake])

  useEffect(() => {
    if (!started) return
    const interval = setInterval(() => setSnapshot(engine.snapshot()), 250)
    return () => clearInterval(interval)
  }, [engine, started])

  const node = storyGraph.nodes[storyState.nodeId]

  async function startAdventure() {
    const permission = await requestCameraPermission()
    setAudioOnly(permission !== 'granted')
    const input: SessionInput = { profileId: profileId ?? 'local', storyId, durationMs }
    await audio.load(node.type === 'choice' ? node.promptAssetId : node.assetId)
    await engine.start(input)
    setStarted(true)
    setSnapshot(engine.snapshot())
  }

  async function advance() {
    if (!started || node.type === 'ending') return
    const nextState = node.type === 'narration'
      ? advanceStory(storyGraph, storyState, { type: 'continue' })
      : advanceStory(storyGraph, storyState, { type: 'choose', optionId: storyState.choices[storyState.nodeId] ?? node.options[0].id, sessionBand: 'steady' })
    setStoryState(nextState)
    const nextNode = storyGraph.nodes[nextState.nodeId]
    await audio.load(nextNode.type === 'choice' ? nextNode.promptAssetId : nextNode.assetId)
  }

  async function choose(optionId: string) {
    const nextState = advanceStory(storyGraph, storyState, { type: 'choose', optionId, sessionBand: 'steady' })
    setStoryState(nextState)
    const nextNode = storyGraph.nodes[nextState.nodeId]
    await audio.load(nextNode.type === 'choice' ? nextNode.promptAssetId : nextNode.assetId)
  }

  async function finish() {
    const result = await engine.stop()
    if (profileId) {
      const database = await openAppDatabase()
      await createSessionRepository(database).saveSummary(profileId, {
        profileId,
        storyId,
        completed: result.completedDurationMs >= durationMs,
        completedDurationMs: result.completedDurationMs,
        engagementBand: result.engagementBand,
        confidence: result.confidence,
        interrupted: result.interrupted,
      })
    }
    router.replace(`/complete/${Date.now().toString(36)}`)
  }

  if (!started) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sky Reef is ready</Text>
        <Text>Keep brushing gently while the adventure unfolds.</Text>
        <Text>Ask a caregiver to stay nearby while you brush.</Text>
        <Pressable accessibilityRole="button" onPress={() => void startAdventure()} style={styles.primaryButton}>
          <Text>Start adventure</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Brush session in progress</Text>
      <Text>{Math.ceil(snapshot.remainingMs / 1000)} seconds left</Text>
      {audioOnly ? <Text>Audio-only mode</Text> : null}
      {audioOnly ? <Text>The adventure can still continue</Text> : null}
      {wakeLockRevoked ? <Text>Screen may dim</Text> : null}
      {!audioOnly && cameraDevice ? <Camera device={cameraDevice} isActive={snapshot.status === 'running'} style={styles.camera} /> : null}
      <Text>{snapshot.sensingStatus === 'ready' ? 'Sensing ready' : 'Sensing is taking a break'}</Text>
      {node.type === 'choice' ? (
        <>
          <Text style={styles.prompt}>{node.prompt[ageBand]}</Text>
          {node.options.map((option) => (
            <Pressable accessibilityRole="button" key={option.id} onPress={() => void choose(option.id)} style={styles.choiceButton}>
              <Text>{option.label[ageBand]}</Text>
            </Pressable>
          ))}
        </>
      ) : (
        <>
          {node.type === 'narration' ? <Text>Listen for the next part of the story.</Text> : <Text>{node.summaryKey}</Text>}
          {node.type === 'narration' ? (
            <Pressable accessibilityRole="button" onPress={() => void advance()} style={styles.choiceButton}>
              <Text>Continue adventure</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => void finish()} style={styles.primaryButton}>
              <Text>Finish adventure</Text>
            </Pressable>
          )}
        </>
      )}
      <Pressable accessibilityLabel="Pause adventure" accessibilityRole="button" onPress={() => void engine.pause().then(() => setSnapshot(engine.snapshot()))} style={styles.secondaryButton}>
        <Text>Pause</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  prompt: { fontSize: 21, fontWeight: '600' },
  camera: { borderRadius: 16, height: 180, width: '100%' },
  primaryButton: { alignItems: 'center', borderRadius: 14, borderWidth: 2, padding: 16 },
  choiceButton: { alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 16 },
  secondaryButton: { alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12 },
})
