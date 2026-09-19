import type { DatabasePort } from '../../src/storage/database'
import { createProfileRepository } from '../../src/storage/profileRepository'
import { createSessionRepository } from '../../src/storage/sessionRepository'

class MemoryDatabase implements DatabasePort {
  profiles: Record<string, unknown>[] = []
  summaries: Record<string, unknown>[] = []

  async execAsync(): Promise<void> {}

  async runAsync(sql: string, params: readonly unknown[] = []) {
    if (sql.includes('INSERT INTO profiles')) {
      const [id, nickname, ageBand, avatarKey, createdAt, updatedAt] = params
      this.profiles.push({ id, nickname, age_band: ageBand, avatar_key: avatarKey, created_at: createdAt, updated_at: updatedAt })
    } else if (sql.includes('INSERT INTO session_summaries')) {
      const [, profileId, storyId, completed, completedDurationMs, engagementBand, confidence, interrupted] = params
      this.summaries.push({
        id: crypto.randomUUID(),
        profileId,
        storyId,
        completed,
        completedDurationMs,
        engagementBand,
        confidence,
        interrupted,
      })
    } else if (sql.includes('DELETE FROM profiles')) {
      const [id] = params
      this.profiles = this.profiles.filter((profile) => profile.id !== id)
      this.summaries = this.summaries.filter((summary) => summary.profileId !== id)
    } else if (sql.includes('DELETE FROM session_summaries')) {
      const [profileId] = params
      this.summaries = this.summaries.filter((summary) => summary.profileId !== profileId)
    } else if (sql.includes('UPDATE profiles')) {
      const [ageBand, updatedAt, id] = params
      const profile = this.profiles.find((candidate) => candidate.id === id)
      if (profile) {
        profile.age_band = ageBand
        profile.updated_at = updatedAt
      }
    }
    return { changes: 1, lastInsertRowId: 1 }
  }

  async getFirstAsync<T>(sql: string, params: readonly unknown[] = []): Promise<T | null> {
    const [id] = params
    if (sql.includes('FROM profiles')) {
      return (this.profiles.find((profile) => profile.id === id) as T | undefined) ?? null
    }
    return (this.summaries.find((summary) => summary.profileId === id) as T | undefined) ?? null
  }

  async getAllAsync<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    if (sql.includes('FROM profiles')) return this.profiles as T[]
    const [profileId] = params
    return this.summaries.filter((summary) => summary.profileId === profileId) as T[]
  }
}

describe('local profile repositories', () => {
  it('keeps progress isolated by profile ID', async () => {
    const database = new MemoryDatabase()
    const repo = createProfileRepository(database)
    const sessions = createSessionRepository(database)
    const a = await repo.create({ nickname: 'A', ageBand: '4-5' })
    const b = await repo.create({ nickname: 'B', ageBand: '8-9' })

    await sessions.saveSummary(a.id, {
      profileId: a.id,
      storyId: 'sky-reef',
      completed: true,
      completedDurationMs: 120_000,
      engagementBand: 'steady',
      confidence: 'high',
      interrupted: false,
    })

    expect(await sessions.listForProfile(b.id)).toEqual([])
  })

  it('deletes a profile and its summaries in one operation', async () => {
    const database = new MemoryDatabase()
    const repo = createProfileRepository(database)
    const sessions = createSessionRepository(database)
    const profile = await repo.create({ nickname: 'A', ageBand: '6-7' })

    await sessions.saveSummary(profile.id, {
      profileId: profile.id,
      storyId: 'sky-reef',
      completed: true,
      completedDurationMs: 120_000,
      engagementBand: 'steady',
      confidence: 'medium',
      interrupted: false,
    })
    await repo.delete(profile.id)

    expect(await repo.get(profile.id)).toBeNull()
    expect(await sessions.listForProfile(profile.id)).toEqual([])
  })

  it('rejects invalid nickname and age band values at the repository boundary', async () => {
    const repo = createProfileRepository(new MemoryDatabase())

    await expect(repo.create({ nickname: '', ageBand: '4-5' })).rejects.toThrow('nickname')
    await expect(repo.create({ nickname: 'A'.repeat(41), ageBand: '4-5' })).rejects.toThrow('nickname')
    await expect(repo.create({ nickname: 'A', ageBand: '10-11' as '4-5' })).rejects.toThrow('age band')
  })

  it('updates a profile age band locally', async () => {
    const repo = createProfileRepository(new MemoryDatabase())
    const profile = await repo.create({ nickname: 'A', ageBand: '4-5' })

    await repo.updateAgeBand(profile.id, '8-9')

    await expect(repo.get(profile.id)).resolves.toMatchObject({ ageBand: '8-9' })
  })
})
