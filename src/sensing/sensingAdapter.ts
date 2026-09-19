import type { SensingSignal, SensingStatus } from '../domain/session/types'

export type SensingListener = (signal: SensingSignal) => void

export interface SensingAdapter {
  start(listener: SensingListener): Promise<SensingStatus>
  stop(): Promise<void>
}
