import type {
  KeepAwakeState,
  SensingStatus,
} from '../domain/session/types'

export type SessionPhase = 'opening' | 'brushing' | 'closing' | 'complete'
export type SessionAudioState = 'idle' | 'playing' | 'paused' | 'unavailable' | 'finished'

export interface StorySessionViewState {
  phase: SessionPhase
  audioState: SessionAudioState
  zoneIndex: number
  remainingMs: number
  sensingStatus: SensingStatus
  keepAwakeState: KeepAwakeState
  statusNotice: string | null
}
