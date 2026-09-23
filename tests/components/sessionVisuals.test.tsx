import { fireEvent, render } from '@testing-library/react-native'

import { ActScreen } from '../../src/components/session/ActScreen'
import { BrushingSurface } from '../../src/components/session/BrushingSurface'
import { CompletionScreen } from '../../src/components/session/CompletionScreen'
import { ZoneAtlas } from '../../src/components/session/ZoneAtlas'
import type { SessionSnapshot } from '../../src/domain/session/types'
import type { StorySessionViewState } from '../../src/session/storySessionTypes'

jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => null,
}))

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

    expect(rendered.getAllByTestId('prototype-tooth')).toHaveLength(20)
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

  it('preserves the prototype composition when the camera image is unavailable', async () => {
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

    expect(rendered.getByTestId('session-stage')).toBeTruthy()
    expect(rendered.getByTestId('camera-helper-head')).toBeTruthy()
    expect(rendered.getByTestId('lower-region')).toBeTruthy()
    expect(rendered.getByTestId('zone-atlas')).toBeTruthy()
  })

  it('keeps the unavailable-sensing composition and explains the fallback', async () => {
    const rendered = await render(
      <BrushingSurface
        snapshot={{ ...snapshot, sensingStatus: 'permissionDenied' }}
        viewState={{ ...viewState, sensingStatus: 'permissionDenied' }}
        onPauseResume={jest.fn()}
        onExit={jest.fn()}
        showCamera
        reducedMotion
      />,
    )

    expect(rendered.getByTestId('camera-preview')).toBeTruthy()
    expect(rendered.getByText(/camera helper is unavailable/i)).toBeTruthy()
  })

  it('clamps the lower-right brush marker inside a narrow atlas', async () => {
    const upper = await render(<ZoneAtlas zoneIndex={2} width={200} />)
    const lower = await render(<ZoneAtlas zoneIndex={11} width={200} />)
    const upperMarker = upper.getByTestId('toothbrush-sweep-running')
    const lowerMarker = lower.getByTestId('toothbrush-sweep-running')
    const upperStyle = Array.isArray(upperMarker.props.style) ? Object.assign({}, ...upperMarker.props.style) : upperMarker.props.style
    const lowerStyle = Array.isArray(lowerMarker.props.style) ? Object.assign({}, ...lowerMarker.props.style) : lowerMarker.props.style

    expect(upperStyle.left).toBeLessThanOrEqual(68)
    expect(upperStyle.left).toBeGreaterThanOrEqual(0)
    expect(lowerStyle.left).toBeLessThanOrEqual(68)
    expect(lowerStyle.left).toBeGreaterThanOrEqual(0)
  })

  it('uses the prototype-sized toothbrush cue in a responsive atlas', async () => {
    const rendered = await render(<ZoneAtlas zoneIndex={2} width={280} />)
    const toothbrush = rendered.getByTestId('toothbrush', { includeHiddenElements: true })
    const style = Array.isArray(toothbrush.props.style) ? Object.assign({}, ...toothbrush.props.style) : toothbrush.props.style

    const atlasStyle = rendered.getByTestId('zone-atlas').props.style
    const atlas = Array.isArray(atlasStyle) ? Object.assign({}, ...atlasStyle) : atlasStyle
    expect(atlas.width).toBe(280)
    expect(style.width).toBe(112)
    const markerStyle = rendered.getByTestId('toothbrush-sweep-running').props.style
    const marker = Array.isArray(markerStyle) ? Object.assign({}, ...markerStyle) : markerStyle
    expect(marker.width).toBe(150)
  })

  it('scales atlas teeth and active color with the prototype session tone', async () => {
    const rendered = await render(<ZoneAtlas zoneIndex={0} width={188} tone={{ accent: '#80b9cd', deep: '#4d6f7c', light: '#e4f1f6' }} />)
    const defaultTone = await render(<ZoneAtlas zoneIndex={0} width={188} />)
    const tooth = rendered.getAllByTestId('prototype-tooth')[0]

    expect(tooth.props.d).toMatch(/^M 5\.85/)
    expect(tooth.props.fill).not.toEqual(defaultTone.getAllByTestId('prototype-tooth')[0].props.fill)
    expect(rendered.getAllByTestId('active-tooth-outline')[0].props.stroke).toMatchObject({ payload: 0xffe4f1f6 })
  })

  it('uses the prototype SVG tooth artwork and surface details', async () => {
    const chewing = await render(<ZoneAtlas zoneIndex={3} width={210} reducedMotion />)
    const inside = await render(<ZoneAtlas zoneIndex={6} width={210} reducedMotion />)

    expect(chewing.getByTestId('prototype-mouth-atlas')).toBeTruthy()
    expect(chewing.getAllByTestId('prototype-tooth')).toHaveLength(20)
    expect(chewing.getAllByTestId('chewing-groove')).toHaveLength(8)
    expect(inside.getAllByTestId('inside-gum-highlight')).toHaveLength(3)
    expect(chewing.getAllByTestId('tooth-highlight-reflection')).toHaveLength(12)
    expect(inside.getAllByTestId('tooth-highlight-reflection')).toHaveLength(12)
  })

  it('outlines the inside-surface gum cue with the tone light color', async () => {
    const rendered = await render(<ZoneAtlas zoneIndex={6} width={210} tone={{ accent: '#80b9cd', deep: '#4d6f7c', light: '#e4f1f6' }} />)
    const gumCue = rendered.getAllByTestId('inside-gum-highlight')[0]

    expect(gumCue.props.stroke).toMatchObject({ payload: 0xffe4f1f6 })
    expect(gumCue.props.strokeWidth).toBe(4)
  })

  it('renders the prototype toothbrush vector rather than a raster substitute', async () => {
    const rendered = await render(<ZoneAtlas zoneIndex={0} width={210} reducedMotion />)

    expect(rendered.getByTestId('prototype-toothbrush-vector', { includeHiddenElements: true })).toBeTruthy()
    expect(rendered.getAllByTestId('prototype-toothbrush-linework', { includeHiddenElements: true })).toHaveLength(4)
  })

  it('sweeps the toothbrush only while running and positions it at the active surface', async () => {
    const running = await render(<ZoneAtlas zoneIndex={0} width={210} reducedMotion={false} paused={false} />)
    const paused = await render(<ZoneAtlas zoneIndex={17} width={210} reducedMotion paused />)
    const runningStyle = running.getByTestId('toothbrush-sweep-running').props.style
    const runningFrame = Array.isArray(runningStyle) ? Object.assign({}, ...runningStyle) : runningStyle

    expect(running.getByTestId('toothbrush-sweep-running')).toBeTruthy()
    expect(runningFrame.top).toBe(2)
    expect(running.getByTestId('toothbrush', { includeHiddenElements: true }).props.accessibilityLabel).toBe('Top teeth · front · left side')
    expect(paused.getByTestId('toothbrush-sweep-static')).toBeTruthy()
    expect(paused.getByTestId('toothbrush', { includeHiddenElements: true }).props.accessibilityLabel).toBe('Bottom teeth · inside · right side')
  })

  it('follows the prototype’s complete 18-zone mouth-state order', async () => {
    const expected = [
      'Top teeth · front · left side', 'Top teeth · front · center', 'Top teeth · front · right side',
      'Top teeth · chewing surfaces · left side', 'Top teeth · chewing surfaces · center', 'Top teeth · chewing surfaces · right side',
      'Top teeth · inside · left side', 'Top teeth · inside · center', 'Top teeth · inside · right side',
      'Bottom teeth · front · left side', 'Bottom teeth · front · center', 'Bottom teeth · front · right side',
      'Bottom teeth · chewing surfaces · left side', 'Bottom teeth · chewing surfaces · center', 'Bottom teeth · chewing surfaces · right side',
      'Bottom teeth · inside · left side', 'Bottom teeth · inside · center', 'Bottom teeth · inside · right side',
    ]

    for (const [zoneIndex, label] of expected.entries()) {
      const rendered = await render(<ZoneAtlas zoneIndex={zoneIndex} width={210} reducedMotion />)
      expect(rendered.getByTestId(zoneIndex % 9 < 3 ? 'mouth-state-closed' : 'mouth-state-open')).toBeTruthy()
      expect(rendered.getByLabelText(`${label} highlighted`)).toBeTruthy()
    }
  })

  it('uses the prototype’s closed and open tooth vector geometry', async () => {
    const closed = await render(<ZoneAtlas zoneIndex={0} width={210} reducedMotion />)
    const open = await render(<ZoneAtlas zoneIndex={3} width={210} reducedMotion />)

    const closedStyle = closed.getByTestId('zone-atlas').props.style
    const closedAtlas = Array.isArray(closedStyle) ? Object.assign({}, ...closedStyle) : closedStyle
    const openStyle = open.getByTestId('zone-atlas').props.style
    const openAtlas = Array.isArray(openStyle) ? Object.assign({}, ...openStyle) : openStyle

    expect(closedAtlas.height).toBe(60)
    expect(openAtlas.height).toBe(112)
    expect(closed.getAllByTestId('prototype-tooth')[0].props.d).toMatch(/^M 5\.85/)
  })

  it('uses the prototype’s viewport-based tooth width rather than atlas width', async () => {
    const rendered = await render(<ZoneAtlas zoneIndex={0} width={188} viewportWidth={320} reducedMotion />)

    expect(rendered.getAllByTestId('prototype-tooth')[0].props.d).toMatch(/^M 6\.4/)
  })
})
