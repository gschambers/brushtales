import { LocalAudioPlayer, type NativeAudioPlayer } from '../../src/audio/audioPlayer'

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(),
}))

class FakeNativeAudioPlayer implements NativeAudioPlayer {
  plays = 0
  pauses = 0
  replacements: string[] = []

  play() {
    this.plays += 1
  }
  pause() {
    this.pauses += 1
  }
  replace(source: { uri: string }) {
    this.replacements.push(source.uri)
  }
  remove() {}
}

describe('LocalAudioPlayer', () => {
  it('uses a safe fallback asset when an ID is unavailable', async () => {
    const native = new FakeNativeAudioPlayer()
    const createdAssets: string[] = []
    const player = new LocalAudioPlayer({
      createNativePlayer: (asset) => {
        createdAssets.push(asset.uri)
        return native
      },
    })

    await player.load('missing-asset')
    await player.play()
    await player.pause()

    expect(player.loadedAssetId).toBe('session-fallback')
    expect(createdAssets).toEqual(['bundled://audio/session-fallback.m4a'])
    expect(native.plays).toBe(1)
    expect(native.pauses).toBe(1)
  })
})
