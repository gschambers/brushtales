import { act, fireEvent, render } from '@testing-library/react-native'
import { AppState, Dimensions, StyleSheet } from 'react-native'
import type { AppStateStatus } from 'react-native'
import type { SessionResult, SessionSnapshot } from '../../src/domain/session/types'
import type { StorySessionController } from '../../src/session/storySessionController'
import type { StorySessionViewState } from '../../src/session/storySessionTypes'

import { PrototypeApp } from '../../src/components/prototype/PrototypeApp'

function createControllerFixture(
  initialPhase: StorySessionViewState['phase'] = 'brushing',
  initialStatus?: SessionSnapshot['status'],
  sensingStatus: StorySessionViewState['sensingStatus'] = 'unsupported',
) {
  const listeners = new Set<() => void>()
  const viewState: StorySessionViewState = {
    phase: initialPhase,
    audioState: 'playing',
    zoneIndex: 0,
    remainingMs: 120_000,
    sensingStatus,
    keepAwakeState: 'active',
    statusNotice: sensingStatus === 'processingUnavailable'
      ? 'The camera helper is unavailable, so the adventure will continue by sound.'
      : null,
  }
  let snapshot: SessionSnapshot = {
    status: initialStatus ?? (initialPhase === 'brushing' ? 'running' : 'idle'),
    elapsedMs: initialPhase === 'brushing' ? 1_000 : 0,
    remainingMs: initialPhase === 'brushing' ? 119_000 : 120_000,
    sensingStatus,
    keepAwakeState: 'active',
  }
  const result: SessionResult = {
    completedDurationMs: 120_000,
    engagementBand: 'steady',
    coveragePromptsAttempted: 12,
    confidence: 'medium',
    interrupted: false,
  }
  const controller: StorySessionController = {
    state: () => viewState,
    snapshot: () => snapshot,
    refresh: jest.fn(() => listeners.forEach((listener) => listener())),
    beginStory: jest.fn(async () => undefined),
    beginBrushing: jest.fn(async () => {
      viewState.phase = 'brushing'
      snapshot = { ...snapshot, status: 'running' }
      listeners.forEach((listener) => listener())
    }),
    pauseOrResume: jest.fn(async () => {
      snapshot = { ...snapshot, status: snapshot.status === 'paused' ? 'running' : 'paused' }
      listeners.forEach((listener) => listener())
    }),
    completeClosing: jest.fn(async () => undefined),
    stop: jest.fn(async () => result),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    controller,
    complete: () => {
      viewState.phase = 'complete'
      snapshot = { ...snapshot, status: 'stopped', remainingMs: 0 }
      listeners.forEach((listener) => listener())
    },
  }
}

describe('prototype-first root experience', () => {
  afterEach(() => jest.restoreAllMocks())

  it('follows the prototype profile and opening flow', async () => {
    const rendered = await render(<PrototypeApp />)

    expect(rendered.getByRole('button', { name: 'Create a profile' })).toBeTruthy()
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Create a profile' })))
    await act(async () => fireEvent.changeText(rendered.getByPlaceholderText('Nickname'), 'Mira'))
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Continue' })))

    expect(rendered.getByText(/Ready for another adventure, Mira/i)).toBeTruthy()
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Start an adventure' })))
    expect(rendered.getByText('Act 1 · Opening audiobook')).toBeTruthy()
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Begin story' })))
    expect(rendered.getByRole('button', { name: 'Pause adventure' })).toBeTruthy()
  })

  it('keeps the prototype pause/resume controls and complete choice states', async () => {
    const rendered = await render(<PrototypeApp initialState="running" />)

    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Pause adventure' })))
    expect(rendered.getByRole('button', { name: 'Resume adventure' })).toBeTruthy()
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Resume adventure' })))
    expect(rendered.getByRole('button', { name: 'Pause adventure' })).toBeTruthy()

    await act(async () => rendered.rerender(<PrototypeApp initialState="choice" />))
    expect(rendered.getByRole('button', { name: /Follow the bubbles/ })).toBeTruthy()
    expect(rendered.getByRole('button', { name: /Chase the silver clouds/ })).toBeTruthy()

    await act(async () => rendered.rerender(<PrototypeApp initialState="settings" />))
    expect(rendered.getByText('A grown-up can adjust the adventure here.')).toBeTruthy()

    await act(async () => rendered.rerender(<PrototypeApp initialState="complete" />))
    expect(rendered.getByText('You kept exploring.')).toBeTruthy()
    expect(rendered.getByRole('button', { name: 'Return to profiles' })).toBeTruthy()
  })

  it('keeps the opening audiobook state while the domain session starts', async () => {
    const rendered = await render(<PrototypeApp initialState="opening" enableDomainSession />)

    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Begin story' })))

    expect(rendered.getByText('Act 1 · Opening audiobook')).toBeTruthy()
  })

  it('starts a fresh timed brushing chapter after a story choice', async () => {
    const fixture = createControllerFixture('opening')
    const rendered = await render(
      <PrototypeApp
        initialState="choice"
        enableDomainSession
        sessionControllerFactory={() => fixture.controller}
      />,
    )

    await act(async () => fireEvent.press(rendered.getByRole('button', { name: /Follow the bubbles/ })))
    expect(fixture.controller.beginBrushing).toHaveBeenCalledTimes(1)
    expect(rendered.getByLabelText('120 seconds remaining')).toBeTruthy()
    expect(rendered.getByRole('button', { name: 'Pause adventure' })).toBeTruthy()

    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Pause adventure' })))
    expect(rendered.getByRole('button', { name: 'Resume adventure' })).toBeTruthy()
  })

  it('refreshes the domain session target every 6.667 seconds', async () => {
    jest.useFakeTimers()
    const rendered = await render(<PrototypeApp initialState="opening" enableDomainSession />)

    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Begin story' })))
    await act(async () => jest.advanceTimersByTimeAsync(1_500))
    expect(rendered.getByLabelText('Top teeth · front · left side highlighted')).toBeTruthy()

    await act(async () => jest.advanceTimersByTimeAsync(6_667))
    expect(rendered.getByLabelText('Top teeth · front · center highlighted')).toBeTruthy()
    jest.useRealTimers()
  })

  it('renders the adult settings hold affordance and settings state', async () => {
    const rendered = await render(<PrototypeApp initialProfileName="Mira" />)
    expect(rendered.getByTestId('settings-hold')).toBeTruthy()

    await act(async () => rendered.rerender(<PrototypeApp initialState="settings" initialProfileName="Mira" />))
    expect(rendered.getByText('Settings')).toBeTruthy()
  })

  it('shows hold progress and opens adult settings after the prototype hold duration', async () => {
    jest.useFakeTimers()
    const rendered = await render(<PrototypeApp initialProfileName="Mira" />)
    const settingsHold = rendered.getByTestId('settings-hold')
    const progress = rendered.getByTestId('settings-hold-progress')
    const circumference = 2 * Math.PI * 22

    expect(progress.props.strokeDashoffset).toBeCloseTo(circumference)
    await act(async () => fireEvent(settingsHold, 'pressIn'))
    await act(async () => jest.advanceTimersByTimeAsync(600))
    expect(rendered.getByTestId('settings-hold-progress').props.strokeDashoffset).toBeCloseTo(circumference / 2)
    await act(async () => jest.advanceTimersByTimeAsync(600))
    expect(rendered.getByText('Settings')).toBeTruthy()
    jest.useRealTimers()
  })

  it('loads and saves the profile through the supplied local store', async () => {
    const profileStore = {
      load: jest.fn(async () => ({ id: 'profile-local', nickname: 'Mira' })),
      save: jest.fn(async (nickname: string) => ({ id: 'profile-local', nickname })),
      saveSummary: jest.fn(async () => undefined),
    }
    const rendered = await render(<PrototypeApp profileStore={profileStore} />)

    await act(async () => await Promise.resolve())
    expect(rendered.getByText(/Ready for another adventure, Mira/i)).toBeTruthy()
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Start an adventure' })))
    expect(profileStore.save).not.toHaveBeenCalled()
  })

  it('makes profile setup caregiver-visible and keeps safe-brushing supervision explicit', async () => {
    const rendered = await render(<PrototypeApp initialState="profile" />)

    expect(rendered.getByText('Grown-up setup')).toBeTruthy()
    expect(rendered.getByText(/profiles and progress stay on this device/i)).toBeTruthy()
    expect(rendered.getByText(/camera frames, face images, voice recordings, and biometric identifiers are not saved/i)).toBeTruthy()
    expect(rendered.getByPlaceholderText('Nickname')).toBeTruthy()
    expect(rendered.queryByPlaceholderText("Child's name")).toBeNull()

    await act(async () => rendered.rerender(<PrototypeApp initialState="opening" />))
    expect(rendered.getByText(/grown-ups are responsible for safe brushing/i)).toBeTruthy()
  })

  it('sends completed domain sessions to the completion screen and persists once for the loaded profile', async () => {
    const profileStore = {
      load: jest.fn(async () => ({ id: 'profile-local-42', nickname: 'Mira' })),
      save: jest.fn(async (nickname: string) => ({ id: 'profile-local-42', nickname })),
      saveSummary: jest.fn(async () => undefined),
    }
    const fixture = createControllerFixture()
    const sessionControllerFactory = jest.fn(() => fixture.controller)
    const rendered = await render(
      <PrototypeApp
        initialState="running"
        enableDomainSession
        profileStore={profileStore}
        sessionControllerFactory={sessionControllerFactory}
      />,
    )

    await act(async () => await Promise.resolve())
    await act(async () => fixture.complete())

    expect(rendered.getByText('You kept exploring.')).toBeTruthy()
    expect(sessionControllerFactory).toHaveBeenCalledWith('profile-local-42')
    expect(profileStore.saveSummary).toHaveBeenCalledTimes(1)
    expect(profileStore.saveSummary).toHaveBeenCalledWith(expect.objectContaining({
      profileId: 'profile-local-42',
      storyId: 'sky-reef',
      completed: true,
      completedDurationMs: 120_000,
      engagementBand: 'steady',
      confidence: 'medium',
      interrupted: false,
    }))
  })

  it('persists an exited session once as incomplete with its interruption signal', async () => {
    const profileStore = {
      load: jest.fn(async () => ({ id: 'profile-exit-15', nickname: 'Mira' })),
      save: jest.fn(async (nickname: string) => ({ id: 'profile-exit-15', nickname })),
      saveSummary: jest.fn(async () => undefined),
    }
    const fixture = createControllerFixture()
    jest.spyOn(fixture.controller, 'stop').mockResolvedValue({
      completedDurationMs: 40_000,
      engagementBand: 'low',
      coveragePromptsAttempted: 2,
      confidence: 'low',
      interrupted: true,
    })
    const rendered = await render(
      <PrototypeApp
        initialState="running"
        enableDomainSession
        profileStore={profileStore}
        sessionControllerFactory={() => fixture.controller}
      />,
    )

    await act(async () => await Promise.resolve())
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: /Exit/ })))
    await act(async () => await Promise.resolve())

    expect(profileStore.saveSummary).toHaveBeenCalledTimes(1)
    expect(profileStore.saveSummary).toHaveBeenCalledWith(expect.objectContaining({
      profileId: 'profile-exit-15',
      completed: false,
      completedDurationMs: 40_000,
      interrupted: true,
    }))
  })

  it('starts a fresh controller after continuing from the closing chapter through a choice', async () => {
    const profileStore = {
      load: jest.fn(async () => ({ id: 'profile-local-7', nickname: 'Mira' })),
      save: jest.fn(async (nickname: string) => ({ id: 'profile-local-7', nickname })),
      saveSummary: jest.fn(async () => undefined),
    }
    const first = createControllerFixture('closing')
    const next = createControllerFixture('opening')
    const sessionControllerFactory = jest.fn()
      .mockReturnValueOnce(first.controller)
      .mockReturnValueOnce(next.controller)
    const rendered = await render(
      <PrototypeApp
        initialState="closing"
        enableDomainSession
        profileStore={profileStore}
        sessionControllerFactory={sessionControllerFactory}
      />,
    )

    await act(async () => await Promise.resolve())
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Continue to story choice' })))
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: /Follow the bubbles/ })))
    await act(async () => await Promise.resolve())

    expect(sessionControllerFactory).toHaveBeenCalledTimes(2)
    expect(next.controller.beginBrushing).toHaveBeenCalledTimes(1)
    expect(profileStore.saveSummary).toHaveBeenCalledTimes(1)
    expect(rendered.getByRole('button', { name: 'Pause adventure' })).toBeTruthy()
  })

  it('recreates the domain controller after exiting and starting another adventure', async () => {
    const first = createControllerFixture()
    const next = createControllerFixture('opening')
    const sessionControllerFactory = jest.fn()
      .mockReturnValueOnce(first.controller)
      .mockReturnValueOnce(next.controller)
    const rendered = await render(
      <PrototypeApp
        initialState="running"
        initialProfileName="Mira"
        enableDomainSession
        sessionControllerFactory={sessionControllerFactory}
      />,
    )

    await act(async () => fireEvent.press(rendered.getByRole('button', { name: /Exit/ })))
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Start an adventure' })))
    await act(async () => fireEvent.press(rendered.getByRole('button', { name: 'Begin story' })))
    await act(async () => await Promise.resolve())

    expect(sessionControllerFactory).toHaveBeenCalledTimes(2)
    expect(next.controller.beginStory).toHaveBeenCalledTimes(1)
  })

  it('pauses only a running session in the background and resumes only its own pause', async () => {
    let onAppStateChange: ((nextState: AppStateStatus) => void) | undefined
    const addListener = jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'change') onAppStateChange = listener
      return { remove: jest.fn() }
    })
    const profileStore = {
      load: jest.fn(async () => ({ id: 'profile-background', nickname: 'Mira' })),
      save: jest.fn(async (nickname: string) => ({ id: 'profile-background', nickname })),
      saveSummary: jest.fn(async () => undefined),
    }
    const running = createControllerFixture()
    const rendered = await render(
      <PrototypeApp
        initialState="running"
        enableDomainSession
        profileStore={profileStore}
        sessionControllerFactory={() => running.controller}
      />,
    )

    await act(async () => await Promise.resolve())
    await act(async () => onAppStateChange?.('background'))
    expect(running.controller.pauseOrResume).toHaveBeenCalledTimes(1)
    await act(async () => onAppStateChange?.('active'))
    expect(running.controller.pauseOrResume).toHaveBeenCalledTimes(2)

    const userPaused = createControllerFixture('brushing', 'paused')
    await act(async () => rendered.rerender(
      <PrototypeApp
        initialState="paused"
        enableDomainSession
        profileStore={profileStore}
        sessionControllerFactory={() => userPaused.controller}
      />,
    ))
    await act(async () => onAppStateChange?.('background'))
    await act(async () => onAppStateChange?.('active'))
    expect(userPaused.controller.pauseOrResume).not.toHaveBeenCalled()
    addListener.mockRestore()
  })

  it('keeps brushing usable by sound and hides the camera helper when sensing is unavailable', async () => {
    const profileStore = {
      load: jest.fn(async () => ({ id: 'profile-no-camera', nickname: 'Mira' })),
      save: jest.fn(async (nickname: string) => ({ id: 'profile-no-camera', nickname })),
      saveSummary: jest.fn(async () => undefined),
    }
    const fixture = createControllerFixture('brushing', 'running', 'processingUnavailable')
    const rendered = await render(
      <PrototypeApp
        initialState="running"
        enableDomainSession
        profileStore={profileStore}
        sessionControllerFactory={() => fixture.controller}
      />,
    )

    await act(async () => await Promise.resolve())

    expect(rendered.getByText(/adventure will continue by sound/i)).toBeTruthy()
    expect(rendered.queryByLabelText('Camera helper on')).toBeNull()
    expect(rendered.getByRole('button', { name: 'Pause adventure' })).toBeTruthy()
  })

  it('honors reduced motion and keeps the atlas compact at a 320px viewport', async () => {
    const originalWindow = Dimensions.get('window')
    const originalScreen = Dimensions.get('screen')
    Dimensions.set({
      window: { ...originalWindow, width: 320 },
      screen: { ...originalScreen, width: 320 },
    })
    const rendered = await render(<PrototypeApp initialState="running" reducedMotion />)

    expect(rendered.getByTestId('toothbrush-sweep-static')).toBeTruthy()
    expect(StyleSheet.flatten(rendered.getByTestId('zone-atlas').props.style).width).toBe(188)

    await act(async () => Dimensions.set({ window: originalWindow, screen: originalScreen }))
  })

  it('applies the prototype display and rounded body font stacks', async () => {
    const rendered = await render(<PrototypeApp initialState="opening" />)
    const title = rendered.getByText('The Sky Reef is waking.')
    const body = rendered.getByText(/opening story leads us/i)
    const titleStyle = Array.isArray(title.props.style) ? Object.assign({}, ...title.props.style) : title.props.style
    const bodyStyle = Array.isArray(body.props.style) ? Object.assign({}, ...body.props.style) : body.props.style

    expect(titleStyle.fontFamily).toBe('Marker Felt, Chalkboard SE, Comic Sans MS, cursive')
    expect(bodyStyle.fontFamily).toBe('ui-rounded, SF Pro Rounded, system-ui, -apple-system, sans-serif')
  })

  it('uses the selected session tone for the opening card and primary action', async () => {
    const rendered = await render(<PrototypeApp initialState="opening" initialToneId="sky" />)
    const title = rendered.getByText('The Sky Reef is waking.')
    const cardStyle = StyleSheet.flatten(title.parent?.props.style)
    const action = rendered.getByRole('button', { name: 'Begin story' })
    const actionStyle = StyleSheet.flatten(
      typeof action.props.style === 'function' ? action.props.style({ pressed: false }) : action.props.style,
    )

    expect(cardStyle.backgroundColor).toBe('#f2f8fb')
    expect(actionStyle.backgroundColor).toBe('#a9d4e2')
  })

  it('uses the selected session light color for the story-choice sheet and options', async () => {
    const rendered = await render(<PrototypeApp initialState="choice" initialToneId="sky" />)
    const choiceSheet = rendered.getByText('Which path should guide the sky-reef voyage?')
    const sheetStyle = StyleSheet.flatten(choiceSheet.parent?.props.style)
    const option = rendered.getByRole('button', { name: /Follow the bubbles/ })
    const optionStyle = StyleSheet.flatten(
      typeof option.props.style === 'function' ? option.props.style({ pressed: false }) : option.props.style,
    )

    expect(sheetStyle.backgroundColor).toBe('#e4f1f6')
    expect(optionStyle.backgroundColor).toBe('#e4f1f6')
  })

  it('stacks each story-choice title above its supporting sentence', async () => {
    const rendered = await render(<PrototypeApp initialState="choice" initialToneId="sky" />)
    const title = rendered.getByText('Follow the bubbles')
    const description = rendered.getByText('They shimmer below.')

    expect(title.parent).toBe(description.parent)
    expect(title.parent?.type).toBe('View')
  })

  it('keeps the session exit action compact and rounded', async () => {
    const rendered = await render(<PrototypeApp initialState="choice" initialToneId="sky" />)
    const exitLabel = StyleSheet.flatten(rendered.getByText('← Exit').props.style)

    expect(exitLabel.fontSize).toBe(13)
    expect(exitLabel.fontFamily).toBe('ui-rounded, SF Pro Rounded, system-ui, -apple-system, sans-serif')
  })

  it('wraps profile actions at the prototype 150px button basis', async () => {
    const rendered = await render(<PrototypeApp initialState="profile" />)
    const continueButton = rendered.getByRole('button', { name: 'Continue' })
    const actionStyle = StyleSheet.flatten(
      typeof continueButton.props.style === 'function' ? continueButton.props.style({ pressed: false }) : continueButton.props.style,
    )

    expect(actionStyle.flexBasis).toBe(150)
    expect(actionStyle.flexGrow).toBe(1)
  })

  it('adds prototype-colored background decoration only outside session-tinted screens', async () => {
    const welcome = await render(<PrototypeApp initialProfileName="Mira" />)
    const decorations = { includeHiddenElements: true }
    expect(StyleSheet.flatten(welcome.getByTestId('background-decoration-soft', decorations).props.style).backgroundColor).toBe('#bce5d7')
    expect(StyleSheet.flatten(welcome.getByTestId('background-decoration-warm', decorations).props.style).backgroundColor).toBe('#ffc6a5')
    expect(StyleSheet.flatten(welcome.getByTestId('background-decoration-butter', decorations).props.style).backgroundColor).toBe('#f8e5a9')

    await act(async () => welcome.rerender(<PrototypeApp initialState="opening" initialToneId="sky" />))
    expect(welcome.queryByTestId('background-decoration-soft', decorations)).toBeNull()
  })

  it('matches prototype responsive welcome and brushing dimensions', async () => {
    const { width, height } = Dimensions.get('window')
    const titleSize = Math.min(104, Math.max(56, width * 0.18))
    const cameraHeight = Math.min(210, Math.max(150, height * 0.24))
    const welcome = await render(<PrototypeApp initialProfileName="Mira" />)
    const titleStyle = StyleSheet.flatten(welcome.getByText('BrushTales').props.style)
    const primary = welcome.getByRole('button', { name: 'Start an adventure' })
    const primaryStyle = StyleSheet.flatten(
      typeof primary.props.style === 'function' ? primary.props.style({ pressed: false }) : primary.props.style,
    )
    expect(titleStyle.fontSize).toBeCloseTo(titleSize)
    expect(primaryStyle.maxWidth).toBe(280)

    const brushing = await render(<PrototypeApp initialState="running" />)
    const previewStyle = StyleSheet.flatten(brushing.getByTestId('camera-preview').props.style)
    const atlasStyle = StyleSheet.flatten(brushing.getByTestId('zone-atlas').props.style)
    const appStyle = StyleSheet.flatten(brushing.getByTestId('camera-preview').parent?.parent?.props.style)
    expect(previewStyle.flexBasis).toBeCloseTo(cameraHeight)
    expect(atlasStyle.width).toBe(Math.min(210, Math.max(0, width - 56)))
    expect(appStyle.paddingVertical).toBe(24)
  })

  it('renders the prototype opaque session-tone gradient behind the camera helper', async () => {
    const rendered = await render(<PrototypeApp initialState="running" initialToneId="sky" />)
    const gradient = rendered.root?.queryAll(({ type, props }) =>
      type === 'RNSVGLinearGradient' && props.name === 'camera-helper-gradient',
    )[0]
    const stops = (gradient?.props.gradient as number[] | undefined)?.map((value, index) =>
      index % 2 === 1 ? (value >>> 0).toString(16).padStart(8, '0') : value,
    )

    expect(gradient?.props).toMatchObject({ x1: '36%', y1: '-27%', x2: '64%', y2: '127%' })
    expect(stops).toEqual([0, 'ffe4f1f6', 1, 'fff2f8fb'])
  })

  it('renders the camera-helper face and shoulder shapes at full prototype opacity', async () => {
    const rendered = await render(<PrototypeApp initialState="running" initialToneId="sky" />)
    const cameraPreview = rendered.getByTestId('camera-preview')
    const face = cameraPreview.queryAll(({ type }) => type === 'RNSVGCircle')[0]
    const shoulders = cameraPreview.queryAll(({ type }) => type === 'RNSVGEllipse')[0]

    expect(face.props.opacity).toBeUndefined()
    expect(shoulders.props.opacity).toBeUndefined()
  })
})
