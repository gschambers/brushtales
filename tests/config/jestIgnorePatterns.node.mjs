import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const { getWorktreeIgnorePatterns } = require('../../config/jestIgnorePatterns.js')

test('does not ignore tests when Jest runs inside a worktree', () => {
  assert.deepEqual(
    getWorktreeIgnorePatterns('/projects/brushtales/.worktrees/brushtales-ux'),
    [],
  )
})

test('ignores nested worktree paths from the main checkout', () => {
  assert.deepEqual(
    getWorktreeIgnorePatterns('/projects/brushtales'),
    ['/.worktrees/'],
  )
})
