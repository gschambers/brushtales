import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { sessionTheme } from './sessionTheme'

export interface CompletionScreenProps {
  completed: boolean
  onReturn: () => void
}

export function CompletionScreen({ completed, onReturn }: CompletionScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{completed ? 'The chapter is complete' : 'The chapter is saved for now'}</Text>
        <Text accessibilityRole="header" style={styles.title}>{completed ? 'You kept exploring.' : 'The adventure can wait.'}</Text>
        <Text style={styles.body}>{completed ? 'The Sky Reef crew is cheering for your next adventure.' : 'The Sky Reef crew will be ready whenever you want to continue.'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Return to profiles" onPress={onReturn} style={styles.button}>
          <Text style={styles.buttonText}>Return to profiles</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, justifyContent: 'center', padding: sessionTheme.spacing.page },
  content: { gap: sessionTheme.spacing.gap },
  eyebrow: { color: sessionTheme.colors.muted, fontSize: 14, fontWeight: '700' },
  title: { color: sessionTheme.colors.ink, fontSize: 34, fontWeight: '800' },
  body: { color: sessionTheme.colors.muted, fontSize: 17, lineHeight: 25 },
  button: { minHeight: sessionTheme.target, alignItems: 'center', justifyContent: 'center', borderRadius: sessionTheme.radius.control, backgroundColor: sessionTheme.colors.main },
  buttonText: { color: sessionTheme.colors.ink, fontSize: 17, fontWeight: '800' },
})
