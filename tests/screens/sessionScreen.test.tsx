import { act, fireEvent, render } from '@testing-library/react-native'

import { SessionScreen } from '../../app/session/[storyId]'
import type { KeepAwakeController } from '../../src/platform/keepAwake'

const mockDatabase = {
  execAsync: jest.fn(async () => undefined),
  runAsync: jest.fn(async () => ({ changes: 1, lastInsertRowId: 1 })),
  getFirstAsync: jest.fn(async () => null),
  getAllAsync: jest.fn(async () => []),
}

jest.mock('../../src/platform/permissions', () => ({
  requestCameraPermission: jest.fn(async () => 'denied'),
}))

jest.mock('../../src/storage/database', () => ({
  openAppDatabase: jest.fn(async () => mockDatabase),
}))

jest.mock('../../src/sensing/nativeSensingAdapter', () => ({
  NativeSensingAdapter: class {
    async start() {
      return 'permissionDenied'
    }
    async stop() {}
  },
}))

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => null,
}))

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ storyId: 'sky-reef' }),
}))

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), replace: jest.fn(), remove: jest.fn() })),
}))

describe('SessionScreen', () => {
  it('continues as audio-only when camera permission is denied', async () => {
    const rendered = await render(<SessionScreen storyId="sky-reef" />)

    await act(async () => {
      fireEvent.press(rendered.getByRole('button', { name: 'Start adventure' }))
    })

    expect(await rendered.findByText('Audio-only mode')).toBeTruthy()
    expect(rendered.getByText('The adventure can still continue')).toBeTruthy()
  })

  it('reports a revoked wake lock without stopping the session', async () => {
    let revoked: (() => void) | null = null
    const keepAwake: KeepAwakeController = {
      acquire: async () => 'active',
      release: async () => undefined,
      onStateChange: (listener) => {
        revoked = () => listener('revoked')
        return () => {
          revoked = null
        }
      },
    }
    const rendered = await render(<SessionScreen storyId="sky-reef" keepAwake={keepAwake} />)

    await act(async () => {
      fireEvent.press(rendered.getByRole('button', { name: 'Start adventure' }))
    })
    expect(await rendered.findByText('Brush session in progress')).toBeTruthy()
    expect(revoked).not.toBeNull()
    await act(async () => {
      revoked?.()
    })

    expect(await rendered.findByText('Screen may dim')).toBeTruthy()
    expect(rendered.getByText('Brush session in progress')).toBeTruthy()
  })

  it('shows the same non-blocking notice when wake lock acquisition is denied', async () => {
    const keepAwake: KeepAwakeController = {
      acquire: async () => 'denied',
      release: async () => undefined,
    }
    const rendered = await render(<SessionScreen storyId="sky-reef" keepAwake={keepAwake} />)
    await act(async () => {
      fireEvent.press(rendered.getByRole('button', { name: 'Start adventure' }))
    })

    expect(await rendered.findByText('Screen may dim')).toBeTruthy()
    expect(rendered.getByText('Brush session in progress')).toBeTruthy()
  })

  it('progresses through authored choices and persists one completion summary', async () => {
    const rendered = await render(<SessionScreen storyId="sky-reef" profileId="profile-1" />)
    const press = async (name: string) => {
      await act(async () => {
        fireEvent.press(rendered.getByRole('button', { name }))
      })
    }

    await press('Start adventure')
    await press('Continue adventure')
    expect(rendered.getByText('Which path should guide the sky-reef voyage?')).toBeTruthy()
    await press('Follow the bubbles')
    await press('Continue adventure')
    await press('Ring the sky bell')
    await press('Continue adventure')
    await press('Share the treasure')
    await press('Finish adventure')

    expect(mockDatabase.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO session_summaries'),
      expect.arrayContaining(['profile-1', 'sky-reef']),
    )
  })
})
