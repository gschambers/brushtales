import type { AudioAssetId } from '../domain/session/types'
import { DeterministicAudioPlayer } from './deterministicAudioPlayer'

/** Local-only player that advances authored audiobook placeholder clips. */
export class DevelopmentAudioPlayer extends DeterministicAudioPlayer {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly completionDelayMs = 1_200) {
    super()
  }

  override async load(assetId: AudioAssetId): Promise<void> {
    this.clearTimer()
    await super.load(assetId)
  }

  override async play(): Promise<void> {
    await super.play()
    if (this.loadedAssetId && this.loadedAssetId !== 'session-fallback') {
      this.timer = setTimeout(() => {
        this.timer = null
        this.finish()
      }, this.completionDelayMs)
    }
  }

  override async stop(): Promise<void> {
    this.clearTimer()
    await super.stop()
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
