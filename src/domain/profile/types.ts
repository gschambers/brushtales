export type AgeBand = '4-5' | '6-7' | '8-9'

export interface Profile {
  id: string
  nickname: string
  ageBand: AgeBand
  avatarKey: string
  createdAt: string
  updatedAt: string
}

export interface CreateProfileInput {
  nickname: string
  ageBand: AgeBand
  avatarKey?: string
}
