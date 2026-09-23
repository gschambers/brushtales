import type {
  EngagementBand,
  KeepAwakeState,
  SessionResult,
  SessionSnapshot,
  SessionStatus,
  SensingConfidence,
  SensingSignal,
  SensingStatus,
} from './types'
import type { AudioPlayer } from '../../audio/audioPlayer'
import type { KeepAwakeController } from '../../platform/keepAwake'
import type { SensingAdapter } from '../../sensing/sensingAdapter'

export interface MonotonicClock {
  now(): number
}

export class SystemMonotonicClock implements MonotonicClock {
  now(): number {
    return globalThis.performance.now()
  }
}

export interface SessionInput {
  profileId: string
  storyId: string
  durationMs: number
}

interface SessionEngineDependencies {
  clock: MonotonicClock
  sensing: SensingAdapter
  audio: AudioPlayer
  keepAwake: KeepAwakeController
}

const confidenceRanks: Record<SensingConfidence, number> = { low: 0, medium: 1, high: 2 }

export class SessionEngine {
  private status: SessionStatus = 'idle'
  private sensingStatus: SensingStatus = 'unsupported'
  private keepAwakeState: KeepAwakeState = 'released'
  private input: SessionInput | null = null
  private accumulatedElapsedMs = 0
  private runningSinceMs: number | null = null
  private interrupted = false
  private coveragePromptsAttempted = 0
  private highestConfidence: SensingConfidence = 'low'
  private motionScores: number[] = []
  private terminalResult: SessionResult | null = null
  private terminalWork: Promise<void> | null = null

  constructor(private readonly dependencies: SessionEngineDependencies) {
    dependencies.audio.onStateChange((event) => {
      if (event === 'interruption') this.interrupted = true
    })
  }

  async start(input: SessionInput): Promise<void> {
    if (this.status !== 'idle') return
    this.input = input
    this.status = 'running'
    this.runningSinceMs = this.dependencies.clock.now()
    this.keepAwakeState = await this.dependencies.keepAwake.acquire()
    if (this.status !== 'running') {
      await this.dependencies.keepAwake.release()
      this.keepAwakeState = 'released'
      return
    }
    const sensingStatus = await this.dependencies.sensing.start((signal) => this.recordSignal(signal))
    if (this.status !== 'running') {
      await this.dependencies.sensing.stop()
      return
    }
    this.sensingStatus = sensingStatus
    await this.dependencies.audio.play()
    if (this.status !== 'running') await this.dependencies.audio.stop()
  }

  async pause(): Promise<void> {
    if (this.status !== 'running') return
    this.updateElapsed()
    if (this.status !== 'running') return
    this.status = 'paused'
    this.runningSinceMs = null
    await this.dependencies.audio.pause()
  }

  async resume(): Promise<void> {
    if (this.status !== 'paused') return
    this.status = 'running'
    this.runningSinceMs = this.dependencies.clock.now()
    await this.dependencies.audio.play()
  }

  async stop(): Promise<SessionResult> {
    if (this.terminalResult) {
      await this.terminalWork
      return this.terminalResult
    }
    this.updateElapsed()
    if (this.status === 'complete' && this.terminalResult) {
      await this.terminalWork
      return this.terminalResult
    }
    this.beginTerminal('stopped')
    await this.terminalWork
    if (!this.terminalResult) throw new Error('Session did not produce a terminal result')
    return this.terminalResult
  }

  snapshot(): SessionSnapshot {
    this.updateElapsed()
    const durationMs = this.input?.durationMs ?? 0
    return {
      status: this.status,
      elapsedMs: this.accumulatedElapsedMs,
      remainingMs: Math.max(0, durationMs - this.accumulatedElapsedMs),
      sensingStatus: this.sensingStatus,
      keepAwakeState: this.keepAwakeState,
    }
  }

  currentEngagementBand(): EngagementBand {
    return this.engagementBand()
  }

  private updateElapsed(): void {
    if (this.status !== 'running' || this.runningSinceMs === null) return
    this.accumulatedElapsedMs += Math.max(0, this.dependencies.clock.now() - this.runningSinceMs)
    this.runningSinceMs = this.dependencies.clock.now()
    const durationMs = this.input?.durationMs ?? 0
    if (this.accumulatedElapsedMs >= durationMs) {
      this.accumulatedElapsedMs = durationMs
      this.beginTerminal('complete')
    }
  }

  private beginTerminal(status: 'complete' | 'stopped'): void {
    if (this.terminalResult || !this.input) return
    this.updateElapsedWithoutCompletion()
    this.status = status
    this.runningSinceMs = null
    this.terminalResult = {
      completedDurationMs: this.accumulatedElapsedMs,
      engagementBand: this.engagementBand(),
      coveragePromptsAttempted: this.coveragePromptsAttempted,
      confidence: this.highestConfidence,
      interrupted: this.interrupted,
    }
    this.terminalWork = this.finishTerminal()
  }

  private updateElapsedWithoutCompletion(): void {
    if (this.runningSinceMs === null) return
    this.accumulatedElapsedMs += Math.max(0, this.dependencies.clock.now() - this.runningSinceMs)
    this.runningSinceMs = null
  }

  private async finishTerminal(): Promise<void> {
    await Promise.allSettled([
      this.dependencies.audio.stop(),
      this.dependencies.sensing.stop(),
      this.dependencies.keepAwake.release().then(() => {
        this.keepAwakeState = 'released'
      }),
    ])
  }

  private recordSignal(signal: SensingSignal): void {
    if (this.status !== 'running') return
    this.sensingStatus = signal.status
    this.motionScores.push(signal.motionScore)
    if (signal.coveragePrompt) this.coveragePromptsAttempted += 1
    if (confidenceRanks[signal.confidence] > confidenceRanks[this.highestConfidence]) {
      this.highestConfidence = signal.confidence
    }
  }

  private engagementBand(): EngagementBand {
    if (this.motionScores.length === 0) return 'low'
    const average = this.motionScores.reduce((sum, score) => sum + score, 0) / this.motionScores.length
    if (average >= 0.7) return 'strong'
    if (average >= 0.35) return 'steady'
    return 'low'
  }
}
