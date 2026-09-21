import { act, fireEvent, render } from '@testing-library/react-native'

import { router } from 'expo-router'
import { SessionScreen } from '../../app/session/[storyId]'
import { DeterministicAudioPlayer } from '../../src/audio/deterministicAudioPlayer'
import type { KeepAwakeController } from '../../src/platform/keepAwake'
import { DeterministicSensingAdapter } from '../../src/sensing/deterministicSensingAdapter'

const mockDatabase = {
  execAsync: jest.fn(async () => undefined),
  runAsync: jest.fn(async () => ({ changes: 1, lastInsertRowId: 1 })),
  getFirstAsync: jest.fn(async () => null),
  getAllAsync: jest.fn(async () => []),
}

jest.mock('../../src/storage/database', () => ({
  openAppDatabase: jest.fn(async () => mockDatabase),
}))

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ storyId: 'sky-reef' }),
}))

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), replace: jest.fn(), remove: jest.fn() })),
}))

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => null,
}))

class TestClock {
  timeMs = 0
  now(): number { return this.timeMs }
  advance(ms: number): void { this.timeMs += ms }
}

function createKeepAwake(state: 'active' | 'denied' = 'active') {
  let revoked: (() => void) | null = null
  const keepAwake: KeepAwakeController = {
    acquire: jest.fn(async () => state),
    release: jest.fn(async () => undefined),
    onStateChange: (listener) => {
      revoked = () => listener('revoked')
      return () => { revoked = null }
    },
  }
  return { keepAwake, revoke: () => revoked?.() }
}

function createFixture(keepAwake = createKeepAwake()) {
  return {
    audio: new DeterministicAudioPlayer(),
    sensing: new DeterministicSensingAdapter(),
    clock: new TestClock(),
    keepAwake: keepAwake.keepAwake,
  }
}

async function settle(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve()
}

describe('SessionScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('moves from the opening audiobook into brushing only after opening audio finishes', async () => {
    const fixture = createFixture()
    const rendered = await render(<SessionScreen storyId="sky-reef" {...fixture} />)

    await act(async () => {
      fireEvent.press(rendered.getByRole('button', { name: 'Begin story' }))
    })
    expect(rendered.getByText('Act 1 · Opening audiobook')).toBeTruthy()

    await act(async () => {
      fixture.audio.finish()
      await settle()
    })

    expect(rendered.getByRole('button', { name: 'Pause adventure' })).toBeTruthy()
    expect(rendered.queryByRole('button', { name: 'Finish adventure' })).toBeNull()
  })

  it('keeps camera-unavailable brushing non-blocking and reports wake-lock denial', async () => {
    const fixture = createFixture(createKeepAwake('denied'))
    const rendered = await render(<SessionScreen storyId="sky-reef" {...fixture} />)

    await act(async () => {
      fireEvent.press(rendered.getByRole('button', { name: 'Begin story' }))
      fixture.audio.finish()
      await settle()
    })

    expect(rendered.getByText(/screen may dim/i)).toBeTruthy()
    expect(rendered.getByText('Brush session in progress')).toBeTruthy()
  })

  it('enters closing automatically and persists one completed summary before navigation', async () => {
    const fixture = createFixture()
    const rendered = await render(<SessionScreen storyId="sky-reef" profileId="profile-1" {...fixture} />)

    await act(async () => {
      fireEvent.press(rendered.getByRole('button', { name: 'Begin story' }))
      fixture.audio.finish()
      await settle()
    })
    fixture.clock.advance(120_000)
    await act(async () => {
      jest.advanceTimersByTime(250)
      await settle()
    })

    expect(rendered.getByText('Act 3 · Closing audiobook')).toBeTruthy()
    await act(async () => {
      fixture.audio.finish()
      await settle()
    })

    expect(mockDatabase.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO session_summaries'),
      expect.arrayContaining(['profile-1', 'sky-reef']),
    )
    expect(router.replace).toHaveBeenCalledWith(expect.stringContaining('/complete/'))
    expect(router.replace).toHaveBeenCalledTimes(1)
  })
})
