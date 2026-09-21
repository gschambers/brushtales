import { DeterministicAudioPlayer } from '../../src/audio/deterministicAudioPlayer'
import type { KeepAwakeController } from '../../src/platform/keepAwake'
import { createStorySessionController } from '../../src/session/storySessionController'
import { DeterministicSensingAdapter } from '../../src/sensing/deterministicSensingAdapter'

class TestClock {
  private timeMs = 0

  now(): number {
    return this.timeMs
  }

  advance(ms: number): void {
    this.timeMs += ms
  }
}

function createKeepAwake() {
  let revoked: (() => void) | null = null
  const keepAwake: KeepAwakeController = {
    acquire: jest.fn(async () => 'active' as const),
    release: jest.fn(async () => undefined),
    onStateChange: jest.fn((listener) => {
      revoked = () => listener('revoked')
      return () => {
        revoked = null
      }
    }),
  }
  return { keepAwake, revoke: () => revoked?.() }
}

function createFixture() {
  const audio = new DeterministicAudioPlayer()
  const sensing = new DeterministicSensingAdapter()
  const clock = new TestClock()
  const keepAwake = createKeepAwake()
  const controller = createStorySessionController({
    audio,
    sensing,
    keepAwake: keepAwake.keepAwake,
    clock,
    profileId: 'profile-1',
    storyId: 'sky-reef',
    durationMs: 120_000,
    openingAssetId: 'intro',
    brushingAssetId: 'session-fallback',
    closingAssetId: 'closing',
  })
  return { audio, sensing, clock, keepAwake, controller }
}

async function settle(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve()
}

describe('story session controller', () => {
  it('does not start brushing before opening audio finishes', async () => {
    const { audio, controller } = createFixture()

    await controller.beginStory()

    expect(controller.state().phase).toBe('opening')
    expect(controller.snapshot().status).toBe('idle')
    expect(audio.loadedAssetId).toBe('intro')
  })

  it('starts brushing after opening finishes', async () => {
    const { audio, controller } = createFixture()

    await controller.beginStory()
    audio.finish()
    await settle()

    expect(controller.state().phase).toBe('brushing')
    expect(controller.snapshot()).toMatchObject({ status: 'running', remainingMs: 120_000 })
  })

  it('enters closing exactly once when the engine completes', async () => {
    const { audio, clock, controller, keepAwake } = createFixture()

    await controller.beginStory()
    audio.finish()
    await settle()
    clock.advance(120_000)
    controller.refresh()
    controller.refresh()
    await settle()

    expect(controller.state().phase).toBe('closing')
    expect(audio.loadedAssetId).toBe('closing')
    expect(keepAwake.keepAwake.release).toHaveBeenCalledTimes(1)
  })

  it('enters complete after closing audio finishes', async () => {
    const { audio, clock, controller } = createFixture()

    await controller.beginStory()
    audio.finish()
    await settle()
    clock.advance(120_000)
    controller.refresh()
    await settle()
    audio.finish()
    await settle()

    expect(controller.state().phase).toBe('complete')
  })

  it('lets the closing action complete the chapter as a fallback', async () => {
    const { audio, clock, controller } = createFixture()

    await controller.beginStory()
    audio.finish()
    await settle()
    clock.advance(120_000)
    controller.refresh()
    await settle()
    await controller.completeClosing()

    expect(controller.state().phase).toBe('complete')
  })

  it('preserves the session through pause and resume', async () => {
    const { audio, controller } = createFixture()

    await controller.beginStory()
    audio.finish()
    await settle()
    await controller.pauseOrResume()
    expect(controller.snapshot().status).toBe('paused')
    await controller.pauseOrResume()

    expect(controller.snapshot().status).toBe('running')
  })

  it('maps sensing and wake failures to quiet notices', async () => {
    const { audio, controller, sensing, keepAwake } = createFixture()

    await controller.beginStory()
    audio.finish()
    await settle()
    sensing.emit({ status: 'noFace', motionScore: 0, coveragePrompt: null, confidence: 'low' })
    controller.refresh()
    expect(controller.state().statusNotice).toMatch(/keep exploring/i)
    keepAwake.revoke()
    expect(controller.state().statusNotice).toMatch(/dim/i)
  })

  it('keeps an audio interruption recoverable', async () => {
    const { audio, clock, controller } = createFixture()

    await controller.beginStory()
    audio.finish()
    await settle()
    clock.advance(1_000)
    audio.interrupt()
    await settle()

    expect(controller.state().phase).toBe('brushing')
    expect(controller.state().statusNotice).toMatch(/audio/i)
    expect(controller.snapshot().status).toBe('paused')
    expect(controller.snapshot().remainingMs).toBe(119_000)
  })

  it.each(['permissionDenied', 'lowLight', 'processingUnavailable'] as const)('maps %s sensing failure to a calm notice', async (status) => {
    const audio = new DeterministicAudioPlayer()
    const sensing = {
      start: async (listener: (signal: { status: typeof status; motionScore: number; coveragePrompt: null; confidence: 'low' }) => void) => {
        listener({ status, motionScore: 0, coveragePrompt: null, confidence: 'low' })
        return status
      },
      stop: async () => undefined,
    }
    const failureController = createStorySessionController({
      audio,
      sensing,
      keepAwake: createKeepAwake().keepAwake,
      clock: new TestClock(),
      profileId: 'profile-1',
      storyId: 'sky-reef',
      durationMs: 120_000,
      openingAssetId: 'intro',
      brushingAssetId: 'session-fallback',
      closingAssetId: 'closing',
    })
    await failureController.beginStory()
    audio.finish()
    await settle()

    expect(failureController.state().statusNotice).toBeTruthy()
  })

  it('stops and releases resources once when cleanup is repeated', async () => {
    const { audio, controller, keepAwake } = createFixture()

    await controller.beginStory()
    audio.finish()
    await settle()
    await Promise.all([controller.stop(), controller.stop()])

    expect(keepAwake.keepAwake.release).toHaveBeenCalledTimes(1)
    expect(controller.snapshot().status).toBe('stopped')
  })
})
