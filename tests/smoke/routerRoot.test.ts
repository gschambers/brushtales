import { existsSync } from 'node:fs'
import path from 'node:path'

describe('Expo Router directory layout', () => {
  it('does not treat src/app as a route directory', () => {
    expect(existsSync(path.resolve(__dirname, '../../src/app'))).toBe(false)
  })
})
