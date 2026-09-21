import type { AudioAssetId } from '../domain/session/types'
import type { AudioPlayer, AudioPlayerEvent } from './audioPlayer'

export class DeterministicAudioPlayer implements AudioPlayer {
  loadedAssetId: AudioAssetId | null = null

  private readonly listeners = new Set<(event: AudioPlayerEvent) => void>()

  async load(assetId: AudioAssetId): Promise<void> {
    this.loadedAssetId = assetId
    this.emit('ready')
  }

  async play(): Promise<void> {
    this.emit('playing')
  }

  async pause(): Promise<void> {
    this.emit('paused')
  }

  async stop(): Promise<void> {
    this.emit('finished')
  }

  onStateChange(listener: (event: AudioPlayerEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  finish(): void {
    this.emit('finished')
  }

  interrupt(): void {
    this.emit('interruption')
  }

  private emit(event: AudioPlayerEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }
}
