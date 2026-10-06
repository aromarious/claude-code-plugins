import { atom, read, update } from 'claude-code'
import type { PluginOptions, Register } from 'claude-code'

// Claude rewrites these files; each pane shows whatever its file says.
// Files live under the "dir" setting (relative to the session's working directory unless absolute):
// <dir>/todo/<base>.md, <dir>/pin/<base>.md, and the off marker <dir>/todo/<base>.off. One set per session.
const dirFrom = (options: PluginOptions) => {
  const v = options.dir
  return (typeof v === 'string' && v ? v : '.claude').replace(/\/+$/, '')
}
// Session name (control characters and path separators become _) plus the id's first 6 characters;
// without a name, the id's first 8.
export const sanitize = (name: string) => name.replace(/[\/\\:\u0000-\u001f\u007f]/g, '_')
export const baseName = (title: string | undefined, id: string) => {
  const t = title ? sanitize(title.trim()) : ''
  return t ? `${t}-${id.slice(0, 6)}` : id.slice(0, 8)
}
export const pathsFor = (dir: string, base: string) => ({
  todo: `${dir}/todo/${base}.md`,
  pin: `${dir}/pin/${base}.md`,
  off: `${dir}/todo/${base}.off`,
})
// The latest {"type":"custom-title"} line in the transcript's tail, if any
export const lastTitle = (text: string): string | undefined => {
  let title: string | undefined
  for (const line of text.split('\n')) {
    if (!line.includes('"custom-title"')) continue
    try {
      const j = JSON.parse(line)
      if (j.type === 'custom-title' && typeof j.customTitle === 'string') title = j.customTitle
    } catch {}
  }
  return title
}
const NOW_PANE = 'todo-pane'
const NOW_TITLE = 'TODO'
const PIN_PANE = 'pin-board'
const PIN_TITLE = 'ピン留め'

// The engine's scan needs each atom named directly where read/update use it, so the two boards are spelled out.
const nowText = atom({ plugin: 'todo-pane', key: 'text' } as const, '')
const pinText = atom({ plugin: 'todo-pane', key: 'pin' } as const, '')

// Sent to the model every turn, so the board stays current without relying on memory.
const rule = (f: string) => [
  `${f} は右のペインに表示される TODO リストである。`,
  '- 項目はすべてチェックボックス付きで書く。未完了は `- [ ] `、完了は `- [x] ` で始め、`- ` だけの箇条書きにしない。',
  `- ファイルや Notion を書き換える作業に取りかかるときは、書き換えより先に ${f} の「## 今」にその作業を書く。`,
  '- 作業が終わったらチェックを付けて「今日やったこと」などの欄へ移し、残っている作業は該当する欄に置く。',
  '- 話題が変わったら、そのつど「## 今」を今の状態に直す。',
].join('\n')
const ask = (f: string, off: string) =>
  `この作業ディレクトリには ${f}（右のペインに出る TODO リスト）が無い。このターンの最初に、ほかの作業より先に AskUserQuestion で「TODO リストを作るか」をユーザーに聞く。\n- 作る → ${f} を「## 今」「## 今日やったこと」の見出しで作り、今の作業を「## 今」に `- [ ] ` で書く。\n- 作らない → 空のファイル ${off} を作る（このセッションでは以後聞かない）。`
const EMPTY_BOARD = '## 今\n\n## 今日やったこと\n'
const missedText = (f: string) =>
  `前のターンでファイルか Notion を書き換えたのに、${f} が更新されていない。このターンの最初に ${f} を今の状態に直すこと。`

// Tools that change something the person would expect the board to mention.
export const isWrite = (tool: string, path: string, now: string, off: string) =>
  (['Write', 'Edit', 'NotebookEdit'].includes(tool) && !path.endsWith(now) && !path.endsWith(off)) ||
  /notion.*(update|create|patch|post|delete|move|duplicate)/i.test(tool)

// ponytail: per-session flags in module scope; a reload resets them, which only skips one check
let before: string | undefined
let wrote = false
let missed = false

let dir = '.claude'
let sessionId = ''
let base = ''
let p = pathsFor(dir, '')

// Latest custom-title from the transcript's tail (the file can exceed fs.read's 4 MiB, so tail it).
async function titleOf($: any, id: string) {
  const script = 'f=$(ls "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/projects/*/"$1".jsonl 2>/dev/null | head -1); [ -n "$f" ] && tail -n 500 "$f"'
  const r = await $.process.run(['sh', '-c', script, 'sh', id]).catch(() => undefined)
  return r ? lastTitle(String(r.stdout)) : undefined
}

// Recompute <base>; if it changed, carry the old files (todo, pin and off) to the new names.
async function sync($: any) {
  if (!sessionId) sessionId = await $.session.id()
  const next = baseName(await titleOf($, sessionId), sessionId)
  if (next === base) return
  const old = base ? pathsFor(dir, base) : undefined
  base = next
  p = pathsFor(dir, base)
  if (!old) return
  for (const k of ['todo', 'pin', 'off'] as const) {
    if (!(await $.fs.exists(old[k])) || (await $.fs.exists(p[k]))) continue
    await $.fs.write(p[k], String(await $.fs.read(old[k])))
    await $.process.run(['rm', '-f', old[k]])
  }
}

export const register: Register = (on, options) => {
  dir = dirFrom(options)
  p = pathsFor(dir, base)

  on('session.start', async ($, e, next) => {
    await sync($)
    await $.command.register({ name: 'todo', description: 'Show the todo list in a side pane' })
    await $.command.register({ name: 'pin', description: 'Show the pin board in a side pane' })
    const refresh = async () => {
      await sync($).catch(() => {})
      const now = String(await $.fs.read(p.todo).catch(() => '')).slice(0, 9000)
      const pin = String(await $.fs.read(p.pin).catch(() => '')).slice(0, 9000)
      await update($, nowText, prev => (prev === now ? prev : now))
      await update($, pinText, prev => (prev === pin ? prev : pin))
      return pin
    }
    const pin = await refresh()
    // ponytail: polls every 3s; a file watch would be nicer if the API grows one
    $.clock.every(3000, () => void refresh())
    void $.ui.open({ id: NOW_PANE, title: NOW_TITLE })
    // The pin board opens at start only when this session's file exists; /pin opens it later.
    if (pin) void $.ui.open({ id: PIN_PANE, title: PIN_TITLE })

    return next(e)
  })

  // Attached to every prompt as context the model reads beside it (never shown, text untouched),
  // so the instruction reflects the board's state at that turn; prompt.compose is frozen after the first turn.
  on('prompt.submit', async ($, e, next) => {
    await sync($).catch(() => {})
    if (await $.fs.exists(p.off)) return next(e)
    const text = (await $.fs.exists(p.todo)) ? (missed ? `${rule(p.todo)}\n${missedText(p.todo)}` : rule(p.todo)) : ask(p.todo, p.off)
    return next({ ...e, context: [...(e.context ?? []), text] })
  })

  on('turn.start', async ($, e, next) => {
    before = await $.fs.read(p.todo).then(String).catch(() => undefined)
    wrote = false
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (!e.agentId) {
      const path = 'file_path' in e ? String(e.file_path) : ''
      if (isWrite(e.tool, path, p.todo, p.off)) wrote = true
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId && !e.isAborted && before !== undefined) {
      const after = await $.fs.read(p.todo).then(String).catch(() => undefined)
      missed = wrote && after === before
      if (missed) $.ui.toast(`${p.todo} が更新されていません`)
      $.ui.status(missed ? `${p.todo} 未更新` : undefined)
    }
    return next(e)
  })

  // focus raises the tab: with both panes open, re-opening an open id alone only retitles it.
  // /todo is an explicit yes: create the board if missing and drop an earlier "no" (.off).
  on('command.run', { command: 'todo' }, async $ => {
    let created = false
    if (!(await $.fs.exists(p.todo))) {
      // $.fs has no mkdir or remove, so those go through the shell tools.
      await $.process.run(['mkdir', '-p', `${dir}/todo`]).catch(() => {})
      await $.fs.write(p.todo, EMPTY_BOARD)
      created = true
    }
    if (await $.fs.exists(p.off)) await $.process.run(['rm', '-f', p.off]).catch(() => {})
    if (created) await update($, nowText, () => EMPTY_BOARD)
    await $.ui.open({ id: NOW_PANE, title: NOW_TITLE, focus: true })
    return { text: created ? `Created ${p.todo} and opened.` : 'Opened.' }
  })

  on('command.run', { command: 'pin' }, async $ => {
    await $.ui.open({ id: PIN_PANE, title: PIN_TITLE, focus: true })
    return { text: 'Opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: NOW_PANE }, async ($, e) => {
    const { Box, Markdown } = $.ui.resolve(e)
    const body = await read($, nowText)
    return (
      <Box flexDirection="column">
        <Markdown text={body || `（TODO はまだありません）`} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PIN_PANE }, async ($, e) => {
    const { Box, Markdown } = $.ui.resolve(e)
    const body = await read($, pinText)
    return (
      <Box flexDirection="column">
        <Markdown text={body || `（ピン留めはまだありません）`} />
      </Box>
    )
  })
}
