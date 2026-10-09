import { test, expect } from 'claude-code/testing'
import { isWrite, baseName, sanitize, pathsFor, lastTitle, hasDoneToday } from './register'

const NOW = '.claude/todo/a-123456.md'
const OFF = '.claude/todo/a-123456.off'
const w = (tool: string, path: string) => isWrite(tool, path, NOW, OFF)

test('counts file and Notion writes, but not the board itself or reads', () => {
  expect(w('Write', '/x/out/report.md')).toBe(true)
  expect(w('Edit', '/x/.claude/todo/a-123456.md')).toBe(false)
  expect(w('Write', '/x/.claude/todo/a-123456.off')).toBe(false)
  expect(w('mcp__claude_ai_Notion__notion-update-page', '')).toBe(true)
  expect(w('mcp__claude_ai_Notion__notion-fetch', '')).toBe(false)
  expect(w('Read', '/x/a.md')).toBe(false)
})

test('base: name + 6 chars of id, or 8 chars of id; separators and controls become _', () => {
  const id = '0123456789abcdef'
  expect(baseName('設計 🚀', id)).toBe('設計 🚀-012345')
  expect(baseName(undefined, id)).toBe('01234567')
  expect(baseName('', id)).toBe('01234567')
  expect(sanitize('a/b\\c:d\ne')).toBe('a_b_c_d_e')
  expect(pathsFor('out', 'x')).toMatchObject({ todo: 'out/todo/x.md', pin: 'out/pin/x.md', off: 'out/todo/x.off' })
})

test('lastTitle picks the latest custom-title line', () => {
  const t = [
    '{"type":"user"}',
    '{"type":"custom-title","customTitle":"old","sessionId":"s"}',
    '{"type":"custom-title","customTitle":"new","sessionId":"s"}',
    'garbage "custom-title"',
  ].join('\n')
  expect(lastTitle(t)).toBe('new')
  expect(lastTitle('{"type":"user"}')).toBeUndefined()
})

// Answers session.id, process.run (transcript tail) and fs.exists from a set of files; returns the context the model gets.
const contextWith = async ($: any, on: any, files: string[], title = 'foo') => {
  on('session.id', async () => ({ value: '0123456789abcdef' }) as any)
  on('process.run', async () => ({ value: { exitCode: 0, stdout: `{"type":"custom-title","customTitle":"${title}"}\n`, stderr: '' } }) as any)
  on('fs.exists', async (_$: any, e: { path: string }) => ({ value: files.some(f => e.path.endsWith(f)) }) as any)
  let seen: readonly string[] | undefined
  on('prompt.submit', async (_$: any, e: any) => { seen = e.context; return { text: e.text } })
  await $.prompt.submit({ text: 'hi' })
  return seen ?? []
}

test('submit: own board present gives the rule', async ($, on) => {
  const [s] = await contextWith($, on, ['.claude/todo/foo-012345.md'])
  expect(s).toMatch(/TODO list/)
  expect(s).not.toMatch(/AskUserQuestion/)
})

test('submit: a board of another session does not stop the question', async ($, on) => {
  const [s] = await contextWith($, on, ['.claude/todo/other-aaaaaa.md', '.claude/todo/other-aaaaaa.off'])
  expect(s).toMatch(/AskUserQuestion/)
  expect(s).toContain('.claude/todo/foo-012345.md')
})

test('submit: nothing yet asks the person', async ($, on) => {
  const [s] = await contextWith($, on, [])
  expect(s).toMatch(/AskUserQuestion/)
  expect(s).toContain('.claude/todo/foo-012345.off')
})

test('submit: own off marker leaves only the pin rule', async ($, on) => {
  const c = await contextWith($, on, ['.claude/todo/foo-012345.off'])
  expect(c.length).toBe(1)
  expect(c[0]).toContain('.claude/pin/foo-012345.md')
})

test('previous day is hidden once today has a checked item', () => {
  const d = '2026-10-09'
  const head = `## 今\n- [ ] a\n\n## やったこと（${d}）\n`
  expect(hasDoneToday(head, d, 'ja')).toBe(false)
  expect(hasDoneToday(head + '- [x] done\n', d, 'ja')).toBe(true)
  expect(hasDoneToday(`## やったこと（2026-10-08）\n- [x] old\n`, d, 'ja')).toBe(false)
  expect(hasDoneToday(head + '\n## 次\n- [x] elsewhere\n', d, 'ja')).toBe(false)
})
