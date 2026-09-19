import type { AgeBand } from '../profile/types'
import type { AudioAssetId, EngagementBand } from '../session/types'

export type AgeBandCopy = Record<AgeBand, string>

export interface NarrationNode {
  type: 'narration'
  assetId: AudioAssetId
  next: string
}

export interface ChoiceOption {
  id: string
  label: AgeBandCopy
  assetId: AudioAssetId
  nextByEngagement: Record<EngagementBand, string>
}

export interface ChoiceNode {
  type: 'choice'
  prompt: AgeBandCopy
  options: ChoiceOption[]
}

export interface EndingNode {
  type: 'ending'
  assetId: AudioAssetId
  summaryKey: string
}

export type StoryNode = NarrationNode | ChoiceNode | EndingNode

export interface StoryGraph {
  storyId: string
  startNodeId: string
  nodes: Record<string, StoryNode>
}

export interface StoryState {
  storyId: string
  nodeId: string
  choices: Record<string, string>
}

export type StoryEvent =
  | { type: 'continue' }
  | { type: 'choose'; optionId: string; sessionBand: EngagementBand }
