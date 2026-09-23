import type { AudioAssetId, KeepAwakeState, SessionResult, SessionSnapshot } from '../domain/session/types'
import { SessionEngine, type MonotonicClock } from '../domain/session/sessionEngine'
import type { AudioPlayer, AudioPlayerEvent } from '../audio/audioPlayer'
import type { KeepAwakeController } from '../platform/keepAwake'
import type { SensingAdapter } from '../sensing/sensingAdapter'
import type { SessionAudioState, SessionPhase, StorySessionViewState } from './storySessionTypes'

export interface StorySessionControllerDependencies {
  audio: AudioPlayer
  sensing: SensingAdapter
  keepAwake: KeepAwakeController
  clock: MonotonicClock
  profileId: string
  storyId: string
  durationMs: number
  openingAssetId: AudioAssetId
  brushingAssetId: AudioAssetId
  closingAssetId: AudioAssetId
}

export interface StorySessionController {
  state(): StorySessionViewState
  snapshot(): SessionSnapshot
  refresh(): void
  beginStory(): Promise<void>
  beginBrushing(): Promise<void>
  pauseOrResume(): Promise<void>
  completeClosing(): Promise<void>
  stop(): Promise<SessionResult>
  subscribe(listener: () => void): () => void
}

const emptyResult: SessionResult = {
  completedDurationMs: 0,
  engagementBand: 'low',
  coveragePromptsAttempted: 0,
  confidence: 'low',
  interrupted: false,
}

export class StorySessionControllerImpl implements StorySessionController {
  private readonly engine: SessionEngine
  private readonly listeners = new Set<() => void>()
  private readonly removeAudioListener: () => void
  private readonly removeWakeListener: (() => void) | null
  private readonly dependencies: StorySessionControllerDependencies
  private phase: SessionPhase = 'opening'
  private audioState: SessionAudioState = 'idle'
  private zoneIndex = 0
  private statusNotice: string | null = null
  private wakeRevoked = false
  private beginRequested = false
  private brushingStarted = false
  private closingStarted = false
  private stopping = false
  private cleanupPromise: Promise<SessionResult> | null = null
  private sessionResult: SessionResult | null = null
  private viewState: StorySessionViewState

  constructor(dependencies: StorySessionControllerDependencies) {
    this.dependencies = dependencies
    this.engine = new SessionEngine(dependencies)
    this.removeAudioListener = dependencies.audio.onStateChange((event) => this.handleAudioEvent(event))
    this.removeWakeListener = dependencies.keepAwake.onStateChange?.(() => {
      this.wakeRevoked = true
      this.statusNotice = 'The screen may dim, but the adventure can keep going.'
      this.emit()
    }) ?? null
    this.viewState = this.buildViewState(this.readSnapshot())
  }

  state(): StorySessionViewState {
    return this.viewState
  }

  snapshot(): SessionSnapshot {
    const snapshot = this.readSnapshot()
    this.startClosingIfNeeded(snapshot)
    return snapshot
  }

  refresh(): void {
    const snapshot = this.readSnapshot()
    this.updateView(snapshot)
    this.startClosingIfNeeded(snapshot)
    this.notifyListeners()
  }

  async beginStory(): Promise<void> {
    if (this.phase !== 'opening' || this.beginRequested || this.stopping) return
    this.beginRequested = true
    await this.dependencies.audio.load(this.dependencies.openingAssetId)
    if (this.stopping) return
    if (this.hasUnavailableAudio()) {
      await this.startBrushing()
      return
    }
    await this.dependencies.audio.play()
    if (!this.stopping && this.hasUnavailableAudio()) await this.startBrushing()
  }

  async beginBrushing(): Promise<void> {
    if (this.phase !== 'opening' || this.beginRequested || this.stopping) return
    this.beginRequested = true
    await this.startBrushing()
  }

  async pauseOrResume(): Promise<void> {
    if (this.phase !== 'brushing' || this.stopping) return
    const status = this.readSnapshot().status
    if (status === 'paused') await this.engine.resume()
    else if (status === 'running') await this.engine.pause()
    this.emit()
  }

  async completeClosing(): Promise<void> {
    if (this.phase !== 'closing' || this.stopping) return
    this.phase = 'complete'
    this.emit()
    await this.dependencies.audio.stop()
  }

  async stop(): Promise<SessionResult> {
    if (this.cleanupPromise) return this.cleanupPromise
    this.stopping = true
    this.cleanupPromise = (async () => {
      const status = this.readSnapshot().status
      let result = emptyResult
      if (status !== 'idle' && status !== 'stopped') {
        result = await this.engine.stop()
      } else {
        result = this.sessionResult ?? emptyResult
        await Promise.allSettled([
          this.dependencies.audio.stop(),
          this.dependencies.keepAwake.release(),
        ])
      }
      this.removeAudioListener()
      this.removeWakeListener?.()
      this.emit()
      return result
    })()
    return this.cleanupPromise
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private handleAudioEvent(event: AudioPlayerEvent): void {
    if (this.stopping) return
    if (event === 'ready') this.audioState = 'idle'
    if (event === 'playing') this.audioState = 'playing'
    if (event === 'paused') this.audioState = 'paused'
    if (event === 'finished') this.audioState = 'finished'
    if (event === 'error') {
      this.audioState = 'unavailable'
      this.statusNotice = 'The story audio is resting, but the adventure can keep going.'
    }
    if (event === 'interruption') {
      this.audioState = 'paused'
      this.statusNotice = 'The story audio paused for a moment. We can keep exploring.'
      void this.engine.pause().then(() => this.emit())
    }
    this.emit()
    if (event === 'error' && this.phase === 'opening' && this.beginRequested && !this.brushingStarted) {
      void this.startBrushing()
      return
    }
    if (event !== 'finished') return
    if (this.phase === 'opening' && this.beginRequested && !this.brushingStarted) void this.startBrushing()
    if (this.phase === 'closing') {
      this.phase = 'complete'
      this.emit()
    }
  }

  private async startBrushing(): Promise<void> {
    if (this.brushingStarted || this.stopping) return
    this.brushingStarted = true
    await this.dependencies.audio.load(this.dependencies.brushingAssetId)
    if (this.stopping) return
    this.wakeRevoked = false
    await this.engine.start({
      profileId: this.dependencies.profileId,
      storyId: this.dependencies.storyId,
      durationMs: this.dependencies.durationMs,
    })
    if (this.stopping) return
    this.phase = 'brushing'
    this.emit()
  }

  private startClosingIfNeeded(snapshot: SessionSnapshot): void {
    if (this.phase !== 'brushing' || snapshot.status !== 'complete' || this.closingStarted || this.stopping) return
    this.closingStarted = true
    void this.startClosing()
  }

  private async startClosing(): Promise<void> {
    this.sessionResult = await this.engine.stop()
    if (this.stopping) return
    await this.dependencies.audio.load(this.dependencies.closingAssetId)
    if (this.stopping) return
    if (this.hasUnavailableAudio()) {
      this.phase = 'complete'
      this.emit()
      return
    }
    this.phase = 'closing'
    await this.dependencies.audio.play()
    if (this.hasUnavailableAudio()) this.phase = 'complete'
    this.emit()
  }

  private readSnapshot(): SessionSnapshot {
    const snapshot = this.engine.snapshot()
    const keepAwakeState: KeepAwakeState = this.wakeRevoked ? 'revoked' : snapshot.keepAwakeState
    return { ...snapshot, keepAwakeState }
  }

  private updateView(snapshot: SessionSnapshot): void {
    if (this.phase === 'brushing') {
      this.zoneIndex = Math.min(17, Math.floor(snapshot.elapsedMs / Math.max(1, this.dependencies.durationMs / 18)))
    }
    this.viewState = this.buildViewState(snapshot)
  }

  private buildViewState(snapshot: SessionSnapshot): StorySessionViewState {
    const statusNotice = this.statusNotice ?? this.noticeFor(snapshot)
    return {
      phase: this.phase,
      audioState: this.audioState,
      zoneIndex: this.zoneIndex,
      remainingMs: snapshot.remainingMs,
      sensingStatus: snapshot.sensingStatus,
      keepAwakeState: snapshot.keepAwakeState,
      statusNotice,
    }
  }

  private noticeFor(snapshot: SessionSnapshot): string | null {
    if (snapshot.sensingStatus === 'noFace') return 'The camera is taking a moment. Keep exploring when you are ready.'
    if (snapshot.sensingStatus === 'lowLight') return 'A little more light may help the camera helper.'
    if (snapshot.sensingStatus === 'permissionDenied' || snapshot.sensingStatus === 'unsupported' || snapshot.sensingStatus === 'processingUnavailable') {
      return 'The camera helper is unavailable, so the adventure will continue by sound.'
    }
    if (snapshot.keepAwakeState === 'denied' || snapshot.keepAwakeState === 'revoked') {
      return 'The screen may dim, but the adventure can keep going.'
    }
    return null
  }

  private hasUnavailableAudio(): boolean {
    return this.audioState === 'unavailable'
  }

  private emit(): void {
    this.updateView(this.readSnapshot())
    this.notifyListeners()
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }
}

export function createStorySessionController(
  dependencies: StorySessionControllerDependencies,
): StorySessionController {
  return new StorySessionControllerImpl(dependencies)
}
