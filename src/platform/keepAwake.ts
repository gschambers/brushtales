import {
  activateKeepAwakeAsync,
  addListener,
  deactivateKeepAwake,
} from 'expo-keep-awake'
import type { KeepAwakeState } from '../domain/session/types'

export interface KeepAwakeController {
  acquire(): Promise<KeepAwakeState>
  release(): Promise<void>
  onStateChange?(listener: (state: 'revoked') => void): () => void
}

const sessionTag = 'brushtales-session'

export class ExpoKeepAwakeController implements KeepAwakeController {
  private released = false
  private subscription: { remove(): void } | null = null
  private listeners = new Set<(state: 'revoked') => void>()

  async acquire(): Promise<KeepAwakeState> {
    try {
      await activateKeepAwakeAsync(sessionTag)
      this.subscription = addListener(sessionTag, ({ state }) => {
        if (state === 'release') {
          this.released = true
          this.listeners.forEach((listener) => listener('revoked'))
        }
      })
      return 'active'
    } catch {
      return 'denied'
    }
  }

  onStateChange(listener: (state: 'revoked') => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async release(): Promise<void> {
    if (!this.released) await deactivateKeepAwake(sessionTag)
    this.subscription?.remove()
    this.subscription = null
    this.released = true
  }
}
