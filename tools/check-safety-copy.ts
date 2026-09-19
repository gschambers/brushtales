import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const files = [
  'app/index.tsx',
  'app/stories.tsx',
  'app/session/[storyId].tsx',
  'app/complete/[sessionId].tsx',
  'content/scripts/sky-reef.md',
]
const forbidden = [
  /\bfailed\b/i,
  /\bfailure\b/i,
  /\bdirty\b/i,
  /\bplaque\b/i,
  /\bcavities?\b/i,
  /\bgum disease\b/i,
  /\btooth decay\b/i,
  /\bdiagnos(?:e|is|tic)\b/i,
]

const violations: string[] = []
for (const file of files) {
  const content = readFileSync(join(process.cwd(), file), 'utf8')
  for (const pattern of forbidden) {
    if (pattern.test(content)) violations.push(`${file}: ${pattern}`)
  }
}

if (violations.length > 0) {
  console.error(`Unsafe child-facing copy found:\n${violations.join('\n')}`)
  process.exitCode = 1
} else {
  console.log('Child-facing safety copy check passed')
}
