import { PrototypeApp } from '../src/components/prototype/PrototypeApp'
import { useMemo } from 'react'
import { createProfileRepository } from '../src/storage/profileRepository'
import { openAppDatabase } from '../src/storage/database'
import { createSessionRepository } from '../src/storage/sessionRepository'
import { createStorySessionController } from '../src/session/storySessionController'
import { DevelopmentAudioPlayer } from '../src/audio/developmentAudioPlayer'
import { LocalAudioPlayer } from '../src/audio/audioPlayer'
import { AUDIO_MANIFEST } from '../src/audio/audioManifest'
import { NativeSensingAdapter } from '../src/sensing/nativeSensingAdapter'
import { ExpoKeepAwakeController } from '../src/platform/keepAwake'
import { SystemMonotonicClock } from '../src/domain/session/sessionEngine'
import type { SessionSummary } from '../src/domain/session/types'

export default function HomeScreen() {
  const profileStore = useMemo(() => ({
    async load() {
      const database = await openAppDatabase()
      const profiles = await createProfileRepository(database).list()
      return profiles[0] ? { id: profiles[0].id, nickname: profiles[0].nickname } : null
    },
    async save(nickname: string) {
      const database = await openAppDatabase()
      const repository = createProfileRepository(database)
      const profiles = await repository.list()
      return profiles[0] ?? repository.create({ nickname, ageBand: '6-7', avatarKey: 'star' })
    },
    async saveSummary(summary: SessionSummary) {
      const database = await openAppDatabase()
      await createSessionRepository(database).saveSummary(summary.profileId, summary)
    },
  }), [])

  const sessionControllerFactory = useMemo(() => (profileId: string) => createStorySessionController({
    audio: __DEV__ ? new DevelopmentAudioPlayer() : new LocalAudioPlayer({ manifest: AUDIO_MANIFEST }),
    sensing: new NativeSensingAdapter(),
    keepAwake: new ExpoKeepAwakeController(),
    clock: new SystemMonotonicClock(),
    profileId,
    storyId: 'sky-reef',
    durationMs: 120_000,
    openingAssetId: 'intro',
    brushingAssetId: 'session-fallback',
    closingAssetId: 'ending-share',
  }), [])

  return <PrototypeApp enableDomainSession profileStore={profileStore} sessionControllerFactory={sessionControllerFactory} />
}
