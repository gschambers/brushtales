export type EngagementBand = 'low' | 'steady' | 'strong'
export type SensingConfidence = 'low' | 'medium' | 'high'
export type SensingStatus =
  | 'ready'
  | 'unsupported'
  | 'permissionDenied'
  | 'noFace'
  | 'lowLight'
  | 'processingUnavailable'
export type SessionStatus = 'idle' | 'running' | 'paused' | 'complete' | 'stopped'
export type KeepAwakeState = 'active' | 'denied' | 'revoked' | 'released'
export type AudioAssetId = string

export interface SensingSignal {
  status: SensingStatus
  motionScore: number
  coveragePrompt: string | null
  confidence: SensingConfidence
}

export interface SessionResult {
  completedDurationMs: number
  engagementBand: EngagementBand
  coveragePromptsAttempted: number
  confidence: SensingConfidence
  interrupted: boolean
}

export interface SessionSnapshot {
  status: SessionStatus
  elapsedMs: number
  remainingMs: number
  sensingStatus: SensingStatus
  keepAwakeState: KeepAwakeState
}

export interface SessionSummary {
  profileId: string
  storyId: string
  completed: boolean
  completedDurationMs: number
  engagementBand: EngagementBand
  confidence: SensingConfidence
  interrupted: boolean
}
