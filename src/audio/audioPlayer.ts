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
  addListener?(
    eventName: 'playbackStatusUpdate',
    listener: (status: NativeAudioStatus) => void,
  ): { remove(): void }
}

export interface NativeAudioStatus {
  mediaServicesDidReset?: boolean
  didJustFinish?: boolean
  playing?: boolean
  isLoaded?: boolean
}

interface LocalAudioPlayerOptions {
  createNativePlayer?: (asset: AudioAsset) => NativeAudioPlayer
  manifest?: Record<string, AudioAsset>
}

function createDefaultNativePlayer(asset: AudioAsset): NativeAudioPlayer {
  // Defer loading the Expo native module until playback is actually requested.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio')
  return createAudioPlayer({ uri: asset.uri })
}

export class LocalAudioPlayer implements AudioPlayer {
  private readonly createNativePlayer: (asset: AudioAsset) => NativeAudioPlayer
  private readonly manifest: Record<string, AudioAsset>
  private nativePlayer: NativeAudioPlayer | null = null
  private listeners = new Set<(event: AudioPlayerEvent) => void>()
  loadedAssetId: AudioAssetId | null = null

  constructor(options: LocalAudioPlayerOptions = {}) {
    this.manifest = options.manifest ?? {}
    this.createNativePlayer = options.createNativePlayer ?? createDefaultNativePlayer
  }

  async load(assetId: AudioAssetId): Promise<void> {
    const asset = this.manifest[assetId] ?? resolveAudioAsset(assetId)
    try {
      if (!this.nativePlayer) {
        this.nativePlayer = this.createNativePlayer(asset)
        this.nativePlayer.addListener?.('playbackStatusUpdate', (status) => {
          if (status.mediaServicesDidReset) this.emit('interruption')
          else if (status.didJustFinish) this.emit('finished')
          else if (status.playing) this.emit('playing')
          else if (status.isLoaded) this.emit('paused')
        })
      } else this.nativePlayer.replace({ uri: asset.uri })
      this.loadedAssetId = asset.id
      this.emit('ready')
    } catch {
      this.emit('error')
      if (asset.id !== 'session-fallback') {
        const fallback = resolveAudioAsset('session-fallback')
        try {
          this.nativePlayer = this.createNativePlayer(fallback)
          this.loadedAssetId = fallback.id
          this.emit('ready')
        } catch {
          this.loadedAssetId = fallback.id
        }
      } else {
        this.loadedAssetId = asset.id
      }
    }
  }

  async play(): Promise<void> {
    try {
      this.nativePlayer?.play()
      this.emit('playing')
    } catch {
      this.emit('error')
    }
  }

  async pause(): Promise<void> {
    try {
      this.nativePlayer?.pause()
      this.emit('paused')
    } catch {
      this.emit('error')
    }
  }

  async stop(): Promise<void> {
    try {
      this.nativePlayer?.pause()
      this.emit('finished')
    } catch {
      this.emit('error')
    }
  }

  onStateChange(listener: (event: AudioPlayerEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: AudioPlayerEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }
}
