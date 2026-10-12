import { test, expect } from 'claude-code/testing'
import { isWrite, baseName, sanitize, pathsFor, lastTitle, hasDoneToday, paneAction, truncateForWidth, displayWidth, wrapTarget, fitTable, markEmptySections } from './register'

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

test('paneAction: open, bring forward, or close', () => {
  expect(paneAction({ isOpen: false, isFront: false })).toBe('open')
  expect(paneAction({ isOpen: true, isFront: false })).toBe('front')
  expect(paneAction({ isOpen: true, isFront: true })).toBe('close')
})

test('truncateForWidth: ASCII, wide chars, lists, headings', () => {
  const long = 'x'.repeat(100)
  expect(truncateForWidth('short', 40)).toBe('short')
  const a = truncateForWidth(`- [ ] ${long}`, 40)
  expect(a.startsWith('- [ ] xxx')).toBe(true)
  expect(a.endsWith('…')).toBe(true)
  expect(displayWidth(a)).toBeLessThanOrEqual(38)
  const ja = truncateForWidth('- [x] ' + 'あ'.repeat(40), 40)
  expect(ja.endsWith('…')).toBe(true)
  expect(displayWidth(ja)).toBeLessThanOrEqual(38)
  expect(displayWidth('あa')).toBe(3)
  const h = truncateForWidth(`## ${long}`, 40)
  expect(h.startsWith('## xxx')).toBe(true)
  expect(h.endsWith('…')).toBe(true)
  expect(displayWidth(h.slice(3))).toBeLessThanOrEqual(38)
})

test('truncateForWidth: nested sub-task keeps indentation and checkbox', () => {
  const r = truncateForWidth(`  - [ ] ${'y'.repeat(100)}`, 30)
  expect(r.startsWith('  - [ ] yyy')).toBe(true)
  expect(r.endsWith('…')).toBe(true)
  expect(displayWidth(r)).toBeLessThanOrEqual(28)
})

test('truncateForWidth: code fences, non-table pipe lines and blanks are untouched', () => {
  const src = ['```', 'z'.repeat(100), '```', '| ' + 'c'.repeat(100) + ' |', '', 'w'.repeat(100)].join('\n')
  const lines = truncateForWidth(src, 40).split('\n')
  expect(lines[1]).toBe('z'.repeat(100))
  expect(lines[3]).toBe('| ' + 'c'.repeat(100) + ' |')
  expect(lines[4]).toBe('')
  expect(lines[5].endsWith('…')).toBe(true)
})

test('truncateForWidth: never leaves an open code span or link', () => {
  const code = truncateForWidth('- ' + 'a'.repeat(20) + ' `' + 'b'.repeat(50) + '` end', 40)
  expect((code.match(/`/g) ?? []).length % 2).toBe(0)
  const link = truncateForWidth('- see [' + 'doc'.repeat(20) + '](https://example.com/very/long) end', 40)
  expect(link).not.toContain('[')
  expect(link.endsWith('…')).toBe(true)
})

test('wrapTarget: the shown pane of ours decides, else nothing', () => {
  expect(wrapTarget([{ id: 'todo-pane', isShown: true }, { id: 'pin-board', isShown: false }])).toBe('todo')
  expect(wrapTarget([{ id: 'todo-pane', isShown: false }, { id: 'pin-board', isShown: true }])).toBe('pin')
  expect(wrapTarget([{ id: 'todo-pane', isShown: false }, { id: 'pin-board', isShown: false }])).toBeUndefined()
  expect(wrapTarget([])).toBeUndefined()
})

const cells = (row: string) => row.slice(2, -2).split(' | ')

test('fitTable: a table that fits is only normalized, not shortened', () => {
  const t = ['| a | b |', '|---|---|', '| 1 | 2 |']
  expect(fitTable(t, 40)).toEqual(t)
})

test('fitTable: wide ASCII table shrinks only the long column', () => {
  const t = ['| id | note |', '|---|---|', '| 1 | ' + 'n'.repeat(80) + ' |', '| 22 | ok |']
  const r = fitTable(t, 40)
  expect(r[0]).toBe('| id | note |'.replace('note', 'note'.padEnd(4)))
  expect(cells(r[2])[0]).toBe('1')
  expect(cells(r[2])[1].endsWith('…')).toBe(true)
  expect(r[3]).toBe('| 22 | ok |')
  for (const row of [r[0], r[2], r[3]]) expect(displayWidth(cells(row).join('')) + 3 * 2 + 1).toBeLessThanOrEqual(38)
  expect(r[1]).toBe('|---|---|')
})

test('fitTable: Japanese wide chars count as 2 columns', () => {
  const t = ['| 項目 | 説明 |', '|---|---|', '| a | ' + 'あ'.repeat(40) + ' |']
  const r = fitTable(t, 40)
  const c = cells(r[2])
  expect(c[1].endsWith('…')).toBe(true)
  expect(displayWidth(c[0]) + displayWidth(c[1]) + 7).toBeLessThanOrEqual(38)
})

test('fitTable: alignment colons are kept', () => {
  const t = ['| a | b | c |', '|:--|:-:|--:|', '| 1 | ' + 'x'.repeat(60) + ' | 3 |']
  expect(fitTable(t, 30)[1]).toBe('|:--|:-:|--:|')
})

test('fitTable: lines without a delimiter row are untouched', () => {
  const t = ['| ' + 'a'.repeat(80) + ' |', '| ' + 'b'.repeat(80) + ' |']
  expect(fitTable(t, 30)).toEqual(t)
  expect(truncateForWidth(t.join('\n'), 30)).toBe(t.join('\n'))
})

test('fitTable: a cut inside an inline code span leaves it balanced; a pipe inside it is not a separator', () => {
  const t = ['| k | v |', '|---|---|', '| 1 | text `' + 'c'.repeat(60) + '` more |', '| 2 | `a|b` |']
  const r = fitTable(t, 30)
  expect((r[2].match(/`/g) ?? []).length % 2).toBe(0)
  expect(r[3]).toBe('| 2 | `a|b` |')
})

test('truncateForWidth: fits tables inside text and leaves tables in code fences', () => {
  const tbl = ['| a | b |', '|---|---|', '| 1 | ' + 'z'.repeat(80) + ' |']
  const out = truncateForWidth(['intro', ...tbl, 'after'].join('\n'), 30).split('\n')
  expect(out[0]).toBe('intro')
  expect(out[3]).toContain('…')
  expect(out[4]).toBe('after')
  const fenced = ['```', ...tbl, '```'].join('\n')
  expect(truncateForWidth(fenced, 30)).toBe(fenced)
})

const E = '(none)'
const mark = (s: string) => markEmptySections(s, E)

test('markEmptySections: empty section gets the label, section with items does not', () => {
  expect(mark('## 今\n\n## 次\n\n- [ ] a\n')).toBe('## 今\n_(none)_\n\n## 次\n\n- [ ] a\n')
})

test('markEmptySections: last section empty at end of text, and consecutive empty sections', () => {
  expect(mark('## A\n## B\n\n## C')).toBe('## A\n_(none)_\n## B\n_(none)_\n\n## C\n_(none)_')
})

test('markEmptySections: blank lines only count as empty', () => {
  expect(mark('## A\n   \n\n## B\n- [x] x')).toBe('## A\n_(none)_\n   \n\n## B\n- [x] x')
})

test('markEmptySections: headings and rules inside fenced code are ignored', () => {
  const t = '## A\n\n```\n## not a heading\n---\n```\n\n## B\n- [ ] b'
  expect(mark(t)).toBe(t)
})

test('markEmptySections: previous-day block after --- is not part of the last section', () => {
  const t = '## A\n- [ ] a\n\n## B\n\n---\n\n#### Previous day (2026-10-11)\n\n- [x] y'
  expect(mark(t)).toBe('## A\n- [ ] a\n\n## B\n_(none)_\n\n---\n\n#### Previous day (2026-10-11)\n\n- [x] y')
  const u = '## A\n- [ ] a\n\n---\n\n## fake\n'
  expect(mark(u)).toBe(u)
})
