import type { AudioAssetId } from '../domain/session/types'

export interface AudioAsset {
  id: AudioAssetId
  uri: string
  durationMs: number
}

export const AUDIO_FALLBACK_ID = 'session-fallback'

export const AUDIO_MANIFEST: Record<string, AudioAsset> = {
  [AUDIO_FALLBACK_ID]: {
    id: AUDIO_FALLBACK_ID,
    uri: 'bundled://audio/session-fallback.m4a',
    durationMs: 2_000,
  },
}

export function resolveAudioAsset(assetId: AudioAssetId): AudioAsset {
  return AUDIO_MANIFEST[assetId] ?? AUDIO_MANIFEST[AUDIO_FALLBACK_ID]
}
