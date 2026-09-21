import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { SessionSnapshot } from '../../domain/session/types'
import type { StorySessionViewState } from '../../session/storySessionTypes'
import { sessionTheme } from './sessionTheme'
import { ZoneAtlas } from './ZoneAtlas'

export interface BrushingSurfaceProps {
  snapshot: SessionSnapshot
  viewState: StorySessionViewState
  onPauseResume: () => void
  onExit: () => void
  reducedMotion?: boolean
  showCamera: boolean
}

function NativeCameraPreview({ isActive }: { isActive: boolean }) {
  if (!isActive) return null
  // Keep the native camera module out of denied/unavailable unit-test paths.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CameraPreview } = require('../CameraPreview') as typeof import('../CameraPreview')
  return <CameraPreview isActive style={styles.camera} />
}

function noticeForState(viewState: StorySessionViewState, showCamera: boolean): string | null {
  if (viewState.statusNotice) return viewState.statusNotice
  if (!showCamera) return 'The camera helper is resting. We can keep exploring together.'
  if (viewState.sensingStatus === 'noFace') return 'The camera is taking a moment. Keep exploring when you are ready.'
  if (viewState.sensingStatus === 'lowLight') return 'A little more light may help the camera helper.'
  if (viewState.sensingStatus === 'permissionDenied' || viewState.sensingStatus === 'unsupported') {
    return 'The camera helper is unavailable, so the adventure will continue by sound.'
  }
  if (viewState.keepAwakeState === 'denied' || viewState.keepAwakeState === 'revoked') {
    return 'The screen may dim, but the adventure can keep going.'
  }
  return null
}

export function BrushingSurface({
  snapshot,
  viewState,
  onPauseResume,
  onExit,
  reducedMotion,
  showCamera,
}: BrushingSurfaceProps) {
  const seconds = Math.max(0, Math.ceil(snapshot.remainingMs / 1000))
  const paused = snapshot.status === 'paused'
  const notice = noticeForState(viewState, showCamera)

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View testID="camera-preview" style={styles.cameraSlot}>
          <NativeCameraPreview isActive={showCamera && !paused} />
          {!showCamera && <Text style={styles.cameraFallback}>Camera helper resting</Text>}
        </View>
        <View accessibilityRole="text" accessibilityLabel={`${seconds} seconds remaining`} style={styles.countdown}>
          <Text style={styles.countdownText}>{seconds}</Text>
        </View>
        <View style={styles.visualRegion}>
          <View style={styles.playbackWrap}>
            <View testID="audio-ring" style={[styles.audioRing, paused && styles.audioRingPaused]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Resume adventure' : 'Pause adventure'}
              onPress={onPauseResume}
              style={({ pressed }) => [styles.playback, pressed && styles.pressed]}
            >
              <Text style={styles.playbackGlyph}>{paused ? '▶' : 'Ⅱ'}</Text>
            </Pressable>
          </View>
          <View style={styles.atlasRegion}>
            <ZoneAtlas zoneIndex={viewState.zoneIndex} reducedMotion={reducedMotion} width={240} />
          </View>
        </View>
        {notice && <Text accessibilityRole="text" style={styles.notice}>{notice}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Exit adventure" onPress={onExit} style={styles.exit}>
          <Text style={styles.exitText}>Exit</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: sessionTheme.colors.paper },
  content: { flex: 1, paddingHorizontal: sessionTheme.spacing.page },
  cameraSlot: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -sessionTheme.spacing.page,
    overflow: 'hidden',
    backgroundColor: sessionTheme.colors.soft,
  },
  camera: { height: '100%', width: '100%' },
  cameraFallback: { color: sessionTheme.colors.muted, fontSize: 14 },
  countdown: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderRadius: 36,
    backgroundColor: sessionTheme.colors.deep,
  },
  countdownText: { color: sessionTheme.colors.paper, fontSize: 22, fontVariant: ['tabular-nums'] },
  visualRegion: { flex: 1, minHeight: 220, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingBottom: 12 },
  playbackWrap: { width: 88, height: 96, alignItems: 'center', justifyContent: 'center' },
  audioRing: {
    position: 'absolute',
    zIndex: 0,
    width: 76,
    height: 84,
    borderWidth: 3,
    borderColor: 'rgba(175,115,107,0.62)',
    borderRadius: 42,
  },
  audioRingPaused: { opacity: 0.55 },
  playback: {
    zIndex: 1,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: sessionTheme.colors.main,
  },
  playbackGlyph: { color: sessionTheme.colors.ink, fontSize: 24, fontWeight: '800' },
  atlasRegion: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end' },
  notice: { alignSelf: 'center', color: sessionTheme.colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  exit: { alignSelf: 'flex-start', minHeight: sessionTheme.target, justifyContent: 'center', paddingHorizontal: 8 },
  exitText: { color: sessionTheme.colors.muted, fontSize: 14 },
  pressed: { opacity: 0.75 },
})
