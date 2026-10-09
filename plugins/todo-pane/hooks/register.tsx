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
// Local date as YYYY-MM-DD (toISOString would be UTC)
export const today = () => {
  const d = new Date()
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

// Fixed strings the person sees (headings, tab titles, placeholders, toasts). Prompts to Claude stay English.
export type Lang = 'ja' | 'en' | 'zh-Hans' | 'zh-Hant' | 'ko' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ru'
export const L = {
  ja: {
    now: '## 今',
    done: (d: string) => `## やったこと（${d}）`,
    todoTitle: 'TODO',
    pinTitle: 'ピン留め',
    emptyTodo: '（TODO はまだありません）',
    emptyPin: '（ピン留めはまだありません）',
    prevDay: (d: string) => `#### 前の日（${d}）`,
    more: (n: number, path: string) => `…ほか ${n} 件（${path}）`,
    doneTitle: (d: string) => `# ${d} にやったこと`,
    session: (label: string) => `## セッション ${label}`,
    missedToast: (f: string) => `${f} が更新されていません`,
    missedStatus: (f: string) => `${f} 未更新`,
  },
  en: {
    now: '## Now',
    done: (d: string) => `## Done (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Pins',
    emptyTodo: '(No TODO yet)',
    emptyPin: '(Nothing pinned yet)',
    prevDay: (d: string) => `#### Previous day (${d})`,
    more: (n: number, path: string) => `…and ${n} more (${path})`,
    doneTitle: (d: string) => `# Done on ${d}`,
    session: (label: string) => `## Session ${label}`,
    missedToast: (f: string) => `${f} was not updated`,
    missedStatus: (f: string) => `${f} not updated`,
  },
  'zh-Hans': {
    now: '## 现在',
    done: (d: string) => `## 已完成（${d}）`,
    todoTitle: 'TODO',
    pinTitle: '固定',
    emptyTodo: '（暂无 TODO）',
    emptyPin: '（暂无固定内容）',
    prevDay: (d: string) => `#### 前一天（${d}）`,
    more: (n: number, path: string) => `…另有 ${n} 项（${path}）`,
    doneTitle: (d: string) => `# ${d} 已完成事项`,
    session: (label: string) => `## 会话 ${label}`,
    missedToast: (f: string) => `${f} 尚未更新`,
    missedStatus: (f: string) => `${f} 未更新`,
  },
  'zh-Hant': {
    now: '## 現在',
    done: (d: string) => `## 已完成（${d}）`,
    todoTitle: 'TODO',
    pinTitle: '釘選',
    emptyTodo: '（尚無 TODO）',
    emptyPin: '（尚無釘選內容）',
    prevDay: (d: string) => `#### 前一天（${d}）`,
    more: (n: number, path: string) => `…另有 ${n} 項（${path}）`,
    doneTitle: (d: string) => `# ${d} 已完成事項`,
    session: (label: string) => `## 工作階段 ${label}`,
    missedToast: (f: string) => `${f} 尚未更新`,
    missedStatus: (f: string) => `${f} 未更新`,
  },
  'ko': {
    now: '## 지금',
    done: (d: string) => `## 완료 (${d})`,
    todoTitle: 'TODO',
    pinTitle: '고정',
    emptyTodo: '(TODO가 아직 없습니다)',
    emptyPin: '(고정된 항목이 없습니다)',
    prevDay: (d: string) => `#### 전날 (${d})`,
    more: (n: number, path: string) => `…외 ${n}건 (${path})`,
    doneTitle: (d: string) => `# ${d} 완료한 일`,
    session: (label: string) => `## 세션 ${label}`,
    missedToast: (f: string) => `${f} 업데이트되지 않았습니다`,
    missedStatus: (f: string) => `${f} 업데이트 안 됨`,
  },
  'es': {
    now: '## Ahora',
    done: (d: string) => `## Hecho (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Fijados',
    emptyTodo: '(Aún no hay TODO)',
    emptyPin: '(Nada fijado todavía)',
    prevDay: (d: string) => `#### Día anterior (${d})`,
    more: (n: number, path: string) => `…y ${n} más (${path})`,
    doneTitle: (d: string) => `# Hecho el ${d}`,
    session: (label: string) => `## Sesión ${label}`,
    missedToast: (f: string) => `${f} no se ha actualizado`,
    missedStatus: (f: string) => `${f} sin actualizar`,
  },
  'fr': {
    now: '## En cours',
    done: (d: string) => `## Terminé (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Épinglés',
    emptyTodo: '(Aucun TODO pour l’instant)',
    emptyPin: '(Rien d’épinglé pour l’instant)',
    prevDay: (d: string) => `#### Jour précédent (${d})`,
    more: (n: number, path: string) => `…et ${n} de plus (${path})`,
    doneTitle: (d: string) => `# Terminé le ${d}`,
    session: (label: string) => `## Session ${label}`,
    missedToast: (f: string) => `${f} n’a pas été mis à jour`,
    missedStatus: (f: string) => `${f} non mis à jour`,
  },
  'de': {
    now: '## Jetzt',
    done: (d: string) => `## Erledigt (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Angepinnt',
    emptyTodo: '(Noch keine TODOs)',
    emptyPin: '(Noch nichts angepinnt)',
    prevDay: (d: string) => `#### Vorheriger Tag (${d})`,
    more: (n: number, path: string) => `…und ${n} weitere (${path})`,
    doneTitle: (d: string) => `# Erledigt am ${d}`,
    session: (label: string) => `## Sitzung ${label}`,
    missedToast: (f: string) => `${f} wurde nicht aktualisiert`,
    missedStatus: (f: string) => `${f} nicht aktualisiert`,
  },
  'pt': {
    now: '## Agora',
    done: (d: string) => `## Concluído (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Fixados',
    emptyTodo: '(Nenhum TODO ainda)',
    emptyPin: '(Nada fixado ainda)',
    prevDay: (d: string) => `#### Dia anterior (${d})`,
    more: (n: number, path: string) => `…e mais ${n} (${path})`,
    doneTitle: (d: string) => `# Concluído em ${d}`,
    session: (label: string) => `## Sessão ${label}`,
    missedToast: (f: string) => `${f} não foi atualizado`,
    missedStatus: (f: string) => `${f} não atualizado`,
  },
  'it': {
    now: '## Ora',
    done: (d: string) => `## Fatto (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Fissati',
    emptyTodo: '(Nessun TODO per ora)',
    emptyPin: '(Nulla di fissato per ora)',
    prevDay: (d: string) => `#### Giorno precedente (${d})`,
    more: (n: number, path: string) => `…e altri ${n} (${path})`,
    doneTitle: (d: string) => `# Fatto il ${d}`,
    session: (label: string) => `## Sessione ${label}`,
    missedToast: (f: string) => `${f} non è stato aggiornato`,
    missedStatus: (f: string) => `${f} non aggiornato`,
  },
  'ru': {
    now: '## Сейчас',
    done: (d: string) => `## Готово (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Закреплено',
    emptyTodo: '(TODO пока нет)',
    emptyPin: '(Ничего не закреплено)',
    prevDay: (d: string) => `#### Предыдущий день (${d})`,
    more: (n: number, path: string) => `…и ещё ${n} (${path})`,
    doneTitle: (d: string) => `# Сделано за ${d}`,
    session: (label: string) => `## Сессия ${label}`,
    missedToast: (f: string) => `${f} не был обновлён`,
    missedStatus: (f: string) => `${f} не обновлён`,
  },
}
// Maps Claude Code's free-text `language` setting (English or native name, or a code) to a table key; anything else is English.
// Traditional Chinese is tested before the general Chinese pattern.
const LANG_PATTERNS: [Lang, RegExp][] = [
  ['zh-Hant', /繁|traditional|^zh[-_ ]?(tw|hk|mo|hant)(?!\p{L})/iu],
  ['zh-Hans', /^(中文|简|汉)|^(chinese|simplified|zh)(?!\p{L})/iu],
  ['ja', /^(ja|japanese|日本語)/i],
  ['ko', /^(ko|korean|한국어)(?!\p{L})/iu],
  ['es', /^(es|spanish|español|espanol)(?!\p{L})/iu],
  ['fr', /^(fr|french|français|francais)(?!\p{L})/iu],
  ['de', /^(de|german|deutsch)(?!\p{L})/iu],
  ['pt', /^(pt|portuguese|português|portugues)(?!\p{L})/iu],
  ['it', /^(it|italian|italiano)(?!\p{L})/iu],
  ['ru', /^(ru|russian|русский)(?!\p{L})/iu],
]
export const langFrom = (language: unknown): Lang => {
  const s = String(language ?? '').trim()
  return LANG_PATTERNS.find(([, re]) => re.test(s))?.[0] ?? 'en'
}
// Set once in session.start; English until then.
let lang: Lang = 'en'
let langRead = false

// The done heading of any language in L, built from the table so a dated heading of the user's own
// (e.g. "## Meeting notes (2026-10-01)") is never taken for it.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const DONE_RE = new RegExp(`^(?:${[...new Set(Object.values(L).map(t => esc(t.done('\u0000')).replace('\u0000', '\\d{4}-\\d{2}-\\d{2}')))].join('|')})\\s*$`)
const LEGACY_RE = /^## 今日やったこと\s*$/

// Date changed: move the old done section (any language) out of the todo text. Pure; the caller does the I/O.
export const rollover = (text: string, today: string, lang: Lang): { text: string; archived?: { date: string; body: string } } => {
  const lines = text.split('\n')
  const i = lines.findIndex(l => DONE_RE.test(l) || LEGACY_RE.test(l))
  if (i < 0) return { text }
  if (LEGACY_RE.test(lines[i])) {
    lines[i] = L[lang].done(today)
    return { text: lines.join('\n') }
  }
  const date = lines[i].match(/\d{4}-\d{2}-\d{2}/)![0]
  if (date >= today) return { text }
  let j = i + 1
  while (j < lines.length && !lines[j].startsWith('## ')) j++
  const body = lines.slice(i + 1, j).join('\n').trim()
  const out = [...lines.slice(0, i), L[lang].done(today), '', ...lines.slice(j)].join('\n')
  return body ? { text: out, archived: { date, body } } : { text: out }
}

// New content for <dir>/todo/done/<date>.md with this session's section appended.
export const appendDone = (existing: string | undefined, date: string, sessionLabel: string, body: string, lang: Lang) => {
  const head = existing ? existing.replace(/\s+$/, '') + '\n\n' : `${L[lang].doneTitle(date)}\n\n`
  return `${head}${L[lang].session(sessionLabel)}\n\n${body}\n`
}

// True when today's done section already has a checked item; the previous day is shown only when it has none.
export const hasDoneToday = (text: string, date: string, lang: Lang) => {
  const lines = text.split('\n')
  const i = lines.indexOf(L[lang].done(date))
  if (i < 0) return false
  for (const l of lines.slice(i + 1)) {
    if (l.startsWith('## ')) break
    if (l.startsWith('- [x]')) return true
  }
  return false
}

// Last 5 "- [x]" lines of a done file, for the TODO tab (display only).
export const prevDayBlock = (date: string, fileText: string, path: string, lang: Lang) => {
  const items = fileText.split('\n').filter(l => l.startsWith('- [x]'))
  if (!items.length) return ''
  const more = items.length - 5
  const lines = items.slice(-5)
  if (more > 0) lines.push(L[lang].more(more, path))
  return `\n\n---\n\n${L[lang].prevDay(date)}\n\n${lines.join('\n')}`
}

const NOW_PANE = 'todo-pane'
const PIN_PANE = 'pin-board'

// The engine's scan needs each atom named directly where read/update use it, so the two boards are spelled out.
const nowText = atom({ plugin: 'todo-pane', key: 'text' } as const, '')
const pinText = atom({ plugin: 'todo-pane', key: 'pin' } as const, '')

// Sent to the model every turn, so the board stays current without relying on memory.
const rule = (f: string, lang: Lang) => [
  `${f} is the TODO list shown in the right-hand pane.`,
  '- Write every item as a checkbox: `- [ ] ` for open, `- [x] ` for done. Never use a plain `- ` bullet.',
  `- Before starting any work that changes files or Notion, first write it under "${L[lang].now}" in ${f}.`,
  `- When the work is done, check it and move it under "${L[lang].done(today())}"; keep remaining items in their sections.`,
  `- When the topic changes, update the "${L[lang].now}" section to match.`,
  '- Write the items in the language the user is writing in.',
].join('\n')
const ask = (f: string, off: string, lang: Lang) =>
  `The TODO file ${f} (the TODO list shown in the right-hand pane) does not exist. At the very start of this turn, before anything else, ask the user with AskUserQuestion whether to create a TODO list.\n- Yes: create ${f} with the headings "${L[lang].now}" and "${L[lang].done(today())}", and write the current task under "${L[lang].now}" as \`- [ ] \`.\n- No: create an empty file at ${off} (do not ask again this session).`
// Sent every turn too, even after a "no" to the todo list: the pin board is independent of it.
const pinRule = (f: string, lang: Lang) =>
  `When asked to "pin" something (e.g. "pin that", 「ピン留めして」), write the target (the explanation, comparison table, summary, etc. you just gave) as Markdown to ${f}, creating it if missing. This is the "${L[lang].pinTitle}" tab of this plugin's side pane, not claude.ai Artifact pinning. The user can also run the /todo-pane:pin skill. Only write it when asked; do not update it as work progresses.`
const emptyBoard = (lang: Lang) => `${L[lang].now}\n\n${L[lang].done(today())}\n`
const missedText = (f: string) =>
  `In the previous turn files or Notion were changed, but ${f} was not updated. At the start of this turn, update ${f} to the current state.`

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
  // Claude Code's `language` setting picks the fixed strings (settings can fail to read: English).
  // Read here, not only in session.start, so a hot reload that skips session.start still gets it.
  if (!langRead) {
    lang = langFrom((await $.settings.read().catch(() => undefined))?.language)
    langRead = true
  }
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

// Roll the done section over when the date changed. Runs outside Claude's tool calls and before turn.start
// snapshots `before`, so it never reads as a missed update.
// The 3s refresh and prompt.submit can both get here; one run at a time, or a section could be archived twice.
let archiving: Promise<void> | undefined
function archiveIfNeeded($: any) {
  archiving ??= rollOver($).finally(() => { archiving = undefined })
  return archiving
}
async function rollOver($: any) {
  if (!(await $.fs.exists(p.todo))) return
  const text = String(await $.fs.read(p.todo))
  const r = rollover(text, today(), lang)
  if (r.text !== text) await $.fs.write(p.todo, r.text)
  if (!r.archived) return
  const file = `${dir}/todo/done/${r.archived.date}.md`
  await $.process.run(['mkdir', '-p', `${dir}/todo/done`])
  const existing = await $.fs.read(file).then(String).catch(() => undefined)
  await $.fs.write(file, appendDone(existing, r.archived.date, base, r.archived.body, lang))
}

// Most recent earlier day's finished items, shown under the TODO tab only.
async function prevDay($: any) {
  const names: { name: string }[] = await $.fs.list(`${dir}/todo/done`).catch(() => [])
  const t = today()
  const last = names.map(n => n.name).filter(n => /^\d{4}-\d{2}-\d{2}\.md$/.test(n) && n.slice(0, 10) < t).sort().pop()
  if (!last) return ''
  const path = `${dir}/todo/done/${last}`
  return prevDayBlock(last.slice(0, 10), String(await $.fs.read(path).catch(() => '')), path, lang)
}

// What a pane command does: not open -> open it in front; open but behind another tab -> bring it forward; in front -> close.
export const paneAction = ({ isOpen, isFront }: { isOpen: boolean; isFront: boolean }): 'open' | 'front' | 'close' =>
  !isOpen ? 'open' : isFront ? 'close' : 'front'
// $.ui.open with focus raises the tab (and retitles an open one), so open and front are the same call.
const openPane = ($: any, id: string, title: string) => $.ui.open({ id, title, focus: true })
// The engine's record of this plugin's panes; isShown marks the one tab in front. An unplaced pane counts as not open.
async function stateOf($: any, id: string) {
  const pane = ((await $.ui.panes().catch(() => [])) as { id: string; isShown: boolean; isPlaced: boolean }[]).find(x => x.id === id)
  return { isOpen: !!pane?.isPlaced, isFront: !!pane?.isShown }
}

export const register: Register = (on, options) => {
  dir = dirFrom(options)
  p = pathsFor(dir, base)

  on('session.start', async ($, e, next) => {
    await sync($)
    const refresh = async () => {
      await sync($).catch(() => {})
      await archiveIfNeeded($).catch(() => {})
      const file = String(await $.fs.read(p.todo).catch(() => '')).slice(0, 9000)
      const now = file ? file + (hasDoneToday(file, today(), lang) ? '' : await prevDay($)) : file
      const pin = String(await $.fs.read(p.pin).catch(() => '')).slice(0, 9000)
      await update($, nowText, prev => (prev === now ? prev : now))
      await update($, pinText, prev => (prev === pin ? prev : pin))
      return pin
    }
    const pin = await refresh()
    // ponytail: polls every 3s; a file watch would be nicer if the API grows one
    $.clock.every(3000, () => void refresh())
    void openPane($, NOW_PANE, L[lang].todoTitle)
    // The pin board opens at start only when this session's file exists; /todo-pane-pinboard opens it later.
    if (pin) void openPane($, PIN_PANE, L[lang].pinTitle)
    // Last, and each guarded: a taken name must not stop the panes or the timer above.
    for (const [name, description] of [['todo-pane', 'Open, bring forward, or close the TODO pane'], ['todo-pane-pinboard', 'Open, bring forward, or close the pinboard pane']])
      try { await $.command.register({ name, description }) } catch (err) { $.ui.log(`command ${name} not registered: ${err}`, { to: 'debug' }) }

    return next(e)
  })

  // Attached to every prompt as context the model reads beside it (never shown, text untouched),
  // so the instruction reflects the board's state at that turn; prompt.compose is frozen after the first turn.
  on('prompt.submit', async ($, e, next) => {
    await sync($).catch(() => {})
    await archiveIfNeeded($).catch(() => {})
    const pin = pinRule(p.pin, lang)
    if (await $.fs.exists(p.off)) return next({ ...e, context: [...(e.context ?? []), pin] })
    const text = (await $.fs.exists(p.todo)) ? (missed ? `${rule(p.todo, lang)}\n${missedText(p.todo)}` : rule(p.todo, lang)) : ask(p.todo, p.off, lang)
    return next({ ...e, context: [...(e.context ?? []), text, pin] })
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
      if (missed) $.ui.toast(L[lang].missedToast(p.todo))
      $.ui.status(missed ? L[lang].missedStatus(p.todo) : undefined)
    }
    return next(e)
  })

  // Both commands: open in front / bring forward / close (see paneAction). /todo-pane opening is an explicit yes: create the board if missing and drop an earlier "no" (.off).
  on('command.run', { command: 'todo-pane' }, async $ => {
    const act = paneAction(await stateOf($, NOW_PANE))
    if (act === 'close') {
      await $.ui.close({ id: NOW_PANE })
      return { text: 'Closed.' }
    }
    if (act === 'front') {
      await openPane($, NOW_PANE, L[lang].todoTitle)
      return { text: 'Brought forward.' }
    }
    // Pick up a name set by -n / /rename first, or the file is created under the bare id and renamed 3s later.
    await sync($).catch(() => {})
    let created = false
    if (!(await $.fs.exists(p.todo))) {
      // $.fs has no mkdir or remove, so those go through the shell tools.
      await $.process.run(['mkdir', '-p', `${dir}/todo`]).catch(() => {})
      await $.fs.write(p.todo, emptyBoard(lang))
      created = true
    }
    if (await $.fs.exists(p.off)) await $.process.run(['rm', '-f', p.off]).catch(() => {})
    if (created) await update($, nowText, () => emptyBoard(lang))
    await openPane($, NOW_PANE, L[lang].todoTitle)
    return { text: created ? `Created ${p.todo} and opened.` : 'Opened.' }
  })

  on('command.run', { command: 'todo-pane-pinboard' }, async $ => {
    const act = paneAction(await stateOf($, PIN_PANE))
    if (act === 'close') {
      await $.ui.close({ id: PIN_PANE })
      return { text: 'Closed.' }
    }
    await openPane($, PIN_PANE, L[lang].pinTitle)
    return { text: act === 'front' ? 'Brought forward.' : 'Opened.' }
  })

  // The pin skill: tell it the concrete file and show the pins pane.
  on('skill.prompt', async ($, e, next) => {
    const r = await next(e)
    if (e.skill !== 'todo-pane:pin' || !r || !('text' in r)) return r
    await sync($).catch(() => {})
    if (!(await stateOf($, PIN_PANE)).isOpen) await openPane($, PIN_PANE, L[lang].pinTitle).catch(() => {})
    return { text: `${r.text}\n\nPin file for this session: ${p.pin} (create it if missing).` }
  })

  on('ui.render', { component: 'Pane', requestId: NOW_PANE }, async ($, e) => {
    const { Box, Markdown } = $.ui.resolve(e)
    const body = await read($, nowText)
    return (
      <Box flexDirection="column">
        <Markdown text={body || L[lang].emptyTodo} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PIN_PANE }, async ($, e) => {
    const { Box, Markdown } = $.ui.resolve(e)
    const body = await read($, pinText)
    return (
      <Box flexDirection="column">
        <Markdown text={body || L[lang].emptyPin} />
      </Box>
    )
  })
}
