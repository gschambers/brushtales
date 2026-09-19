import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { StoryGraph } from '../src/domain/story/types'
import { validateStoryGraph } from '../src/domain/story/storyGraph'

export function validateStoryFile(
  filePath = resolve(__dirname, '../src/content/story/sky-reef.json'),
): StoryGraph {
  const graph = JSON.parse(readFileSync(filePath, 'utf8')) as StoryGraph
  validateStoryGraph(graph)
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
