import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { StoryGraph } from '../src/domain/story/types'
import { validateStoryGraph } from '../src/domain/story/storyGraph'

export interface AudioManifestClip {
  bundledPath: string
  durationMs: number
  speakerRole: string
  reviewed: boolean
  reviewStatus: string
}

export interface AudioManifest {
  storyId: string
  clips: Record<string, AudioManifestClip>
}

function referencedAudioAssetIds(story: StoryGraph): Set<string> {
  const assetIds = new Set<string>()
  for (const node of Object.values(story.nodes)) {
    if (node.type === 'narration' || node.type === 'ending') assetIds.add(node.assetId)
    if (node.type === 'choice') {
      assetIds.add(node.promptAssetId)
      node.options.forEach((option) => assetIds.add(option.assetId))
    }
  }
  return assetIds
}

export function validateAudioManifest(manifest: AudioManifest): void {
  if (!manifest.storyId || !manifest.clips || Object.keys(manifest.clips).length === 0) {
    throw new Error('Audio manifest must contain a story ID and clips')
  }

  for (const [assetId, clip] of Object.entries(manifest.clips)) {
    if (!clip.bundledPath || clip.bundledPath.startsWith('/') || clip.bundledPath.includes('..')) {
      throw new Error(`Audio clip ${assetId} must use a safe bundled relative path`)
    }
    if (!/\.(mp3|m4a|aac)$/i.test(clip.bundledPath)) {
      throw new Error(`Audio clip ${assetId} must be MP3, M4A, or AAC`)
    }
    if (!Number.isFinite(clip.durationMs) || clip.durationMs <= 0) {
      throw new Error(`Audio clip ${assetId} must have a positive duration`)
    }
    if (!clip.speakerRole || !clip.reviewStatus || clip.reviewed !== true) {
      throw new Error(`Audio clip ${assetId} must be adult-reviewed`)
    }
  }
}

export function validateContent(story: StoryGraph, manifest: AudioManifest): void {
  validateStoryGraph(story)
  validateAudioManifest(manifest)
  if (story.storyId !== manifest.storyId) {
    throw new Error(`Audio manifest story ID ${manifest.storyId} does not match ${story.storyId}`)
  }

  for (const assetId of referencedAudioAssetIds(story)) {
    if (!manifest.clips[assetId]) throw new Error(`Story references missing audio asset ${assetId}`)
  }
}

export function validateStoryFile(
  filePath = resolve(__dirname, '../src/content/story/sky-reef.json'),
): StoryGraph {
  const graph = JSON.parse(readFileSync(filePath, 'utf8')) as StoryGraph
  const manifestPath = resolve(__dirname, '../content/audio/manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AudioManifest
  validateContent(graph, manifest)
  return graph
}

if (process.argv[1]?.endsWith('validate-story.ts') || process.argv[1]?.endsWith('validate-story.js')) {
  try {
    const graph = validateStoryFile()
    console.log(`Validated story graph: ${graph.storyId}`)
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
