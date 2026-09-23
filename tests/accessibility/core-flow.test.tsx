import { act, fireEvent, render } from '@testing-library/react-native'

import { SessionScreen } from '../../app/session/[storyId]'
import { DeterministicAudioPlayer } from '../../src/audio/deterministicAudioPlayer'
import { DeterministicSensingAdapter } from '../../src/sensing/deterministicSensingAdapter'

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), replace: jest.fn(), remove: jest.fn() })),
}))

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => null,
}))

class TestClock {
  now(): number { return 0 }
}

async function settle(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve()
}

describe('core flow accessibility', () => {
  it('gives the active session pause control an accessible label', async () => {
    const audio = new DeterministicAudioPlayer()
    const rendered = await render(
      <SessionScreen
        storyId="sky-reef"
        audio={audio}
        sensing={new DeterministicSensingAdapter()}
        clock={new TestClock()}
      />,
    )
    await act(async () => {
      fireEvent.press(rendered.getByRole('button', { name: 'Begin story' }))
      audio.finish()
      await settle()
    })

    expect(rendered.getByRole('button', { name: 'Pause adventure' })).toBeTruthy()
    expect(rendered.getByRole('button', { name: 'Exit adventure' })).toBeTruthy()
  })
})
