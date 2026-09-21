import { fireEvent, render } from '@testing-library/react-native'

import { ActScreen } from '../../src/components/session/ActScreen'
import { BrushingSurface } from '../../src/components/session/BrushingSurface'
import { CompletionScreen } from '../../src/components/session/CompletionScreen'
import { ZoneAtlas } from '../../src/components/session/ZoneAtlas'
import type { SessionSnapshot } from '../../src/domain/session/types'
import type { StorySessionViewState } from '../../src/session/storySessionTypes'

const snapshot: SessionSnapshot = {
  status: 'running',
  elapsedMs: 12_000,
  remainingMs: 108_000,
  sensingStatus: 'ready',
  keepAwakeState: 'active',
}

const viewState: StorySessionViewState = {
  phase: 'brushing',
  audioState: 'playing',
  zoneIndex: 0,
  remainingMs: 108_000,
  sensingStatus: 'ready',
  keepAwakeState: 'active',
  statusNotice: null,
}

describe('native session visuals', () => {
  it('renders the opening act with one Begin story action', async () => {
    const onPress = jest.fn()
    const rendered = await render(
      <ActScreen
        act="opening"
        title="The Sky Reef is waking."
        body="Let’s follow the bright current together."
        primaryLabel="Begin story"
        onPrimaryPress={onPress}
      />,
    )

    fireEvent.press(rendered.getByRole('button', { name: 'Begin story' }))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(rendered.getByText('Act 1 · Opening audiobook')).toBeTruthy()
  })

  it('renders the closing act as the narrative conclusion', async () => {
    const rendered = await render(
      <ActScreen
        act="closing"
        title="The crew found the way home."
        body="The Sky Reef chapter is drawing to a gentle close."
        primaryLabel="Finish chapter"
        onPrimaryPress={jest.fn()}
      />,
    )

    expect(rendered.getByText('Act 3 · Closing audiobook')).toBeTruthy()
    expect(rendered.getByRole('button', { name: 'Finish chapter' })).toBeTruthy()
    expect(rendered.queryByText(/story choice/i)).toBeNull()
  })

  it('offers positive completion copy and an accessible return action', async () => {
    const onReturn = jest.fn()
    const rendered = await render(<CompletionScreen completed onReturn={onReturn} />)

    fireEvent.press(rendered.getByRole('button', { name: 'Return to profiles' }))

    expect(onReturn).toHaveBeenCalledTimes(1)
    expect(rendered.getByText('You kept exploring.')).toBeTruthy()
    expect(rendered.queryByText(/failed|dirty|clean teeth/i)).toBeNull()
  })

  it.each([0, 2, 9, 11, 17])('renders the atlas with 20 teeth and the authored active group at zone %i', async (zoneIndex) => {
    const rendered = await render(<ZoneAtlas zoneIndex={zoneIndex} reducedMotion />)
    const expectedActiveTeeth = zoneIndex % 3 === 1 ? 4 : 3

    expect(rendered.getAllByTestId('tooth')).toHaveLength(20)
    expect(rendered.getAllByTestId('active-tooth')).toHaveLength(expectedActiveTeeth)
    expect(rendered.getByTestId('toothbrush', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true)
  })

  it('maps authored groups and mirrors the lower row anchor', async () => {
    expect((await render(<ZoneAtlas zoneIndex={0} />)).getByTestId('active-group-left')).toBeTruthy()
    expect((await render(<ZoneAtlas zoneIndex={1} />)).getByTestId('active-group-center')).toBeTruthy()
    expect((await render(<ZoneAtlas zoneIndex={2} />)).getByTestId('active-group-right')).toBeTruthy()
    expect((await render(<ZoneAtlas zoneIndex={11} />)).getByTestId('active-group-right-lower')).toBeTruthy()
  })

  it('shows a seconds-only countdown and pause control without a finish action', async () => {
    const rendered = await render(
      <BrushingSurface
        snapshot={snapshot}
        viewState={viewState}
        onPauseResume={jest.fn()}
        onExit={jest.fn()}
        showCamera={false}
        reducedMotion
      />,
    )

    expect(rendered.getByText('108')).toBeTruthy()
    expect(rendered.getByTestId('camera-preview')).toBeTruthy()
    expect(rendered.getByTestId('audio-ring')).toBeTruthy()
    expect(rendered.getByRole('button', { name: 'Pause adventure' })).toBeTruthy()
    expect(rendered.queryByRole('button', { name: 'Finish adventure' })).toBeNull()
  })
})
