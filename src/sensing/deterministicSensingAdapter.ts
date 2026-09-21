import type { SensingSignal, SensingStatus } from '../domain/session/types'
import type { SensingAdapter, SensingListener } from './sensingAdapter'

const initialSignal: SensingSignal = {
  status: 'ready',
  motionScore: 0,
  coveragePrompt: null,
  confidence: 'low',
}

export class DeterministicSensingAdapter implements SensingAdapter {
  private listener: SensingListener | null = null
  private running = false

  async start(listener: SensingListener): Promise<SensingStatus> {
    this.listener = listener
    this.running = true
    listener(initialSignal)
    return initialSignal.status
  }

  async stop(): Promise<void> {
    this.running = false
    this.listener = null
  }

  emit(signal: SensingSignal): void {
    if (this.running) this.listener?.(signal)
  }
}
