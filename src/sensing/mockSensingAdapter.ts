import type { SensingSignal, SensingStatus } from '../domain/session/types'
import type { SensingAdapter, SensingListener } from './sensingAdapter'

export class MockSensingAdapter implements SensingAdapter {
  private listener: SensingListener | null = null

  constructor(
    private readonly signals: SensingSignal[] = [],
    private readonly initialStatus: SensingStatus = 'ready',
  ) {}

  async start(listener: SensingListener): Promise<SensingStatus> {
    this.listener = listener
    this.signals.forEach((signal) => listener(signal))
    return this.initialStatus
  }

  async stop(): Promise<void> {
    this.listener = null
  }

  emit(signal: SensingSignal): void {
    this.listener?.(signal)
  }
}
