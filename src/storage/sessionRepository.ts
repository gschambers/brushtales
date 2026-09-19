import type { SessionSummary } from '../domain/session/types'
import type { DatabasePort } from './database'

interface SessionSummaryRow {
  profile_id: string
  story_id: string
  completed: number
  completed_duration_ms: number
  engagement_band: SessionSummary['engagementBand']
  confidence: SessionSummary['confidence']
  interrupted: number
}

export interface SessionRepository {
  saveSummary(profileId: string, summary: SessionSummary): Promise<void>
  listForProfile(profileId: string): Promise<SessionSummary[]>
}

function toSummary(row: SessionSummaryRow): SessionSummary {
  return {
    profileId: row.profile_id,
    storyId: row.story_id,
    completed: row.completed === 1,
    completedDurationMs: row.completed_duration_ms,
    engagementBand: row.engagement_band,
    confidence: row.confidence,
    interrupted: row.interrupted === 1,
  }
}

export function createSessionRepository(database: DatabasePort): SessionRepository {
  return {
    async saveSummary(profileId, summary) {
      await database.runAsync(
        'INSERT INTO session_summaries (id, profile_id, story_id, completed, completed_duration_ms, engagement_band, confidence, interrupted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          `summary-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
          profileId,
          summary.storyId,
          summary.completed ? 1 : 0,
          summary.completedDurationMs,
          summary.engagementBand,
          summary.confidence,
          summary.interrupted ? 1 : 0,
        ],
      )
    },

    async listForProfile(profileId) {
      const rows = await database.getAllAsync<SessionSummaryRow>(
        'SELECT profile_id, story_id, completed, completed_duration_ms, engagement_band, confidence, interrupted FROM session_summaries WHERE profile_id = ? ORDER BY created_at ASC',
        [profileId],
      )
      return rows.map(toSummary)
    },
  }
}
