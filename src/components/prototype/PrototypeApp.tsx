import { AccessibilityInfo, AppState, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

import { ZoneAtlas } from '../session/ZoneAtlas'
import { createStorySessionController, type StorySessionController } from '../../session/storySessionController'
import { DevelopmentAudioPlayer } from '../../audio/developmentAudioPlayer'
import { DeterministicSensingAdapter } from '../../sensing/deterministicSensingAdapter'
import { ExpoKeepAwakeController } from '../../platform/keepAwake'
import { SystemMonotonicClock } from '../../domain/session/sessionEngine'
import type { SessionSummary, SensingStatus } from '../../domain/session/types'

export type PrototypeState =
  | 'welcome'
  | 'profile'
  | 'preflight'
  | 'opening'
  | 'running'
  | 'paused'
  | 'audioOnly'
  | 'closing'
  | 'choice'
  | 'settings'
  | 'complete'

type Tone = {
  id: string
  paper: string
  light: string
  soft: string
  main: string
  accent: string
  deep: string
  ring: string
  dash: string
}

const tones: Tone[] = [
  { id: 'peach', paper: '#fff7f2', light: '#ffebe2', soft: '#fbd8ca', main: '#f4b5a3', accent: '#e99a8c', deep: '#8b5a58', ring: 'rgba(175,115,107,.62)', dash: 'rgba(233,154,140,.62)' },
  { id: 'mint', paper: '#f3faf7', light: '#e3f4ed', soft: '#cce9dc', main: '#add9c8', accent: '#87c8b1', deep: '#4a746c', ring: 'rgba(105,164,145,.62)', dash: 'rgba(135,200,177,.62)' },
  { id: 'sky', paper: '#f2f8fb', light: '#e4f1f6', soft: '#c9e7f2', main: '#a9d4e2', accent: '#80b9cd', deep: '#4d6f7c', ring: 'rgba(104,157,177,.62)', dash: 'rgba(128,185,205,.62)' },
  { id: 'lilac', paper: '#f7f4fc', light: '#eee8f8', soft: '#dcd0f0', main: '#c8b8e6', accent: '#a98bd4', deep: '#66527c', ring: 'rgba(137,112,176,.62)', dash: 'rgba(169,139,212,.62)' },
  { id: 'butter', paper: '#fffaf0', light: '#fff3cf', soft: '#f8e5a9', main: '#f4d985', accent: '#e4bf67', deep: '#80683a', ring: 'rgba(180,150,75,.62)', dash: 'rgba(228,191,103,.62)' },
]

const sessionStates = new Set<PrototypeState>(['preflight', 'opening', 'running', 'paused', 'audioOnly', 'closing', 'choice'])
const displayFontStack = 'Marker Felt, Chalkboard SE, Comic Sans MS, cursive'
const roundedFontStack = 'ui-rounded, SF Pro Rounded, system-ui, -apple-system, sans-serif'
const zoneDurationMs = 120_000 / 18

export interface PrototypeAppProps {
  initialState?: PrototypeState
  initialProfileName?: string
  initialProfileId?: string
  initialZoneIndex?: number
  initialToneId?: string
  reducedMotion?: boolean
  showCamera?: boolean
  enableDomainSession?: boolean
  profileStore?: PrototypeProfileStore
  sessionControllerFactory?: PrototypeSessionControllerFactory
}

export interface PrototypeProfile {
  id: string
  nickname: string
}

export interface PrototypeProfileStore {
  load(): Promise<PrototypeProfile | null>
  save(nickname: string): Promise<PrototypeProfile>
  saveSummary(summary: SessionSummary): Promise<void>
}

export type PrototypeSessionControllerFactory = (profileId: string) => StorySessionController

function createPreviewSessionController(profileId: string): StorySessionController {
  return createStorySessionController({
    audio: new DevelopmentAudioPlayer(),
    sensing: new DeterministicSensingAdapter(),
    keepAwake: new ExpoKeepAwakeController(),
    clock: new SystemMonotonicClock(),
    profileId,
    storyId: 'sky-reef',
    durationMs: 120_000,
    openingAssetId: 'intro',
    brushingAssetId: 'session-fallback',
    closingAssetId: 'ending-share',
  })
}

function Button({
  children,
  onPress,
  variant = 'default',
  accessibilityLabel,
  style,
  tone,
  stackedContent = false,
}: {
  children: ReactNode
  onPress: () => void
  variant?: 'default' | 'primary' | 'secondary' | 'choice' | 'exit'
  accessibilityLabel?: string
  style?: object
  tone?: Tone
  stackedContent?: boolean
}) {
  const toneBackground = tone && variant !== 'exit'
    ? { backgroundColor: variant === 'primary' ? tone.main : variant === 'secondary' || variant === 'default' ? tone.soft : tone.light }
    : undefined
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], toneBackground, pressed && styles.pressed, style]}
    >
      {stackedContent ? (
        <View style={styles.stackedButtonContent}>{children}</View>
      ) : (
      <Text style={[styles.buttonLabel, variant === 'primary' && styles.primaryLabel, variant === 'exit' && styles.exitLabel, variant === 'exit' && { color: tone?.deep ?? '#596080' }]}>{children}</Text>
      )}
    </Pressable>
  )
}

function BackgroundDecorations({ width, height }: { width: number; height: number }) {
  return (
    <View pointerEvents="none" accessibilityElementsHidden style={styles.decorations}>
      <View
        testID="background-decoration-soft"
        style={[styles.decoration, { width: 144, height: 144, borderRadius: 72, left: (width * 0.09) - 72, top: (height * 0.16) - 72, backgroundColor: '#bce5d7' }]}
      />
      <View
        testID="background-decoration-warm"
        style={[styles.decoration, { width: 220, height: 220, borderRadius: 110, left: (width * 0.94) - 110, top: (height * 0.78) - 110, backgroundColor: '#ffc6a5' }]}
      />
      <View
        testID="background-decoration-butter"
        style={[styles.decoration, { width: 76, height: 76, borderRadius: 38, left: (width * 0.68) - 38, top: (height * 0.08) - 38, backgroundColor: '#f8e5a9' }]}
      />
    </View>
  )
}

function Topbar({ state, onExit, tone }: { state: PrototypeState; onExit: () => void; tone: Tone }) {
  return (
    <View style={styles.topbar}>
      <View>
        <Text style={[styles.eyebrow, { color: tone.deep }]}>{state === 'running' ? 'Brushing chapter' : state === 'paused' ? 'Chapter paused' : state === 'audioOnly' ? 'Listening mode' : state === 'closing' ? 'Closing audiobook' : state === 'choice' ? 'Story choice' : 'Chapter complete'}</Text>
        <Text style={styles.brand}>BrushTales</Text>
      </View>
      {sessionStates.has(state) ? <Button variant="exit" tone={tone} onPress={onExit}>← Exit</Button> : null}
    </View>
  )
}

function CameraPreview({ visible, tone, width, height }: { visible: boolean; tone: Tone; width: number; height: number }) {
  const frameLeft = (width - 100) / 2
  const frameTop = (height / 2) - (116 * 0.42)
  const framePath = [
    `M ${frameLeft + 46} ${frameTop}`,
    `C ${frameLeft + 75} ${frameTop - 2}, ${frameLeft + 100} ${frameTop + 18}, ${frameLeft + 100} ${frameTop + 54}`,
    `C ${frameLeft + 100} ${frameTop + 90}, ${frameLeft + 76} ${frameTop + 116}, ${frameLeft + 51} ${frameTop + 116}`,
    `C ${frameLeft + 23} ${frameTop + 116}, ${frameLeft} ${frameTop + 92}, ${frameLeft} ${frameTop + 57}`,
    `C ${frameLeft} ${frameTop + 21}, ${frameLeft + 18} ${frameTop + 1}, ${frameLeft + 46} ${frameTop}`,
    'Z',
  ].join(' ')
  return (
    <View
      testID="camera-preview"
      accessibilityLabel={visible ? 'Camera helper on' : undefined}
      accessibilityRole={visible ? 'image' : undefined}
      style={[styles.cameraPreview, { flexBasis: height, backgroundColor: tone.soft }, !visible && styles.cameraHidden]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="camera-helper-gradient" x1="36%" y1="-27%" x2="64%" y2="127%">
            <Stop offset="0" stopColor={tone.light} />
            <Stop offset="1" stopColor={tone.paper} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill={tone.soft} />
        <Rect width={width} height={height} fill="url(#camera-helper-gradient)" />
        <Circle cx={width / 2} cy={height * 0.32} r={42} fill={tone.light} />
        <Ellipse cx={width / 2} cy={height} rx={width * 0.38} ry={height * 0.38} fill={tone.soft} />
        <Path d={framePath} fill="none" stroke="rgba(48,54,92,.24)" strokeWidth={2} strokeDasharray="6 5" />
      </Svg>
    </View>
  )
}

function AudioPlayback({ paused, tone, onPress }: { paused: boolean; tone: Tone; onPress: () => void }) {
  return (
    <View style={styles.playbackWrap}>
      <View style={[styles.ring, { borderColor: tone.ring }, paused && styles.ringPaused]}>
        <View style={[styles.ringInner, { borderColor: tone.dash }]} />
      </View>
      <Button accessibilityLabel={paused ? 'Resume adventure' : 'Pause adventure'} onPress={onPress} tone={tone} style={styles.playback}>
        <Text style={styles.playbackGlyph}>{paused ? '▶' : 'Ⅱ'}</Text>
      </Button>
    </View>
  )
}

function BrushingChapter({
  state,
  tone,
  zoneIndex,
  remainingSeconds,
  showCamera,
  statusNotice,
  reducedMotion,
  onPauseResume,
  onExit,
}: {
  state: PrototypeState
  tone: Tone
  zoneIndex: number
  remainingSeconds: number
  showCamera: boolean
  statusNotice: string | null
  reducedMotion: boolean
  onPauseResume: () => void
  onExit: () => void
}) {
  const { width } = useWindowDimensions()
  const { height: viewportHeight } = useWindowDimensions()
  const atlasWidth = Math.min(width < 420 ? 188 : 210, Math.max(0, width - 56))
  const cameraHeight = Math.min(210, Math.max(150, viewportHeight * 0.24))
  const paused = state === 'paused'
  return (
    <SafeAreaView style={[styles.sessionApp, { backgroundColor: tone.paper }]}>
      <Topbar state={state} onExit={onExit} tone={tone} />
      <View style={styles.sessionContent}>
        <CameraPreview visible={showCamera && state === 'running'} tone={tone} width={width} height={cameraHeight} />
        <View accessibilityRole="text" accessibilityLabel={`${remainingSeconds} seconds remaining`} style={[styles.countdown, { backgroundColor: tone.deep }]}>
          <Text style={[styles.countdownText, { color: tone.paper }]}>{remainingSeconds}</Text>
        </View>
        <View style={styles.sessionVisual}>
          <AudioPlayback paused={paused} tone={tone} onPress={onPauseResume} />
          <View style={styles.lower}>
            <View style={styles.atlasWrap}>
              <ZoneAtlas zoneIndex={zoneIndex} width={atlasWidth} viewportWidth={width} tone={tone} paused={paused} reducedMotion={reducedMotion} />
            </View>
          </View>
        </View>
        {!showCamera || statusNotice ? <Text accessibilityRole="text" style={styles.status}>{statusNotice ?? 'The camera helper is resting. We can keep exploring together.'}</Text> : null}
      </View>
    </SafeAreaView>
  )
}

export function PrototypeApp({
  initialState = 'welcome',
  initialProfileName = '',
  initialProfileId,
  initialZoneIndex = 0,
  initialToneId,
  reducedMotion: reducedMotionOverride,
  showCamera,
  enableDomainSession = false,
  profileStore,
  sessionControllerFactory,
}: PrototypeAppProps) {
  const [state, setState] = useState<PrototypeState>(initialState)
  const [profile, setProfile] = useState<PrototypeProfile | null>(
    initialProfileName.trim()
      ? { id: initialProfileId ?? 'prototype-preview-profile', nickname: initialProfileName.trim() }
      : null,
  )
  const [draftName, setDraftName] = useState('')
  const [zoneIndex, setZoneIndex] = useState(Math.max(0, initialZoneIndex) % 18)
  const [remainingSeconds, setRemainingSeconds] = useState(120)
  const [tone, setTone] = useState(() => tones.find((item) => item.id === initialToneId) ?? tones[0])
  const [domainSessionActive, setDomainSessionActive] = useState(enableDomainSession)
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [sensingStatus, setSensingStatus] = useState<SensingStatus>('unsupported')
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [systemReducedMotion, setSystemReducedMotion] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdProgressValue = useRef(0)
  const [holdProgress, setHoldProgress] = useState(0)
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions()
  const lastInitialState = useRef(initialState)
  const stateRef = useRef(state)
  const controllerRef = useRef<StorySessionController | null>(null)
  const controllerGenerationRef = useRef(0)
  const controllerProfileIdRef = useRef<string | null>(null)
  const sessionStartModeRef = useRef<'opening' | 'brushing'>('opening')
  const persistedGenerationsRef = useRef(new Set<number>())
  const appPausedSessionRef = useRef(false)
  const profileName = profile?.nickname ?? ''
  const profileId = profile?.id ?? initialProfileId ?? (profileStore ? null : 'prototype-preview-profile')
  const usesDomainController = domainSessionActive && profileId !== null
  const reducedMotion = reducedMotionOverride ?? systemReducedMotion

  const persistSessionResult = useCallback(async (
    controller: StorySessionController,
    generation: number,
    sessionProfileId: string,
  ) => {
    if (persistedGenerationsRef.current.has(generation)) return
    const phase = controller.state().phase
    const snapshot = controller.snapshot()
    if (phase === 'opening' && snapshot.status === 'idle') {
      await controller.stop()
      return
    }
    persistedGenerationsRef.current.add(generation)
    const result = await controller.stop()
    const summary: SessionSummary = {
      profileId: sessionProfileId,
      storyId: 'sky-reef',
      completed: result.completedDurationMs >= 120_000,
      completedDurationMs: result.completedDurationMs,
      engagementBand: result.engagementBand,
      confidence: result.confidence,
      interrupted: result.interrupted,
    }
    await profileStore?.saveSummary(summary)
  }, [profileStore])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (lastInitialState.current === initialState) return
    lastInitialState.current = initialState
    setState(initialState)
  }, [initialState])

  useEffect(() => {
    if (!profileStore) return
    let active = true
    void profileStore.load().then((storedProfile) => {
      if (active && storedProfile?.nickname.trim()) {
        setProfile({ id: storedProfile.id, nickname: storedProfile.nickname.trim() })
      }
    }).catch(() => undefined)
    return () => {
      active = false
    }
  }, [profileStore])

  useEffect(() => {
    if (usesDomainController || !['running', 'audioOnly'].includes(state)) return
    const countdownTimer = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setState('closing')
          return 0
        }
        return current - 1
      })
    }, 1000)
    const zoneTimer = setInterval(() => setZoneIndex((current) => Math.min(17, current + 1)), zoneDurationMs)
    return () => {
      clearInterval(countdownTimer)
      clearInterval(zoneTimer)
    }
  }, [usesDomainController, state])

  useEffect(() => {
    if (!usesDomainController || !profileId) return
    const controller = (sessionControllerFactory ?? createPreviewSessionController)(profileId)
    const generation = sessionGeneration
    controllerRef.current = controller
    controllerGenerationRef.current = generation
    controllerProfileIdRef.current = profileId
    const sync = () => {
      const view = controller.state()
      const snapshot = controller.snapshot()
      setZoneIndex(view.zoneIndex)
      setRemainingSeconds(Math.max(0, Math.ceil(snapshot.remainingMs / 1000)))
      setSensingStatus(view.sensingStatus)
      setStatusNotice(view.statusNotice)
      if (view.phase === 'brushing' && ['opening', 'running', 'paused', 'audioOnly', 'choice'].includes(stateRef.current)) {
        setState(snapshot.status === 'paused' ? 'paused' : 'running')
      }
      if (view.phase === 'closing' && ['running', 'paused', 'audioOnly'].includes(stateRef.current)) setState('closing')
      if (view.phase === 'complete') {
        void persistSessionResult(controller, generation, profileId).catch(() => undefined)
        if (stateRef.current !== 'choice') {
          setState('complete')
          setDomainSessionActive(false)
        }
      }
    }
    const unsubscribe = controller.subscribe(sync)
    controller.refresh()
    const timer = setInterval(() => controller.refresh(), 250)
    if (sessionStartModeRef.current === 'brushing') void controller.beginBrushing()
    return () => {
      clearInterval(timer)
      unsubscribe()
      if (controllerRef.current === controller) controllerRef.current = null
      void persistSessionResult(controller, generation, profileId).catch(() => undefined)
    }
  }, [usesDomainController, profileId, sessionGeneration, sessionControllerFactory, persistSessionResult])

  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setSystemReducedMotion(enabled)
    }).catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReducedMotion)
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const controller = controllerRef.current
      if (!controller || controller.state().phase !== 'brushing') return
      if (nextState !== 'active') {
        if (controller.snapshot().status === 'running') {
          appPausedSessionRef.current = true
          void controller.pauseOrResume()
        }
        return
      }
      if (!appPausedSessionRef.current) return
      appPausedSessionRef.current = false
      if (controller.snapshot().status === 'paused') void controller.pauseOrResume()
    })
    return () => subscription?.remove?.()
  }, [])

  useEffect(() => () => {
    if (holdTimer.current) clearInterval(holdTimer.current)
  }, [])

  const sessionStyle = useMemo(() => ({ backgroundColor: tone.paper }), [tone.paper])
  const welcomeTitleSize = Math.min(104, Math.max(56, viewportWidth * 0.18))
  const cardTitleSize = Math.min(35.2, Math.max(23.2, viewportWidth * 0.05))
  const completeTitleSize = Math.min(60, Math.max(32, viewportWidth * 0.08))
  const goTo = (next: PrototypeState) => {
    if (next === 'opening' && !sessionStates.has(state)) {
      setTone(tones[Math.floor(Math.random() * tones.length)])
      if (enableDomainSession && !domainSessionActive && profileId) {
        sessionStartModeRef.current = 'opening'
        setSessionGeneration((current) => current + 1)
        setDomainSessionActive(true)
      }
    }
    if (next === 'running') {
      setRemainingSeconds(120)
      setZoneIndex(0)
    }
    setState(next)
  }
  const beginStory = () => {
    if (!usesDomainController || !controllerRef.current) {
      goTo('running')
      return
    }
    setState('opening')
    void controllerRef.current.beginStory()
  }
  const pauseResume = () => {
    if (usesDomainController && controllerRef.current?.state().phase === 'brushing') {
      void controllerRef.current.pauseOrResume()
      return
    }
    setState((current) => current === 'paused' ? 'running' : 'paused')
  }
  const exitSession = () => {
    if (usesDomainController && controllerRef.current && controllerProfileIdRef.current) {
      void persistSessionResult(
        controllerRef.current,
        controllerGenerationRef.current,
        controllerProfileIdRef.current,
      ).catch(() => undefined)
    }
    appPausedSessionRef.current = false
    setDomainSessionActive(false)
    setState('welcome')
  }
  const saveProfile = async () => {
    const name = draftName.trim()
    if (!name) return
    setDraftName('')
    try {
      globalThis.localStorage?.setItem('brushtales.prototype.profileName', name)
    } catch {
      // Native storage is supplied by the app shell; this keeps the prototype usable offline.
    }
    try {
      const savedProfile = await profileStore?.save(name)
      setProfile(savedProfile ?? { id: profileId ?? 'prototype-preview-profile', nickname: name })
      setState('welcome')
    } catch {
      setProfile({ id: profileId ?? 'prototype-preview-profile', nickname: name })
      setState('welcome')
    }
  }
  const continueToChoice = () => {
    const controller = controllerRef.current
    const currentProfileId = controllerProfileIdRef.current
    if (usesDomainController && controller && currentProfileId) {
      void persistSessionResult(controller, controllerGenerationRef.current, currentProfileId).catch(() => undefined)
    }
    setState('choice')
  }
  const startChosenPath = () => {
    setRemainingSeconds(120)
    setZoneIndex(0)
    setStatusNotice(null)
    setSensingStatus('unsupported')
    if (!usesDomainController) {
      goTo('running')
      return
    }
    const controller = controllerRef.current
    if (controller && controller.state().phase === 'opening' && controller.snapshot().status === 'idle') {
      sessionStartModeRef.current = 'brushing'
      setState('running')
      void controller.beginBrushing()
      return
    }
    if (controller && controllerProfileIdRef.current) {
      void persistSessionResult(controller, controllerGenerationRef.current, controllerProfileIdRef.current).catch(() => undefined)
    }
    sessionStartModeRef.current = 'brushing'
    setSessionGeneration((current) => current + 1)
    setDomainSessionActive(true)
    setState('running')
  }
  const startHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current)
    holdProgressValue.current = 0
    setHoldProgress(0)
    holdTimer.current = setInterval(() => {
      holdProgressValue.current = Math.min(1, holdProgressValue.current + (30 / 1200))
      setHoldProgress(holdProgressValue.current)
      if (holdProgressValue.current >= 1) {
        if (holdTimer.current) clearInterval(holdTimer.current)
        holdTimer.current = null
        setState('settings')
      }
    }, 30)
  }
  const stopHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current)
    holdTimer.current = null
    holdProgressValue.current = 0
    setHoldProgress(0)
  }

  if (state === 'running' || state === 'paused' || state === 'audioOnly') {
    const cameraVisible = showCamera ?? (!usesDomainController || sensingStatus === 'ready')
    return <BrushingChapter state={state} tone={tone} zoneIndex={zoneIndex} remainingSeconds={remainingSeconds} showCamera={cameraVisible} statusNotice={statusNotice} reducedMotion={reducedMotion} onPauseResume={pauseResume} onExit={exitSession} />
  }

  const showTopbar = state === 'closing' || state === 'choice'
  return (
    <SafeAreaView style={[styles.app, sessionStates.has(state) ? sessionStyle : undefined]}>
      {!sessionStates.has(state) ? <BackgroundDecorations width={viewportWidth} height={viewportHeight} /> : null}
      {showTopbar ? <Topbar state={state} onExit={exitSession} tone={tone} /> : null}
      {state === 'welcome' ? (
        <View style={styles.hero}>
          {profileName ? <Text style={styles.eyebrow}>Welcome back</Text> : null}
          <Text style={[styles.heroTitle, { fontSize: welcomeTitleSize, lineHeight: welcomeTitleSize * 0.98, letterSpacing: -welcomeTitleSize * 0.03 }]}>BrushTales</Text>
          {profileName ? <Text style={styles.welcomeName}>Ready for another adventure, {profileName}?</Text> : null}
          <Button variant="primary" onPress={() => goTo(profileName ? 'opening' : 'profile')} style={styles.welcomePrimary}>{profileName ? 'Start an adventure' : 'Create a profile'}</Button>
        </View>
      ) : null}
      {state === 'welcome' && profileName ? (
        <Pressable testID="settings-hold" accessibilityRole="button" accessibilityLabel="Open settings by holding" onPressIn={startHold} onPressOut={stopHold} style={styles.settingsHold}>
          <Svg width={52} height={52} viewBox="0 0 52 52" style={StyleSheet.absoluteFill}>
            <Circle cx={26} cy={26} r={22} fill="none" stroke="rgba(89,96,128,.16)" strokeWidth={3} />
            <Path
              testID="settings-hold-progress"
              d="M 26 4 A 22 22 0 0 1 26 48 A 22 22 0 0 1 26 4"
              fill="none"
              stroke="#596080"
              strokeWidth={3}
              strokeDasharray={2 * Math.PI * 22}
              strokeDashoffset={2 * Math.PI * 22 * (1 - holdProgress)}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.settingsGlyph}>⚙</Text>
        </Pressable>
      ) : null}
      {state !== 'welcome' && state !== 'complete' ? <View style={styles.contentFrame}>
      {state === 'profile' ? (
        <View style={[styles.formCard, styles.profileCard]}>
          <Text style={[styles.eyebrow, { color: tone.deep }]}>Grown-up setup</Text>
          <Text style={[styles.cardTitle, { fontSize: cardTitleSize, lineHeight: cardTitleSize * 1.2 }]}>Create a profile</Text>
          <Text style={styles.lede}>A grown-up can choose a nickname. Profiles and progress stay on this device.</Text>
          <Text style={styles.lede}>Camera frames, face images, voice recordings, and biometric identifiers are not saved.</Text>
          <TextInput accessibilityLabel="Profile nickname" placeholder="Nickname" maxLength={40} value={draftName} onChangeText={setDraftName} style={styles.input} />
          <View style={styles.row}>
            <Button variant="primary" onPress={saveProfile} style={styles.profileAction}>Continue</Button>
            <Button variant="secondary" onPress={() => setState('welcome')} style={styles.profileAction}>Back</Button>
          </View>
        </View>
      ) : null}
      {state === 'preflight' || state === 'opening' ? (
        <View style={[styles.formCard, { backgroundColor: tone.paper }]}>
          <Text style={[styles.eyebrow, { color: tone.deep }]}>Act 1 · Opening audiobook</Text>
          <Text style={[styles.cardTitle, { fontSize: cardTitleSize, lineHeight: cardTitleSize * 1.2 }]}>The Sky Reef is waking.</Text>
          <Text style={[styles.lede, { color: tone.deep }]}>The opening story leads us toward a bright path through the clouds. When you’re ready, begin the story and we’ll brush together. Grown-ups are responsible for safe brushing.</Text>
          <Button variant="primary" tone={tone} onPress={beginStory}>Begin story</Button>
        </View>
      ) : null}
      {state === 'closing' ? (
        <View style={[styles.formCard, { backgroundColor: tone.paper }]}>
          <Text style={[styles.eyebrow, { color: tone.deep }]}>Act 3 · Closing audiobook</Text>
          <Text style={[styles.cardTitle, { fontSize: cardTitleSize, lineHeight: cardTitleSize * 1.2 }]}>The crew found the way home.</Text>
          <Text style={[styles.lede, { color: tone.deep }]}>Listen to the chapter’s gentle ending, then choose what the Sky Reef crew explores next.</Text>
          <Button variant="primary" tone={tone} onPress={continueToChoice}>Continue to story choice</Button>
        </View>
      ) : null}
      {state === 'choice' ? (
        <View style={[styles.choiceSheet, { backgroundColor: tone.light }]}>
          <Text style={[styles.eyebrow, { color: tone.deep }]}>The story is waiting</Text>
          <Text style={[styles.cardTitle, { fontSize: cardTitleSize, lineHeight: cardTitleSize * 1.2 }]}>Which path should guide the sky-reef voyage?</Text>
          <Text style={[styles.lede, { color: tone.deep }]}>Choose a sound to follow.</Text>
          <View style={styles.choiceGrid}>
            <Button accessibilityLabel="Follow the bubbles. They shimmer below." variant="choice" tone={tone} stackedContent onPress={startChosenPath}>
              <Text style={styles.choiceStrong}>Follow the bubbles</Text>
              <Text style={styles.choiceDescription}>They shimmer below.</Text>
            </Button>
            <Button accessibilityLabel="Chase the silver clouds. They glow above." variant="choice" tone={tone} stackedContent onPress={startChosenPath}>
              <Text style={styles.choiceStrong}>Chase the silver clouds</Text>
              <Text style={styles.choiceDescription}>They glow above.</Text>
            </Button>
          </View>
        </View>
      ) : null}
      {state === 'settings' ? (
        <View style={styles.settingsScreen}>
          <Text style={[styles.cardTitle, { fontSize: cardTitleSize, lineHeight: cardTitleSize * 1.2 }]}>Settings</Text>
          <Text style={styles.lede}>A grown-up can adjust the adventure here.</Text>
          <Button variant="secondary" onPress={() => setState('welcome')}>Back to stories</Button>
        </View>
      ) : null}
      </View> : null}
      {state === 'complete' ? (
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>The chapter is complete</Text>
          <Text style={[styles.heroTitle, { fontSize: completeTitleSize, lineHeight: completeTitleSize * 0.98, letterSpacing: -completeTitleSize * 0.03 }]}>You kept exploring.</Text>
          <Text style={styles.lede}>The Sky Reef crew will remember the path you chose.</Text>
          <Button variant="primary" onPress={() => setState('welcome')}>Return to profiles</Button>
        </View>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  app: { position: 'relative', flex: 1, paddingHorizontal: 20, paddingVertical: 24, overflow: 'hidden', backgroundColor: '#f5f0ff' },
  sessionApp: { flex: 1, paddingHorizontal: 20, paddingVertical: 24 },
  decorations: { ...StyleSheet.absoluteFill, zIndex: 0, opacity: 0.68 },
  decoration: { position: 'absolute' },
  topbar: { zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  brand: { color: '#30365c', fontFamily: displayFontStack, fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  eyebrow: { marginBottom: 6, color: '#68434f', fontFamily: displayFontStack, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderTopLeftRadius: 22, borderTopRightRadius: 17, borderBottomRightRadius: 24, borderBottomLeftRadius: 15, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#d9cdf4', shadowColor: '#30365c', shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.16, shadowRadius: 0, elevation: 2 },
  default: { backgroundColor: '#d9cdf4' },
  buttonLabel: { color: '#30365c', fontFamily: displayFontStack, fontSize: 16, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  primaryLabel: { fontWeight: '800' },
  primary: { backgroundColor: '#ffc6a5' },
  secondary: { backgroundColor: '#bce5d7' },
  choice: { minHeight: 68, alignItems: 'flex-start', borderTopLeftRadius: 20, borderTopRightRadius: 16, borderBottomRightRadius: 22, borderBottomLeftRadius: 18, backgroundColor: '#f8e5a9' },
  exit: { minHeight: 36, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'transparent', shadowOpacity: 0 },
  exitLabel: { color: '#596080', fontFamily: roundedFontStack, fontSize: 13, lineHeight: 16, fontWeight: '400' },
  pressed: { opacity: 0.75 },
  hero: { zIndex: 1, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32, maxWidth: 520, width: '100%', alignSelf: 'center' },
  heroTitle: { color: '#30365c', fontFamily: displayFontStack, fontSize: 62, lineHeight: 64, fontWeight: '900', letterSpacing: -2, textAlign: 'center' },
  welcomeName: { color: '#596080', fontFamily: roundedFontStack, fontSize: 17, textAlign: 'center' },
  welcomePrimary: { width: '100%', maxWidth: 280 },
  contentFrame: { zIndex: 1, flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center', justifyContent: 'center' },
  formCard: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 20, borderTopLeftRadius: 30, borderTopRightRadius: 24, borderBottomRightRadius: 34, borderBottomLeftRadius: 22, padding: 24, backgroundColor: '#fffaf2', shadowColor: '#30365c', shadowOffset: { width: 7, height: 8 }, shadowOpacity: 0.14, shadowRadius: 0, elevation: 3 },
  profileCard: { gap: 24 },
  sessionFormCard: { backgroundColor: '#f2f8fb' },
  cardTitle: { color: '#30365c', fontFamily: displayFontStack, fontSize: 23.2, lineHeight: 28, fontWeight: '900', letterSpacing: -0.7 },
  lede: { color: '#596080', fontFamily: roundedFontStack, fontSize: 17, lineHeight: 25 },
  input: { minHeight: 54, borderWidth: 2, borderColor: 'rgba(48,54,92,.16)', borderTopLeftRadius: 16, borderTopRightRadius: 20, borderBottomRightRadius: 15, borderBottomLeftRadius: 18, paddingHorizontal: 15, color: '#30365c', backgroundColor: '#fff', fontFamily: roundedFontStack },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  profileAction: { flexGrow: 1, flexBasis: 150 },
  settingsHold: { position: 'absolute', zIndex: 3, right: 18, bottom: 18, width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26 },
  settingsGlyph: { color: '#596080', fontSize: 20 },
  choiceSheet: { width: '100%', maxWidth: 680, alignSelf: 'center', marginTop: 'auto', borderTopLeftRadius: 30, borderTopRightRadius: 24, borderBottomRightRadius: 34, borderBottomLeftRadius: 22, padding: 22, backgroundColor: '#e3d9fb', shadowColor: '#30365c', shadowOffset: { width: 7, height: 8 }, shadowOpacity: 0.16, shadowRadius: 0, elevation: 3 },
  choiceGrid: { gap: 12, marginTop: 20 },
  stackedButtonContent: { width: '100%', alignItems: 'flex-start' },
  choiceStrong: { color: '#30365c', fontFamily: displayFontStack, fontSize: 16, lineHeight: 19, fontWeight: '800' },
  choiceDescription: { color: '#30365c', fontFamily: displayFontStack, fontSize: 16, lineHeight: 19 },
  settingsScreen: { flex: 1, justifyContent: 'center', gap: 18, maxWidth: 420, width: '100%', alignSelf: 'center' },
  sessionContent: { flex: 1, width: '100%', maxWidth: 680, minHeight: 0, alignSelf: 'center' },
  cameraPreview: { position: 'relative', flex: 0, marginHorizontal: -20, overflow: 'hidden' },
  cameraHidden: { opacity: 0 },
  countdown: { zIndex: 3, width: 72, height: 72, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 36, shadowColor: '#30365c', shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.18, shadowRadius: 0, elevation: 2 },
  countdownText: { fontFamily: roundedFontStack, fontSize: 22, fontVariant: ['tabular-nums'] },
  sessionVisual: { zIndex: 1, flex: 1, minHeight: 220, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 16, marginBottom: 8 },
  playbackWrap: { position: 'relative', width: 100, height: 92, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 62, height: 72, borderWidth: 3, borderRadius: 46, shadowColor: '#30365c', shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.1, shadowRadius: 0 },
  ringInner: { position: 'absolute', top: 8, right: 8, bottom: 8, left: 8, borderWidth: 2, borderStyle: 'dashed', borderRadius: 40 },
  ringPaused: { opacity: 0.7 },
  playback: { zIndex: 1, width: 60, minHeight: 60, height: 60, paddingHorizontal: 0, borderRadius: 30 },
  playbackGlyph: { color: '#30365c', fontSize: 24, fontWeight: '800' },
  lower: { flex: 1, minHeight: 120, position: 'relative', alignItems: 'flex-end', justifyContent: 'flex-end' },
  atlasWrap: { width: '100%', alignItems: 'flex-end', justifyContent: 'flex-end', paddingRight: 16 },
  status: { alignSelf: 'center', marginBottom: 8, color: '#30365c', fontSize: 13, textAlign: 'center' },
})
