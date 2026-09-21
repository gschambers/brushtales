import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppState, View } from 'react-native'

import type { AgeBand } from '../../src/domain/profile/types'
import { DeterministicAudioPlayer } from '../../src/audio/deterministicAudioPlayer'
import { LocalAudioPlayer, type AudioPlayer } from '../../src/audio/audioPlayer'
import { SystemMonotonicClock, type MonotonicClock } from '../../src/domain/session/sessionEngine'
import type { KeepAwakeController } from '../../src/platform/keepAwake'
import { ExpoKeepAwakeController } from '../../src/platform/keepAwake'
import type { SensingAdapter } from '../../src/sensing/sensingAdapter'
import { DeterministicSensingAdapter } from '../../src/sensing/deterministicSensingAdapter'
import { NativeSensingAdapter } from '../../src/sensing/nativeSensingAdapter'
import { openAppDatabase } from '../../src/storage/database'
import { createProfileRepository } from '../../src/storage/profileRepository'
import { createSessionRepository } from '../../src/storage/sessionRepository'
import { ActScreen } from '../../src/components/session/ActScreen'
import { BrushingSurface } from '../../src/components/session/BrushingSurface'
import { useStorySessionController } from '../../src/session/useStorySessionController'

const durationMs = 120_000

export interface SessionScreenProps {
  storyId: string
  profileId?: string
  ageBand?: AgeBand
  sensing?: SensingAdapter
  audio?: AudioPlayer
  keepAwake?: KeepAwakeController
  clock?: MonotonicClock
}

export default function SessionRoute() {
  const { storyId, profileId } = useLocalSearchParams<{ storyId: string; profileId?: string }>()
  const [ageBand, setAgeBand] = useState<AgeBand>('6-7')

  useEffect(() => {
    if (!profileId) return
    void openAppDatabase()
      .then((database) => createProfileRepository(database).get(profileId))
      .then((profile) => {
        if (profile) setAgeBand(profile.ageBand)
      })
      .catch(() => undefined)
  }, [profileId])

  return <SessionScreen ageBand={ageBand} storyId={storyId ?? 'sky-reef'} profileId={profileId} />
}

export function SessionScreen({
  storyId,
  profileId,
  sensing: sensingOverride,
  audio: audioOverride,
  keepAwake: keepAwakeOverride,
  clock: clockOverride,
}: SessionScreenProps) {
  const sensing = useMemo(
    () => sensingOverride ?? (__DEV__ ? new DeterministicSensingAdapter() : new NativeSensingAdapter()),
    [sensingOverride],
  )
  const audio = useMemo(
    () => audioOverride ?? (__DEV__ ? new DeterministicAudioPlayer() : new LocalAudioPlayer()),
    [audioOverride],
  )
  const keepAwake = useMemo(
    () => keepAwakeOverride ?? new ExpoKeepAwakeController(),
    [keepAwakeOverride],
  )
  const clock = useMemo(() => clockOverride ?? new SystemMonotonicClock(), [clockOverride])
  const dependencies = useMemo(() => ({
    audio,
    sensing,
    keepAwake,
    clock,
    profileId: profileId ?? 'local',
    storyId,
    durationMs,
    openingAssetId: 'intro',
    brushingAssetId: 'session-fallback',
    closingAssetId: 'closing',
  }), [audio, clock, keepAwake, profileId, sensing, storyId])
  const { controller, state, snapshot, beginStory, pauseOrResume } = useStorySessionController(dependencies)
  const persistedRef = useRef(false)

  useEffect(() => {
    if (state.phase !== 'complete' || persistedRef.current) return
    persistedRef.current = true
    void (async () => {
      const result = await controller.stop()
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
      router.replace(`/complete/${Date.now().toString(36)}?completed=${result.completedDurationMs >= durationMs}`)
    })().catch(() => router.replace(`/complete/${Date.now().toString(36)}?completed=false`))
  }, [controller, profileId, state.phase, storyId])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && controller.snapshot().status === 'running') void controller.pauseOrResume()
      if (nextState === 'active' && controller.snapshot().status === 'paused') void controller.pauseOrResume()
    })
    return () => subscription.remove()
  }, [controller])

  async function exitAdventure(): Promise<void> {
    await controller.stop()
    router.replace('/stories')
  }

  if (state.phase === 'opening') {
    return (
      <ActScreen
        act="opening"
        title="The Sky Reef is waking."
        body="The opening story leads us toward a bright path through the clouds. When you’re ready, begin the story and we’ll brush together."
        primaryLabel="Begin story"
        onPrimaryPress={() => void beginStory()}
      />
    )
  }

  if (state.phase === 'closing') {
    return (
      <ActScreen
        act="closing"
        title="The crew found the way home."
        body="Listen to the chapter’s gentle ending."
        primaryLabel="Finish chapter"
        onPrimaryPress={() => void controller.stop()}
      />
    )
  }

  if (state.phase === 'complete') return <View />

  return (
    <BrushingSurface
      snapshot={snapshot}
      viewState={state}
      onPauseResume={() => void pauseOrResume()}
      onExit={() => void exitAdventure()}
      showCamera={state.sensingStatus === 'ready'}
    />
  )
}
