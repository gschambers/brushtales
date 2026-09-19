import { createAudioPlayer } from 'expo-audio'
import type { AudioAssetId } from '../domain/session/types'
import { resolveAudioAsset, type AudioAsset } from './audioManifest'

export type AudioPlayerEvent = 'ready' | 'playing' | 'paused' | 'finished' | 'interruption' | 'error'

export interface AudioPlayer {
  load(assetId: AudioAssetId): Promise<void>
  play(): Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>
  onStateChange(listener: (event: AudioPlayerEvent) => void): () => void
}

export interface NativeAudioPlayer {
  play(): void
  pause(): void
  replace(source: { uri: string }): void
  remove(): void
}

interface LocalAudioPlayerOptions {
  createNativePlayer?: (asset: AudioAsset) => NativeAudioPlayer
  manifest?: Record<string, AudioAsset>
}

export class LocalAudioPlayer implements AudioPlayer {
  private readonly createNativePlayer: (asset: AudioAsset) => NativeAudioPlayer
  private readonly manifest: Record<string, AudioAsset>
  private nativePlayer: NativeAudioPlayer | null = null
  private listeners = new Set<(event: AudioPlayerEvent) => void>()
  loadedAssetId: AudioAssetId | null = null

  constructor(options: LocalAudioPlayerOptions = {}) {
    this.manifest = options.manifest ?? {}
    this.createNativePlayer = options.createNativePlayer ?? ((asset) => createAudioPlayer({ uri: asset.uri }))
  }

  async load(assetId: AudioAssetId): Promise<void> {
    const asset = this.manifest[assetId] ?? resolveAudioAsset(assetId)
    if (!this.nativePlayer) this.nativePlayer = this.createNativePlayer(asset)
    else this.nativePlayer.replace({ uri: asset.uri })
    this.loadedAssetId = asset.id
    this.emit('ready')
  }

  async play(): Promise<void> {
    this.nativePlayer?.play()
    this.emit('playing')
  }

  async pause(): Promise<void> {
    this.nativePlayer?.pause()
    this.emit('paused')
  }

  async stop(): Promise<void> {
    this.nativePlayer?.pause()
    this.emit('finished')
  }

  onStateChange(listener: (event: AudioPlayerEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: AudioPlayerEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }
}
