import { NativeSensingAdapter } from '../../src/sensing/nativeSensingAdapter'

jest.mock('react-native-vision-camera', () => ({
  VisionCamera: {
    cameraPermissionStatus: 'denied',
    requestCameraPermission: jest.fn(async () => false),
  },
}))

describe('NativeSensingAdapter fallback', () => {
  it('maps denied camera permission to a typed permissionDenied status', async () => {
    const signals: unknown[] = []
    const adapter = new NativeSensingAdapter()

    await expect(adapter.start((signal) => signals.push(signal))).resolves.toBe('permissionDenied')
    expect(signals).toEqual([])
    await expect(adapter.stop()).resolves.toBeUndefined()
  })
})
