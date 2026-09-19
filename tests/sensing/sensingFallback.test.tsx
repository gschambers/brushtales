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

  it('maps native processing failures to processingUnavailable', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const visionCamera = require('react-native-vision-camera').VisionCamera as {
      cameraPermissionStatus: string
      requestCameraPermission: jest.Mock
    }
    visionCamera.cameraPermissionStatus = 'not-determined'
    visionCamera.requestCameraPermission.mockRejectedValueOnce(new Error('native unavailable'))
    const adapter = new NativeSensingAdapter()

    await expect(adapter.start(() => undefined)).resolves.toBe('processingUnavailable')
  })
})
