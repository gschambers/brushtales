import type { AgeBand, CreateProfileInput, Profile } from '../domain/profile/types'
import type { DatabasePort } from './database'

interface ProfileRow {
  id: string
  nickname: string
  age_band: AgeBand
  avatar_key: string
  created_at: string
  updated_at: string
}

export interface ProfileRepository {
  list(): Promise<Profile[]>
  create(input: CreateProfileInput): Promise<Profile>
  get(id: string): Promise<Profile | null>
  updateAgeBand(id: string, ageBand: AgeBand): Promise<void>
  delete(id: string): Promise<void>
}

const ageBands = new Set<AgeBand>(['4-5', '6-7', '8-9'])

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function validateInput(input: CreateProfileInput): void {
  if (typeof input.nickname !== 'string' || input.nickname.trim().length === 0 || input.nickname.length > 40) {
    throw new Error('Profile nickname must be between 1 and 40 characters')
  }
  if (!ageBands.has(input.ageBand)) throw new Error('Profile age band is invalid')
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    nickname: row.nickname,
    ageBand: row.age_band,
    avatarKey: row.avatar_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createProfileRepository(database: DatabasePort): ProfileRepository {
  return {
    async list() {
      const rows = await database.getAllAsync<ProfileRow>(
        'SELECT id, nickname, age_band, avatar_key, created_at, updated_at FROM profiles ORDER BY created_at ASC',
      )
      return rows.map(toProfile)
    },

    async create(input) {
      validateInput(input)
      const now = new Date().toISOString()
      const profile: Profile = {
        id: createId('profile'),
        nickname: input.nickname.trim(),
        ageBand: input.ageBand,
        avatarKey: input.avatarKey ?? 'star',
        createdAt: now,
        updatedAt: now,
      }

      await database.runAsync(
        'INSERT INTO profiles (id, nickname, age_band, avatar_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [profile.id, profile.nickname, profile.ageBand, profile.avatarKey, profile.createdAt, profile.updatedAt],
      )
      return profile
    },

    async get(id) {
      const row = await database.getFirstAsync<ProfileRow>(
        'SELECT id, nickname, age_band, avatar_key, created_at, updated_at FROM profiles WHERE id = ?',
        [id],
      )
      return row ? toProfile(row) : null
    },

    async updateAgeBand(id, ageBand) {
      if (!ageBands.has(ageBand)) throw new Error('Profile age band is invalid')
      await database.runAsync(
        'UPDATE profiles SET age_band = ?, updated_at = ? WHERE id = ?',
        [ageBand, new Date().toISOString(), id],
      )
    },

    async delete(id) {
      await database.runAsync('DELETE FROM profiles WHERE id = ?', [id])
    },
  }
}
