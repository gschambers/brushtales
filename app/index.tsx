import { PrototypeApp } from '../src/components/prototype/PrototypeApp'
import { useMemo } from 'react'
import { createProfileRepository } from '../src/storage/profileRepository'
import { openAppDatabase } from '../src/storage/database'

export default function HomeScreen() {
  const profileStore = useMemo(() => ({
    async load() {
      const database = await openAppDatabase()
      const profiles = await createProfileRepository(database).list()
      return profiles[0]?.nickname ?? ''
    },
    async save(name: string) {
      const database = await openAppDatabase()
      const repository = createProfileRepository(database)
      const profiles = await repository.list()
      if (profiles.length === 0) await repository.create({ nickname: name, ageBand: '6-7', avatarKey: 'star' })
    },
  }), [])

  return <PrototypeApp enableDomainSession profileStore={profileStore} />
}
