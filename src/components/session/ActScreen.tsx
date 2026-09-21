import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { sessionTheme } from './sessionTheme'

export interface ActScreenProps {
  act: 'opening' | 'closing'
  title: string
  body: string
  primaryLabel: string
  onPrimaryPress: () => void
}

export function ActScreen({ act, title, body, primaryLabel, onPrimaryPress }: ActScreenProps) {
  const actLabel = act === 'opening' ? 'Act 1 · Opening audiobook' : 'Act 3 · Closing audiobook'

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{actLabel}</Text>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          onPress={onPrimaryPress}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, justifyContent: 'center', padding: sessionTheme.spacing.page },
  card: {
    gap: sessionTheme.spacing.gap,
    borderRadius: sessionTheme.radius.card,
    padding: sessionTheme.spacing.card,
    backgroundColor: sessionTheme.colors.paper,
    shadowColor: sessionTheme.colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 4, height: 5 },
    elevation: 3,
  },
  eyebrow: { color: sessionTheme.colors.muted, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: sessionTheme.colors.ink, fontSize: 30, fontWeight: '800', lineHeight: 35 },
  body: { color: sessionTheme.colors.muted, fontSize: 17, lineHeight: 25 },
  primary: {
    minHeight: sessionTheme.target,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sessionTheme.radius.control,
    paddingHorizontal: 20,
    backgroundColor: sessionTheme.colors.main,
  },
  primaryText: { color: sessionTheme.colors.ink, fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.78 },
})
