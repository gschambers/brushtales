import { router, useLocalSearchParams } from 'expo-router'

import { CompletionScreen } from '../../src/components/session/CompletionScreen'

export default function CompleteScreen() {
  const { completed } = useLocalSearchParams<{ completed?: string }>()
  const didComplete = completed === 'true'
  return <CompletionScreen completed={didComplete} onReturn={() => router.replace('/')} />
}
