import type { AudioPlayer, AudioPlayerEvent } from '../../src/audio/audioPlayer'
import type { KeepAwakeController } from '../../src/platform/keepAwake'
import { SessionEngine, type MonotonicClock } from '../../src/domain/session/sessionEngine'
import type { SensingAdapter } from '../../src/sensing/sensingAdapter'

class FakeMonotonicClock implements MonotonicClock {
  private time = 0

  now() {
    return this.time
  }

  advance(milliseconds: number) {
    this.time += milliseconds
  }
}

class FakeAudio implements AudioPlayer {
  private listeners = new Set<(event: AudioPlayerEvent) => void>()

  async load() {}
  async play() {}
  async pause() {}
  async stop() {}
  onStateChange(listener: (event: AudioPlayerEvent) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  emit(event: AudioPlayerEvent) {
    this.listeners.forEach((listener) => listener(event))
  }
}

class FakeSensing implements SensingAdapter {
  async start() {
    return 'ready' as const
  }
  async stop() {}
}

class FakeKeepAwake implements KeepAwakeController {
  releases = 0
  async acquire() {
    return 'active' as const
  }
  async release() {
    this.releases += 1
  }
}

function createEngine(clock = new FakeMonotonicClock(), audio = new FakeAudio(), keepAwake = new FakeKeepAwake()) {
  return {
    clock,
    audio,
    keepAwake,
    engine: new SessionEngine({ clock, audio, sensing: new FakeSensing(), keepAwake }),
  }
}

describe('SessionEngine', () => {
  it('uses elapsed monotonic time and completes once at two minutes', async () => {
    const { clock, engine, keepAwake } = createEngine()
    await engine.start({ profileId: 'p1', storyId: 'sky-reef', durationMs: 120_000 })

    clock.advance(60_000)
    await engine.pause()
    clock.advance(30_000)
    await engine.resume()
    clock.advance(60_000)

    expect(engine.snapshot().elapsedMs).toBe(120_000)
    expect(engine.snapshot().status).toBe('complete')
    await Promise.resolve()
    expect(keepAwake.releases).toBe(1)
  })

  it('returns an interrupted positive result when audio focus is lost', async () => {
    const { audio, engine } = createEngine()
    await engine.start({ profileId: 'p1', storyId: 'sky-reef', durationMs: 120_000 })

    audio.emit('interruption')
    const result = await engine.stop()

    expect(result.interrupted).toBe(true)
    expect(result.completedDurationMs).toBeGreaterThanOrEqual(0)
  })

  it('ignores repeated terminal transitions and releases keep-awake once', async () => {
    const { engine, keepAwake } = createEngine()
    await engine.start({ profileId: 'p1', storyId: 'sky-reef', durationMs: 120_000 })

    const first = await engine.stop()
    const second = await engine.stop()

    expect(second).toEqual(first)
    expect(keepAwake.releases).toBe(1)
    expect(engine.snapshot().status).toBe('stopped')
  })
})
