import type { StoryGraph } from '../../src/domain/story/types'
import {
  advanceStory,
  validateStoryGraph,
} from '../../src/domain/story/storyGraph'

const copy = {
  '4-5': 'A simple choice',
  '6-7': 'A clear choice',
  '8-9': 'A more mysterious choice',
}

const graph: StoryGraph = {
  storyId: 'sky-reef',
  startNodeId: 'intro',
  nodes: {
    intro: { type: 'narration', assetId: 'intro', next: 'choice-1' },
    'choice-1': {
      type: 'choice',
      prompt: copy,
      options: [
        {
          id: 'cave',
          label: copy,
          assetId: 'choice-cave',
          nextByEngagement: {
            low: 'cave-low',
            steady: 'cave-steady',
            strong: 'cave-strong',
          },
        },
        {
          id: 'tower',
          label: copy,
          assetId: 'choice-tower',
          nextByEngagement: {
            low: 'tower',
            steady: 'tower',
            strong: 'tower',
          },
        },
      ],
    },
    'cave-low': { type: 'ending', assetId: 'ending-cave-low', summaryKey: 'glow' },
    'cave-steady': { type: 'ending', assetId: 'ending-cave-steady', summaryKey: 'glow' },
    'cave-strong': { type: 'ending', assetId: 'ending-cave-strong', summaryKey: 'glow' },
    tower: { type: 'ending', assetId: 'ending-tower', summaryKey: 'stars' },
  },
}

describe('story graph', () => {
  it('advances a choice node using the selected option and session band', () => {
    const state = { storyId: 'sky-reef', nodeId: 'choice-1', choices: {} }

    expect(advanceStory(graph, state, {
      type: 'choose',
      optionId: 'cave',
      sessionBand: 'strong',
    }).nodeId).toBe('cave-strong')
  })

  it('advances a narration node when its audio finishes', () => {
    const state = { storyId: 'sky-reef', nodeId: 'intro', choices: {} }

    expect(advanceStory(graph, state, { type: 'continue' }).nodeId).toBe('choice-1')
  })

  it('rejects a dangling node reference before content ships', () => {
    const invalidGraph: StoryGraph = {
      ...graph,
      nodes: {
        ...graph.nodes,
        bad: { type: 'narration', assetId: 'missing', next: 'does-not-exist' },
      },
    }

    expect(() => validateStoryGraph(invalidGraph)).toThrow('does-not-exist')
  })

  it('rejects an unknown choice without mutating the story state', () => {
    const state = { storyId: 'sky-reef', nodeId: 'choice-1', choices: {} }

    expect(() => advanceStory(graph, state, {
      type: 'choose',
      optionId: 'moon',
      sessionBand: 'steady',
    })).toThrow('moon')
    expect(state).toEqual({ storyId: 'sky-reef', nodeId: 'choice-1', choices: {} })
  })

  it('requires at least three reachable endings', () => {
    const invalidGraph: StoryGraph = {
      ...graph,
      nodes: {
        intro: { type: 'narration', assetId: 'intro', next: 'one' },
        one: { type: 'ending', assetId: 'one', summaryKey: 'one' },
      },
    }

    expect(() => validateStoryGraph(invalidGraph)).toThrow('three reachable endings')
  })
})
