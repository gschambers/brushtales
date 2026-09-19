import type { AudioAssetId } from '../domain/session/types'
import contentManifest from '../../content/audio/manifest.json'

export interface AudioAsset {
  id: AudioAssetId
  uri: string
  durationMs: number
}

export const AUDIO_FALLBACK_ID = 'session-fallback'

const authoredAssets: Record<string, AudioAsset> = Object.fromEntries(
  Object.entries(contentManifest.clips).map(([id, clip]) => [id, {
    id,
    uri: `bundled://${clip.bundledPath}`,
    durationMs: clip.durationMs,
  }]),
)

export const AUDIO_MANIFEST: Record<string, AudioAsset> = {
  ...authoredAssets,
  [AUDIO_FALLBACK_ID]: {
    id: AUDIO_FALLBACK_ID,
    uri: 'bundled://audio/session-fallback.m4a',
    durationMs: 2_000,
  },
}

export function resolveAudioAsset(assetId: AudioAssetId): AudioAsset {
  return AUDIO_MANIFEST[assetId] ?? AUDIO_MANIFEST[AUDIO_FALLBACK_ID]
}
