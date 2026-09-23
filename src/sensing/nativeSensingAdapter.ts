import type { SensingSignal, SensingStatus } from '../domain/session/types'
import type { SensingAdapter, SensingListener } from './sensingAdapter'

type VisionCameraPermissionStatus = 'not-determined' | 'authorized' | 'denied' | 'restricted'

export interface VisionCameraSource {
  cameraPermissionStatus: VisionCameraPermissionStatus
}

export interface DerivedVisionFeatures {
  childInFrame: boolean
  lowLight: boolean
  motionScore: number
  coveragePrompt: string | null
}

export interface SensingThresholds {
  steadyMotionScore: number
  strongMotionScore: number
}

const defaultThresholds: SensingThresholds = {
  steadyMotionScore: 0.35,
  strongMotionScore: 0.7,
}

export function deriveSensingSignal(
  features: DerivedVisionFeatures,
  thresholds: SensingThresholds = defaultThresholds,
): SensingSignal {
  const confidence = features.motionScore >= thresholds.strongMotionScore
    ? 'high'
    : features.motionScore >= thresholds.steadyMotionScore ? 'medium' : 'low'
  return {
    status: !features.childInFrame ? 'noFace' : features.lowLight ? 'lowLight' : 'ready',
    motionScore: features.motionScore,
    coveragePrompt: features.coveragePrompt,
    confidence,
  }
}

function getVisionCamera(): VisionCameraSource {
  // Keep the native Nitro module out of pure domain/test imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-vision-camera').VisionCamera as VisionCameraSource
}

/**
 * Native camera seam for the feasibility spike. It deliberately emits no
 * frame pixels or model objects; a future frame processor may only translate
 * transient frames into SensingSignal values here.
 */
export class NativeSensingAdapter implements SensingAdapter {
  private listener: SensingListener | null = null
  private running = false

  constructor(private readonly getCamera: () => VisionCameraSource = getVisionCamera) {}

  async start(listener: SensingListener): Promise<SensingStatus> {
    this.listener = listener
    let status: SensingStatus
    try {
      const visionCamera = this.getCamera()
      const permissionStatus = visionCamera.cameraPermissionStatus
      if (permissionStatus === 'restricted') status = 'unsupported'
      else if (permissionStatus === 'denied') status = 'permissionDenied'
      else status = 'processingUnavailable'
    } catch {
      status = 'processingUnavailable'
    }
    this.running = false
    listener({ status, motionScore: 0, coveragePrompt: null, confidence: 'low' })
    return status
  }

  async stop(): Promise<void> {
    this.running = false
    this.listener = null
  }

  /** Adapter-only hook for a future native frame processor translation. */
  emitSignal(signal: SensingSignal): void {
    if (this.running) this.listener?.(signal)
  }
}
