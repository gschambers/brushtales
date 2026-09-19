import type { AgeBand } from '../profile/types'
import type { EngagementBand } from '../session/types'
import type {
  ChoiceNode,
  StoryEvent,
  StoryGraph,
  StoryNode,
  StoryState,
} from './types'

const ageBands: AgeBand[] = ['4-5', '6-7', '8-9']
const engagementBands: EngagementBand[] = ['low', 'steady', 'strong']

export class StoryTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoryTransitionError'
  }
}

function assertAgeBandCopy(copy: Record<string, string>, nodeId: string) {
  for (const ageBand of ageBands) {
    if (typeof copy[ageBand] !== 'string' || copy[ageBand].trim() === '') {
      throw new Error(`Node ${nodeId} is missing copy for age band ${ageBand}`)
    }
  }
}

function assertAsset(assetId: string, assetIds: ReadonlySet<string> | undefined, nodeId: string) {
  if (assetIds && !assetIds.has(assetId)) {
    throw new Error(`Node ${nodeId} references unknown asset ${assetId}`)
  }
}

function referencedNodeIds(node: StoryNode): string[] {
  if (node.type === 'narration') return [node.next]
  if (node.type === 'choice') {
    return node.options.flatMap((option) => engagementBands.map((band) => option.nextByEngagement[band]))
  }
  return []
}

function validateNode(
  graph: StoryGraph,
  nodeId: string,
  assetIds: ReadonlySet<string> | undefined,
) {
  const node = graph.nodes[nodeId]
  if (!node) throw new Error(`Node ${nodeId} does not exist`)

  if (node.type === 'narration') {
    assertAsset(node.assetId, assetIds, nodeId)
    return
  }
  if (node.type === 'ending') {
    assertAsset(node.assetId, assetIds, nodeId)
    return
  }

  assertAgeBandCopy(node.prompt, nodeId)
  if (node.options.length < 2) throw new Error(`Choice node ${nodeId} needs at least two options`)

  for (const option of node.options) {
    assertAgeBandCopy(option.label, nodeId)
    assertAsset(option.assetId, assetIds, `${nodeId}:${option.id}`)
    for (const band of engagementBands) {
      const nextNodeId = option.nextByEngagement[band]
      if (!nextNodeId) throw new Error(`Choice ${nodeId}:${option.id} is missing ${band}`)
      if (!graph.nodes[nextNodeId]) throw new Error(nextNodeId)
    }
  }
}

export function validateStoryGraph(
  graph: StoryGraph,
  assetIds?: ReadonlySet<string>,
): void {
  if (!graph.storyId) throw new Error('Story graph needs a story ID')
  if (!graph.nodes[graph.startNodeId]) throw new Error(`Start node ${graph.startNodeId} does not exist`)

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    validateNode(graph, nodeId, assetIds)
    for (const nextNodeId of referencedNodeIds(node)) {
      if (!graph.nodes[nextNodeId]) throw new Error(nextNodeId)
    }
  }

  const visited = new Set<string>()
  const visiting = new Set<string>()
  let reachableEndings = 0

  const visit = (nodeId: string) => {
    if (visiting.has(nodeId)) throw new Error(`Story graph contains a cycle at ${nodeId}`)
    if (visited.has(nodeId)) return

    const node = graph.nodes[nodeId]
    visiting.add(nodeId)
    if (node.type === 'ending') {
      reachableEndings += 1
    } else {
      for (const nextNodeId of referencedNodeIds(node)) visit(nextNodeId)
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
  }

  visit(graph.startNodeId)
  if (reachableEndings < 3) throw new Error('Story graph needs at least three reachable endings')
}

function getNode(graph: StoryGraph, state: StoryState): StoryNode {
  if (state.storyId !== graph.storyId) {
    throw new StoryTransitionError(`State belongs to ${state.storyId}, not ${graph.storyId}`)
  }
  const node = graph.nodes[state.nodeId]
  if (!node) throw new StoryTransitionError(`Node ${state.nodeId} does not exist`)
  return node
}

export function advanceStory(
  graph: StoryGraph,
  state: StoryState,
  event: StoryEvent,
): StoryState {
  const node = getNode(graph, state)

  if (event.type === 'continue') {
    if (node.type !== 'narration') {
      throw new StoryTransitionError(`Node ${state.nodeId} cannot continue`)
    }
    return { ...state, nodeId: node.next }
  }

  if (node.type !== 'choice') {
    throw new StoryTransitionError(`Node ${state.nodeId} cannot accept a choice`)
  }

  const option = node.options.find((candidate) => candidate.id === event.optionId)
  if (!option) throw new StoryTransitionError(`Choice ${event.optionId} does not exist`)

  return {
    ...state,
    nodeId: option.nextByEngagement[event.sessionBand],
    choices: { ...state.choices, [state.nodeId]: option.id },
  }
}

export function isChoiceNode(node: StoryNode): node is ChoiceNode {
  return node.type === 'choice'
}
