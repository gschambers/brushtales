const { getWorktreeIgnorePatterns } = require('./config/jestIgnorePatterns')

module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.superpowers/', ...getWorktreeIgnorePatterns()],
  modulePathIgnorePatterns: ['/node_modules/', ...getWorktreeIgnorePatterns()],
}
