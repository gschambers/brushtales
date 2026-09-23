const path = require('node:path')

function getWorktreeIgnorePatterns(cwd = process.cwd()) {
  const pathSegments = path.resolve(cwd).split(path.sep)
  return pathSegments.includes('.worktrees') ? [] : ['/.worktrees/']
}

module.exports = { getWorktreeIgnorePatterns }
