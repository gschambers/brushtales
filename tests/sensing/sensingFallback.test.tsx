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
    expect(signals).toEqual([expect.objectContaining({ status: 'permissionDenied' })])
    await expect(adapter.stop()).resolves.toBeUndefined()
  })

  it('keeps undetermined permission in the fallback path without requesting access', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const visionCamera = require('react-native-vision-camera').VisionCamera as {
      cameraPermissionStatus: string
      requestCameraPermission: jest.Mock
    }
    visionCamera.cameraPermissionStatus = 'not-determined'
    const adapter = new NativeSensingAdapter()

    await expect(adapter.start(() => undefined)).resolves.toBe('processingUnavailable')
    expect(visionCamera.requestCameraPermission).not.toHaveBeenCalled()
  })
})
