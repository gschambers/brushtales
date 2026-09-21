import type { AudioPlayerEvent } from '../../src/audio/audioPlayer'
import type { SensingSignal } from '../../src/domain/session/types'
import { DeterministicAudioPlayer } from '../../src/audio/deterministicAudioPlayer'
import { DevelopmentAudioPlayer } from '../../src/audio/developmentAudioPlayer'
import { DeterministicSensingAdapter } from '../../src/sensing/deterministicSensingAdapter'

describe('deterministic session dependencies', () => {
  it('loads, plays, and explicitly finishes without wall-clock timing', async () => {
    const audio = new DeterministicAudioPlayer()
    const events: AudioPlayerEvent[] = []
    audio.onStateChange((event) => events.push(event))

    await audio.load('intro')
    await audio.play()
    audio.finish()

    expect(audio.loadedAssetId).toBe('intro')
    expect(events).toEqual(['ready', 'playing', 'finished'])
  })

  it('emits an interruption event whenever interruption is requested', () => {
    const audio = new DeterministicAudioPlayer()
    const events: AudioPlayerEvent[] = []
    audio.onStateChange((event) => events.push(event))

    audio.interrupt()
    audio.interrupt()

    expect(events).toEqual(['interruption', 'interruption'])
  })

  it('automatically finishes authored audiobook clips for local development', async () => {
    jest.useFakeTimers()
    const audio = new DevelopmentAudioPlayer(500)
    const events: AudioPlayerEvent[] = []
    audio.onStateChange((event) => events.push(event))

    await audio.load('intro')
    await audio.play()
    jest.advanceTimersByTime(500)

    expect(events).toEqual(['ready', 'playing', 'finished'])
    jest.useRealTimers()
  })

  it('forwards sensing signals only while running', async () => {
    const sensing = new DeterministicSensingAdapter()
    const signals: SensingSignal[] = []
    const listener = (signal: SensingSignal) => signals.push(signal)

    await sensing.start(listener)
    sensing.emit({
      status: 'noFace',
      motionScore: 0,
      coveragePrompt: 'front',
      confidence: 'low',
    })
    await sensing.stop()
    sensing.emit({
      status: 'ready',
      motionScore: 0.8,
      coveragePrompt: null,
      confidence: 'high',
    })

    expect(signals).toHaveLength(2)
    expect(signals[0]).toMatchObject({ status: 'ready', confidence: 'low' })
    expect(signals[1]).toMatchObject({ status: 'noFace', coveragePrompt: 'front' })
  })
})
