import { validateStoryFile } from '../../tools/validate-story'

describe('checked-in story content', () => {
  it('validates the Sky Reef graph', () => {
    expect(() => validateStoryFile()).not.toThrow()
  })
})
