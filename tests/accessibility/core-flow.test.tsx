import { act, fireEvent, render } from '@testing-library/react-native'

import { SessionScreen } from '../../app/session/[storyId]'

jest.mock('../../src/platform/permissions', () => ({
  requestCameraPermission: jest.fn(async () => 'denied'),
}))

jest.mock('../../src/sensing/nativeSensingAdapter', () => ({
  NativeSensingAdapter: class {
    async start() {
      return 'permissionDenied'
    }
    async stop() {}
  },
}))

jest.mock('react-native-vision-camera', () => ({ Camera: () => null, useCameraDevice: () => null }))
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), replace: jest.fn(), remove: jest.fn() })),
}))

describe('core flow accessibility', () => {
  it('gives the active session pause control an accessible label', async () => {
    const rendered = await render(<SessionScreen storyId="sky-reef" />)
    await act(async () => {
      fireEvent.press(rendered.getByRole('button', { name: 'Start adventure' }))
    })
    await rendered.findByText('Brush session in progress')

    expect(rendered.getByRole('button', { name: 'Pause adventure' })).toBeTruthy()
  })
})
