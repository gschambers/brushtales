import manifest from '../../content/audio/manifest.json'
import story from '../../src/content/story/sky-reef.json'
import { validateAudioManifest, validateContent, type AudioManifest } from '../../tools/validate-story'
import type { StoryGraph } from '../../src/domain/story/types'

const storyGraph = story as unknown as StoryGraph
const audioManifest = manifest as unknown as AudioManifest

describe('offline story audio manifest', () => {
  it('rejects story references without local audio', () => {
    const incomplete = JSON.parse(JSON.stringify(audioManifest)) as AudioManifest
    delete incomplete.clips['choice-1']

    expect(() => validateContent(storyGraph, incomplete)).toThrow('choice-1')
  })

  it('requires every shipped clip to be adult-reviewed', () => {
    const incomplete = {
      ...audioManifest,
      clips: {
        ...audioManifest.clips,
        intro: { ...audioManifest.clips.intro, reviewed: false },
      },
    }

    expect(() => validateAudioManifest(incomplete)).toThrow('reviewed')
  })

  it('accepts the complete authored bundle', () => {
    expect(() => validateContent(storyGraph, audioManifest)).not.toThrow()
  })
})
