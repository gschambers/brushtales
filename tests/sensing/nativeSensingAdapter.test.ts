import {
  deriveSensingSignal,
  NativeSensingAdapter,
  type DerivedVisionFeatures,
} from '../../src/sensing/nativeSensingAdapter'

describe('derived sensing signal boundary', () => {
  it('maps no-face and low-light conditions to honest failure statuses', () => {
    const base: DerivedVisionFeatures = {
      childInFrame: false,
      lowLight: false,
      motionScore: 0.8,
      coveragePrompt: null,
    }

    expect(deriveSensingSignal(base).status).toBe('noFace')
    expect(deriveSensingSignal({ ...base, childInFrame: true, lowLight: true }).status).toBe('lowLight')
  })

  it('keeps motion thresholds configurable and emits only coarse values', () => {
    const signal = deriveSensingSignal(
      { childInFrame: true, lowLight: false, motionScore: 0.75, coveragePrompt: 'upper' },
      { steadyMotionScore: 0.4, strongMotionScore: 0.8 },
    )

    expect(signal).toEqual({
      status: 'ready',
      motionScore: 0.75,
      coveragePrompt: 'upper',
      confidence: 'medium',
    })
  })

  it('reports processing unavailable when permission is granted but no frame processor exists', async () => {
    const camera = {
      cameraPermissionStatus: 'authorized' as const,
    }
    const adapter = new NativeSensingAdapter(() => camera)
    const listener = jest.fn()

    await expect(adapter.start(listener)).resolves.toBe('processingUnavailable')
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 'processingUnavailable' }))
  })

  it('emits permission-denied status to the session controller', async () => {
    const camera = {
      cameraPermissionStatus: 'denied' as const,
    }
    const adapter = new NativeSensingAdapter(() => camera)
    const listener = jest.fn()

    await expect(adapter.start(listener)).resolves.toBe('permissionDenied')
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 'permissionDenied' }))
  })

  it('uses the audio fallback while camera permission is undetermined', async () => {
    const camera = {
      cameraPermissionStatus: 'not-determined' as const,
    }
    const adapter = new NativeSensingAdapter(() => camera)

    await expect(adapter.start(jest.fn())).resolves.toBe('processingUnavailable')
  })
})
