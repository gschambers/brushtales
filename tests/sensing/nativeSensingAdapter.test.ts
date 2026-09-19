import {
  deriveSensingSignal,
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
})
