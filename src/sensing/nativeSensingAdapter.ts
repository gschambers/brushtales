import { VisionCamera } from 'react-native-vision-camera'

import type { SensingSignal, SensingStatus } from '../domain/session/types'
import type { SensingAdapter, SensingListener } from './sensingAdapter'

/**
 * Native camera seam for the feasibility spike. It deliberately emits no
 * frame pixels or model objects; a future frame processor may only translate
 * transient frames into SensingSignal values here.
 */
export class NativeSensingAdapter implements SensingAdapter {
  private listener: SensingListener | null = null
  private running = false

  async start(listener: SensingListener): Promise<SensingStatus> {
    this.listener = listener
    const permissionStatus = VisionCamera.cameraPermissionStatus
    if (permissionStatus === 'restricted') return 'unsupported'
    if (permissionStatus === 'denied') return 'permissionDenied'
    if (permissionStatus === 'not-determined' && !(await VisionCamera.requestCameraPermission())) {
      return 'permissionDenied'
    }

    this.running = true
    listener({
      status: 'ready',
      motionScore: 0,
      coveragePrompt: null,
      confidence: 'low',
    })
    return 'ready'
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
