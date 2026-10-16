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
    empty: '（なし）',
    older: (path: string) => `それより前: ${path}`,
    more: (n: number, path: string) => `…ほか ${n} 件（${path}）`,
    doneTitle: (d: string) => `# ${d} にやったこと`,
    session: (label: string) => `## セッション ${label}`,
    missedToast: (f: string) => `${f} が更新されていません。次の発言のときに Claude が直すので、操作は不要です`,
    missedStatus: (f: string) => `${f} 未更新（次の発言で Claude が直します）`,
  },
  en: {
    now: '## Now',
    done: (d: string) => `## Done (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Pins',
    emptyTodo: '(No TODO yet)',
    emptyPin: '(Nothing pinned yet)',
    empty: '(none)',
    older: (path: string) => `Earlier: ${path}`,
    more: (n: number, path: string) => `…and ${n} more (${path})`,
    doneTitle: (d: string) => `# Done on ${d}`,
    session: (label: string) => `## Session ${label}`,
    missedToast: (f: string) => `${f} was not updated. Claude will update it on your next message; nothing to do.`,
    missedStatus: (f: string) => `${f} not updated (Claude updates it on your next message)`,
  },
  'zh-Hans': {
    now: '## 现在',
    done: (d: string) => `## 已完成（${d}）`,
    todoTitle: 'TODO',
    pinTitle: '固定',
    emptyTodo: '（暂无 TODO）',
    emptyPin: '（暂无固定内容）',
    empty: '（无）',
    older: (path: string) => `更早: ${path}`,
    more: (n: number, path: string) => `…另有 ${n} 项（${path}）`,
    doneTitle: (d: string) => `# ${d} 已完成事项`,
    session: (label: string) => `## 会话 ${label}`,
    missedToast: (f: string) => `${f} 尚未更新。Claude 会在你下一条消息时更新，无需任何操作`,
    missedStatus: (f: string) => `${f} 未更新（Claude 将在你下次发言时更新）`,
  },
  'zh-Hant': {
    now: '## 現在',
    done: (d: string) => `## 已完成（${d}）`,
    todoTitle: 'TODO',
    pinTitle: '釘選',
    emptyTodo: '（尚無 TODO）',
    emptyPin: '（尚無釘選內容）',
    empty: '（無）',
    older: (path: string) => `更早: ${path}`,
    more: (n: number, path: string) => `…另有 ${n} 項（${path}）`,
    doneTitle: (d: string) => `# ${d} 已完成事項`,
    session: (label: string) => `## 工作階段 ${label}`,
    missedToast: (f: string) => `${f} 尚未更新。Claude 會在你下一則訊息時更新，無需任何操作`,
    missedStatus: (f: string) => `${f} 未更新（Claude 會在你下次發言時更新）`,
  },
  'ko': {
    now: '## 지금',
    done: (d: string) => `## 완료 (${d})`,
    todoTitle: 'TODO',
    pinTitle: '고정',
    emptyTodo: '(TODO가 아직 없습니다)',
    emptyPin: '(고정된 항목이 없습니다)',
    empty: '(없음)',
    older: (path: string) => `이전: ${path}`,
    more: (n: number, path: string) => `…외 ${n}건 (${path})`,
    doneTitle: (d: string) => `# ${d} 완료한 일`,
    session: (label: string) => `## 세션 ${label}`,
    missedToast: (f: string) => `${f} 업데이트되지 않았습니다. 다음 메시지를 보내면 Claude가 업데이트하므로 별도 조치는 필요 없습니다`,
    missedStatus: (f: string) => `${f} 업데이트 안 됨 (다음 메시지에서 Claude가 업데이트)`,
  },
  'es': {
    now: '## Ahora',
    done: (d: string) => `## Hecho (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Fijados',
    emptyTodo: '(Aún no hay TODO)',
    emptyPin: '(Nada fijado todavía)',
    empty: '(nada)',
    older: (path: string) => `Anteriores: ${path}`,
    more: (n: number, path: string) => `…y ${n} más (${path})`,
    doneTitle: (d: string) => `# Hecho el ${d}`,
    session: (label: string) => `## Sesión ${label}`,
    missedToast: (f: string) => `${f} no se ha actualizado. Claude lo actualizará en tu próximo mensaje; no tienes que hacer nada.`,
    missedStatus: (f: string) => `${f} sin actualizar (Claude lo actualiza en tu próximo mensaje)`,
  },
  'fr': {
    now: '## En cours',
    done: (d: string) => `## Terminé (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Épinglés',
    emptyTodo: '(Aucun TODO pour l’instant)',
    emptyPin: '(Rien d’épinglé pour l’instant)',
    empty: '(rien)',
    older: (path: string) => `Plus ancien : ${path}`,
    more: (n: number, path: string) => `…et ${n} de plus (${path})`,
    doneTitle: (d: string) => `# Terminé le ${d}`,
    session: (label: string) => `## Session ${label}`,
    missedToast: (f: string) => `${f} n’a pas été mis à jour. Claude le mettra à jour à votre prochain message ; rien à faire.`,
    missedStatus: (f: string) => `${f} non mis à jour (Claude le met à jour au prochain message)`,
  },
  'de': {
    now: '## Jetzt',
    done: (d: string) => `## Erledigt (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Angepinnt',
    emptyTodo: '(Noch keine TODOs)',
    emptyPin: '(Noch nichts angepinnt)',
    empty: '(nichts)',
    older: (path: string) => `Früher: ${path}`,
    more: (n: number, path: string) => `…und ${n} weitere (${path})`,
    doneTitle: (d: string) => `# Erledigt am ${d}`,
    session: (label: string) => `## Sitzung ${label}`,
    missedToast: (f: string) => `${f} wurde nicht aktualisiert. Claude aktualisiert es bei deiner nächsten Nachricht; du musst nichts tun.`,
    missedStatus: (f: string) => `${f} nicht aktualisiert (Claude aktualisiert es bei deiner nächsten Nachricht)`,
  },
  'pt': {
    now: '## Agora',
    done: (d: string) => `## Concluído (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Fixados',
    emptyTodo: '(Nenhum TODO ainda)',
    emptyPin: '(Nada fixado ainda)',
    empty: '(nada)',
    older: (path: string) => `Anteriores: ${path}`,
    more: (n: number, path: string) => `…e mais ${n} (${path})`,
    doneTitle: (d: string) => `# Concluído em ${d}`,
    session: (label: string) => `## Sessão ${label}`,
    missedToast: (f: string) => `${f} não foi atualizado. O Claude atualizará na sua próxima mensagem; nada a fazer.`,
    missedStatus: (f: string) => `${f} não atualizado (o Claude atualiza na sua próxima mensagem)`,
  },
  'it': {
    now: '## Ora',
    done: (d: string) => `## Fatto (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Fissati',
    emptyTodo: '(Nessun TODO per ora)',
    emptyPin: '(Nulla di fissato per ora)',
    empty: '(niente)',
    older: (path: string) => `Precedenti: ${path}`,
    more: (n: number, path: string) => `…e altri ${n} (${path})`,
    doneTitle: (d: string) => `# Fatto il ${d}`,
    session: (label: string) => `## Sessione ${label}`,
    missedToast: (f: string) => `${f} non è stato aggiornato. Claude lo aggiornerà al tuo prossimo messaggio; non devi fare nulla.`,
    missedStatus: (f: string) => `${f} non aggiornato (Claude lo aggiorna al tuo prossimo messaggio)`,
  },
  'ru': {
    now: '## Сейчас',
    done: (d: string) => `## Готово (${d})`,
    todoTitle: 'TODO',
    pinTitle: 'Закреплено',
    emptyTodo: '(TODO пока нет)',
    emptyPin: '(Ничего не закреплено)',
    empty: '(нет)',
    older: (path: string) => `Ранее: ${path}`,
    more: (n: number, path: string) => `…и ещё ${n} (${path})`,
    doneTitle: (d: string) => `# Сделано за ${d}`,
    session: (label: string) => `## Сессия ${label}`,
    missedToast: (f: string) => `${f} не был обновлён. Claude обновит его при вашем следующем сообщении; ничего делать не нужно.`,
    missedStatus: (f: string) => `${f} не обновлён (Claude обновит при следующем сообщении)`,
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
// The session heading of any language in L, with the label captured.
const SESSION_RE = new RegExp(`^(?:${[...new Set(Object.values(L).map(t => esc(t.session('\u0000')).replace('\u0000', '(.+?)')))].join('|')})\\s*$`)
const LEGACY_RE = /^## 今日やったこと\s*$/

// Date changed: move every earlier done section (any language) out of the todo text, each with its body (up to the
// next "## " heading or "---" rule). Today's heading is kept, or made from the first earlier one. Pure; the caller does the I/O.
const RULE_RE = /^---+\s*$/
const dateOf = (l: string) => l.match(/\d{4}-\d{2}-\d{2}/)![0]
export const rollover = (text: string, today: string, lang: Lang): { text: string; archived: { date: string; body: string }[] } => {
  const lines = text.split('\n')
  const first = lines.findIndex(l => DONE_RE.test(l) || LEGACY_RE.test(l))
  if (first < 0) return { text, archived: [] }
  if (LEGACY_RE.test(lines[first])) {
    lines[first] = L[lang].done(today)
    return { text: lines.join('\n'), archived: [] }
  }
  let hasToday = lines.some(l => DONE_RE.test(l) && dateOf(l) === today)
  const archived: { date: string; body: string }[] = []
  const out: string[] = []
  let changed = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!DONE_RE.test(l) || dateOf(l) >= today) {
      out.push(l)
      continue
    }
    let j = i + 1
    while (j < lines.length && !lines[j].startsWith('## ') && !RULE_RE.test(lines[j])) j++
    const body = lines.slice(i + 1, j).join('\n').trim()
    if (body) archived.push({ date: dateOf(l), body })
    if (!hasToday) {
      out.push(L[lang].done(today), '')
      hasToday = true
    }
    changed = true
    i = j - 1
  }
  if (!changed) return { text, archived }
  // Tidy what the removal left: rules that now follow another rule, runs of blank lines, and the tail of the file.
  const tidy: string[] = []
  let fence = false
  let lastText = ''
  for (const l of out) {
    if (/^(```|~~~)/.test(l.trimStart())) fence = !fence
    if (!fence && RULE_RE.test(l) && RULE_RE.test(lastText)) continue
    if (!fence && !l.trim() && tidy.length && !tidy[tidy.length - 1].trim()) continue
    tidy.push(l)
    if (l.trim()) lastText = l
  }
  while (tidy.length && (!tidy[tidy.length - 1].trim() || RULE_RE.test(tidy[tidy.length - 1]))) tidy.pop()
  return { text: tidy.join('\n') + (text.endsWith('\n') ? '\n' : ''), archived }
}

// New content for <dir>/todo/done/<date>.md with this session's section appended.
export const appendDone = (existing: string | undefined, date: string, sessionLabel: string, body: string, lang: Lang) => {
  const head = existing ? existing.replace(/\s+$/, '') + '\n\n' : `${L[lang].doneTitle(date)}\n\n`
  return `${head}${L[lang].session(sessionLabel)}\n\n${body}\n`
}

// Lines of `body` that are checkbox items already present verbatim in `existing` are dropped (a done file is
// shared by sessions and can be archived into more than once).
export const dropExisting = (existing: string | undefined, body: string) => {
  const have = new Set((existing ?? '').split('\n').filter(l => ITEM_RE.test(l)))
  return body.split('\n').filter(l => !(ITEM_RE.test(l) && have.has(l))).join('\n').trim()
}
const ITEM_RE = /^\s*- \[[ xX]\]/

// The "- [x]" lines in this session's sections of a done file, in file order. A section is a session heading whose label
// is this session's (by id, so a rename still matches) up to the next "## " heading.
export const sessionItems = (text: string, id: string): string[] => {
  const mine = (label: string) => label === id.slice(0, 8) || label.endsWith('-' + id.slice(0, 6))
  const items: string[] = []
  let on = false
  for (const l of text.split('\n')) {
    if (l.startsWith('## ')) {
      const m = l.match(SESSION_RE)
      on = !!m && mine((m.slice(1).find(Boolean) ?? '').trim())
    } else if (on && l.startsWith('- [x]')) items.push(l)
  }
  return items
}

// An earlier day with a done file: its "- [x]" lines in file order, and where the file is.
export type PastDay = { date: string; items: string[]; path: string }

// Rows `text` takes in the pane: one per line when cut, wrapped lines take more.
// ponytail: wrap mode estimates ceil(width / columns) per line; word wrapping and Markdown padding can take a row more.
export const rowsOf = (text: string, cols: number, wrap: boolean): number => {
  // ponytail: tables are drawn by layoutTable, so they count their drawn height; the heading-before-table blank row is not counted.
  if (cols > 0 && text.includes('|')) {
    const parts = splitTables(text)
    if (parts.some(p => 'table' in p))
      return parts.reduce((n, p) => n + ('table' in p ? layoutTable(p.table, cols).length : rowsOf(p.text, cols, wrap)), 0)
  }
  const lines = text.split('\n')
  // The Markdown element adds a blank row under a heading that has no blank line after it.
  return lines.reduce((n, l, i) => n + (wrap && cols > 0 ? Math.max(1, Math.ceil(displayWidth(l) / cols)) : 1) +
    (/^#{1,6}\s/.test(l) && lines[i + 1]?.trim() ? 1 : 0), 0)
}

// Display only: the earlier days' finished items under the TODO tab, appended after the todo text (`usedRows` rows).
// `days` are newest first (at most 3), `hasOlder` says more done files exist. The newest is always shown whole; the next
// ones only while `bodyRows` leaves room (then the last items that fit, plus the "more" line). A line points to the folder
// when anything earlier is not fully shown. Without a usable `bodyRows` only the newest day is shown.
export const pastDaysBlock = (days: PastDay[], hasOlder: boolean, olderPath: string, usedRows: number, bodyRows: number, cols: number, wrap: boolean, lang: Lang) => {
  if (!days.length) return ''
  const sect = (d: PastDay, items: string[], more = 0) =>
    [L[lang].done(d.date).replace(/^## /, '#### '), '', ...items, ...(more ? [L[lang].more(more, d.path)] : [])].join('\n')
  const tail = (s: string, left: boolean) => (left ? `${s}\n\n${L[lang].older(olderPath)}` : s)
  // The block starts on the todo text's last row.
  const rows = (s: string) => usedRows + rowsOf(s, cols, wrap) - 1
  let out = '\n\n---\n\n' + sect(days[0], days[0].items)
  if (!(bodyRows > 0)) return tail(out, days.length > 1 || hasOlder)
  for (let i = 1; i < days.length; i++) {
    const d = days[i]
    const full = `${out}\n\n${sect(d, d.items)}`
    if (rows(tail(full, i < days.length - 1 || hasOlder)) <= bodyRows) {
      out = full
      continue
    }
    const part = (k: number) => `${out}\n\n${sect(d, d.items.slice(-k), d.items.length - k)}`
    let k = d.items.length - 1
    while (k >= 1 && rows(tail(part(k), true)) > bodyRows) k--
    return tail(k >= 1 ? part(k) : out, true)
  }
  return tail(out, hasOlder)
}

// Display width of one code point: East Asian Wide/Fullwidth and emoji take 2 columns, the rest 1.
// ponytail: range table, not full Unicode width data; combining marks and ambiguous-width characters count as 1.
const isWide = (c: number) =>
  (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0x303e) || (c >= 0x3041 && c <= 0x33ff) ||
  (c >= 0x3400 && c <= 0x4dbf) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xa000 && c <= 0xa4cf) ||
  (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) ||
  (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x1f300 && c <= 0x1faff) ||
  (c >= 0x20000 && c <= 0x3fffd)
// Splits `s` into drawn units with their widths; a VS16 or skin tone joins the character before it as one 2-column unit.
// ponytail: ZWJ sequences still count per part.
const units = (s: string) => {
  const out: [string, number][] = []
  for (const ch of s) {
    const c = ch.codePointAt(0)!
    const last = out[out.length - 1]
    if (last && (c === 0xfe0f || (c >= 0x1f3fb && c <= 0x1f3ff))) {
      last[0] += ch
      last[1] = 2
    } else out.push([ch, isWide(c) || /\p{Emoji_Presentation}/u.test(ch) ? 2 : 1])
  }
  return out
}
export const displayWidth = (s: string) => units(s).reduce((w, [, cw]) => w + cw, 0)

// An emoji that defaults to text style with a skin tone (✍🏻) is counted 4 columns by the Markdown table and fewer
// by the terminal, which breaks the row. Display only: the tone becomes VS16 (✍️), which both draw 2 columns wide.
export const fixSkinTone = (s: string) =>
  s.replace(/(\p{Extended_Pictographic})(?<!\p{Emoji_Presentation})\uFE0F?[\u{1F3FB}-\u{1F3FF}]/gu, '$1\uFE0F')
const LIST_RE = /^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/
const HEADING_RE = /^(#{1,6}\s+)/
const MARGIN = 2

// Cuts `s` to at most `budget` display columns, ending with "…" (so budget-1 columns of text).
const cutTo = (s: string, budget: number) => {
  let cut = ''
  let w = 0
  for (const [ch, cw] of units(s)) {
    if (w + cw > budget - 1) break
    cut += ch
    w += cw
  }
  // No half-open link, code span, bold or strikethrough: each would be drawn as raw marks.
  const lb = cut.lastIndexOf('[')
  if (lb >= 0 && !/\]\([^)]*\)/.test(cut.slice(lb))) cut = cut.slice(0, lb)
  for (const m of ['`', '**', '~~'])
    if (cut.split(m).length % 2 === 0) cut = cut.slice(0, cut.lastIndexOf(m))
  return cut.replace(/\\$/, '') + '…'
}

// Splits a table row into trimmed cells on unescaped "|"; a "|" inside a backtick span stays in its cell.
// ponytail: GFM itself splits inside code spans unless the pipe is escaped; we keep the span whole instead.
const splitRow = (line: string): string[] => {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  let code = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '\\' && i + 1 < t.length) {
      cur += c + t[++i]
      continue
    }
    if (c === '`') code = !code
    if (c === '|' && !code) {
      cells.push(cur.trim())
      cur = ''
    } else cur += c
  }
  cells.push(cur.trim())
  return cells
}
const isDelimiter = (cells: string[]) => cells.length > 0 && cells.every(c => /^:?-+:?$/.test(c))

// Rendered width is sum(column widths) + 3 per column + 1 ("│ a │ b │"), kept MARGIN columns short of the pane.
const TABLE_MIN = 3

// Column widths for `rows` (row 0 header, row 1 the delimiter row, ignored) so the table fits `columns`:
// the widest column loses a column at a time, down to its minimum.
export const tableWidths = (rows: string[][], columns: number): number[] => {
  const n = Math.max(...rows.map(r => r.length))
  const widths = Array.from({ length: n }, (_, i) =>
    Math.max(1, ...rows.map((r, k) => (k === 1 ? 1 : displayWidth(r[i] ?? '')))))
  const mins = widths.map((_, i) => Math.min(TABLE_MIN, displayWidth(rows[0][i] ?? '') || 1))
  const total = () => widths.reduce((a, b) => a + b, 0) + 3 * n + 1
  const avail = columns - MARGIN
  while (total() > avail) {
    let k = -1
    for (let i = 0; i < n; i++) if (widths[i] > mins[i] && (k < 0 || widths[i] > widths[k])) k = i
    if (k < 0) break
    widths[k]--
  }
  return widths
}

// Shrinks a GFM table (header, delimiter row, body rows) so it fits `columns`: columns shrink by tableWidths,
// then cells wider than their column are cut with "…". Not a table (no valid delimiter row): unchanged.
export const fitTable = (lines: string[], columns: number): string[] => {
  if (lines.length < 2) return lines
  const rows = lines.map(splitRow)
  if (!isDelimiter(rows[1])) return lines
  const widths = tableWidths(rows, columns)
  return rows.map((r, k) => {
    if (k === 1) return lines[1]
    const cells = r.map((c, i) => (displayWidth(c) > widths[i] ? cutTo(c, widths[i]) : c))
    return `| ${cells.join(' | ')} |`
  })
}

// A drawn piece of a table cell or border: plain text plus the marks it carries.
export type Span = { text: string; bold?: boolean; code?: boolean; strike?: boolean }

// Cell source to spans: `code`, **bold**, ~~strike~~, [text](url) -> text, "\\|" -> "|"; other marks stay as typed.
// ponytail: no nesting (bold inside a link, code inside bold are drawn flat); one mark per span.
export const parseSpans = (cell: string): Span[] => {
  const out: Span[] = []
  const re = /`([^`]+)`|\*\*(.+?)\*\*|~~(.+?)~~|\[([^\]]+)\]\([^)]*\)/g
  const plain = (t: string) => t && out.push({ text: t.replace(/\\\|/g, '|') })
  let at = 0
  for (const m of cell.matchAll(re)) {
    plain(cell.slice(at, m.index))
    if (m[1] !== undefined) out.push({ text: m[1], code: true })
    else if (m[2] !== undefined) out.push({ text: m[2], bold: true })
    else if (m[3] !== undefined) out.push({ text: m[3], strike: true })
    else plain(m[4])
    at = m.index! + m[0].length
  }
  plain(cell.slice(at))
  return out
}
const plainOf = (spans: Span[]) => spans.map(s => s.text).join('')

// Wraps spans to lines of at most `width` display columns. Breaks at the last space when there is one, else at any unit.
export const wrapSpans = (spans: Span[], width: number): Span[][] => {
  type U = { ch: string; cw: number; sp: Span }
  const us: U[] = spans.flatMap(sp => units(sp.text).map(([ch, cw]) => ({ ch, cw, sp })))
  const lines: U[][] = []
  let cur: U[] = []
  let w = 0
  for (const u of us) {
    if (w + u.cw > width && cur.length) {
      const sp = cur.map(x => x.ch).lastIndexOf(' ')
      if (sp > 0) {
        lines.push(cur.slice(0, sp))
        cur = cur.slice(sp + 1)
      } else {
        lines.push(cur)
        cur = []
      }
      w = cur.reduce((a, x) => a + x.cw, 0)
    }
    cur.push(u)
    w += u.cw
  }
  lines.push(cur)
  return lines.map(l => {
    const out: Span[] = []
    for (const u of l) {
      const last = out[out.length - 1]
      if (last && last.bold === u.sp.bold && last.code === u.sp.code && last.strike === u.sp.strike) last.text += u.ch
      else out.push({ ...u.sp, text: u.ch })
    }
    return out
  })
}

// Lays out a GFM table (header, delimiter row, rows) in `columns`: box-drawing lines, each a list of spans.
// Cells wrap inside their column; a header is bold and centered, body cells follow the delimiter row's alignment.
export const layoutTable = (lines: string[], columns: number): Span[][] => {
  const rows = lines.map(splitRow)
  const cells = rows.map((r, k) => (k === 1 ? r : r.map(c => parseSpans(c))))
  const drawn = rows.map((r, k) => (k === 1 ? r : (cells[k] as Span[][]).map(plainOf)))
  const widths = tableWidths(drawn, columns)
  const n = widths.length
  const align = Array.from({ length: n }, (_, i) => {
    const d = rows[1][i] ?? ''
    return d.startsWith(':') && d.endsWith(':') ? 'c' : d.endsWith(':') ? 'r' : 'l'
  })
  const border = (l: string, m: string, r: string): Span[] => [{ text: l + widths.map(x => '─'.repeat(x + 2)).join(m) + r }]
  const out: Span[][] = [border('┌', '┬', '┐')]
  rows.forEach((_, k) => {
    if (k === 1) return
    const wrapped = Array.from({ length: n }, (_, i) => wrapSpans((cells[k] as Span[][])[i] ?? [], widths[i]))
    const h = Math.max(...wrapped.map(c => c.length))
    for (let j = 0; j < h; j++) {
      const line: Span[] = [{ text: '│' }]
      wrapped.forEach((c, i) => {
        const sp = (c[j] ?? []).map(s => (k === 0 ? { ...s, bold: true } : s))
        const gap = widths[i] - displayWidth(plainOf(sp))
        const a = k === 0 ? 'c' : align[i]
        const left = a === 'c' ? Math.floor(gap / 2) : a === 'r' ? gap : 0
        line.push({ text: ' ' + ' '.repeat(left) }, ...sp, { text: ' '.repeat(gap - left) + ' │' })
      })
      out.push(line)
    }
    out.push(border(...(k === rows.length - 1 ? ['└', '┴', '┘'] : ['├', '┼', '┤']) as [string, string, string]))
  })
  return out
}

// Splits Markdown into text pieces and GFM tables (lines starting with "|" whose 2nd line is a delimiter row).
// Fenced code is never a table.
export const splitTables = (markdown: string): ({ text: string } | { table: string[] })[] => {
  const lines = markdown.split('\n')
  const out: ({ text: string } | { table: string[] })[] = []
  let buf: string[] = []
  let fence = false
  const flush = () => {
    if (buf.length) out.push({ text: buf.join('\n') })
    buf = []
  }
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trimStart()
    if (/^(```|~~~)/.test(t)) fence = !fence
    if (!fence && t.startsWith('|') && lines[i + 1]?.trimStart().startsWith('|') && isDelimiter(splitRow(lines[i + 1]))) {
      let j = i
      while (j < lines.length && lines[j].trimStart().startsWith('|')) j++
      flush()
      out.push({ table: lines.slice(i, j) })
      i = j - 1
    } else buf.push(lines[i])
  }
  flush()
  return out
}

// Cuts each over-long line to `columns` display columns and ends it with "…", so the Markdown element
// never wraps it. Table rows are fitted as a block by fitTable. Display only. Blank lines and fenced code are left alone.
export const truncateForWidth = (markdown: string, columns: number): string => {
  let fence = false
  const out: string[] = []
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trimStart()
    if (/^(```|~~~)/.test(t)) {
      fence = !fence
      out.push(line)
      continue
    }
    if (fence || !t) {
      out.push(line)
      continue
    }
    if (t.startsWith('|')) {
      let j = i
      while (j < lines.length && lines[j].trimStart().startsWith('|')) j++
      out.push(...fitTable(lines.slice(i, j), columns))
      i = j - 1
      continue
    }
    const list = line.match(LIST_RE)?.[1]
    const heading = list ? undefined : line.match(HEADING_RE)?.[1]
    const head = list ?? heading ?? ''
    const rest = line.slice(head.length)
    // A heading's # marks are not drawn; a list marker is drawn about as wide as its source.
    const budget = columns - MARGIN - (heading ? 0 : displayWidth(head))
    out.push(budget < 4 || displayWidth(rest) <= budget ? line : head + cutTo(rest, budget))
  }
  return out.join('\n')
}

// Display only: puts `label` (italic, the closest Markdown has to dim) under each "##" to "######" heading that has
// no content before the next heading of the same or higher level (same or fewer #), the "---" rule that starts the
// past-days block, or the end of the todo part. A heading followed by a deeper one (e.g. "###" under "##") is not
// empty. Fenced code is skipped. The todo file itself is never changed.
export const markEmptySections = (text: string, label: string): string => {
  const lines = text.split('\n')
  const out: string[] = []
  let fence = false
  let open = 0 // level of the heading that has had no content yet (0 = none)
  let mark = 0
  const close = () => {
    if (open) out.splice(mark, 0, `_${label}_`)
    open = 0
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trimStart()
    const level = fence ? 0 : (line.match(/^(#{2,6})\s/)?.[1].length ?? 0)
    if (/^(```|~~~)/.test(t)) {
      fence = !fence
      open = 0
    } else if (!fence && /^---+\s*$/.test(line)) {
      close()
      out.push(...lines.slice(i))
      return out.join('\n')
    } else if (level) {
      if (level <= open) close()
      else open = 0
      out.push(line)
      open = level
      mark = out.length
      continue
    } else if (t) open = 0
    out.push(line)
  }
  close()
  return out.join('\n')
}

// Display only: in the todo part, rewrites each "### " heading under a "## " heading to
// "### <parent>-<n>. <title>" (n restarts at each "## "), since "##" to "####" all look alike when drawn.
// Fenced code is skipped; everything from the "---" rule on is passed through unchanged.
export const numberSubsections = (text: string): string => {
  const lines = text.split('\n')
  let fence = false
  let parent = ''
  let n = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^(```|~~~)/.test(line.trimStart())) fence = !fence
    else if (fence) continue
    else if (/^---+\s*$/.test(line)) break
    else if (line.startsWith('## ')) {
      parent = line.slice(3).trim()
      n = 0
    } else if (parent && line.startsWith('### ')) lines[i] = `### ${parent}-${++n}. ${line.slice(4)}`
  }
  return lines.join('\n')
}

const NOW_PANE = 'todo-pane'
const PIN_PANE = 'pin-board'

// The engine's scan needs each atom named directly where read/update use it, so the two boards are spelled out.
const nowText = atom({ plugin: 'todo-pane', key: 'text' } as const, '')
const pinText = atom({ plugin: 'todo-pane', key: 'pin' } as const, '')
// JSON of { days: PastDay[], older: boolean }: earlier days' finished items, laid out by the render handler (it knows the rows).
const pastText = atom({ plugin: 'todo-pane', key: 'past' } as const, '')
// true: long TODO lines wrap; false (default): they are cut with "…". Saved with $.store so it outlives the session.
const wrapOn = atom({ plugin: 'todo-pane', key: 'wrap' } as const, false)
// Same for the pins pane, which defaults to wrapping.
const pinWrapOn = atom({ plugin: 'todo-pane', key: 'pinWrap' } as const, true)

// Sent to the model every turn, so the board stays current without relying on memory.
const rule = (f: string, lang: Lang) => [
  `${f} is the TODO list shown in the right-hand pane.`,
  '- Write every item as a checkbox: `- [ ] ` for open, `- [x] ` for done. Never use a plain `- ` bullet.',
  `- Before starting any work that changes files or Notion, first write it under "${L[lang].now}" in ${f}.`,
  `- When the work is done, check it and move it under "${L[lang].done(today())}"; keep remaining items in their sections.`,
  `- Only today's done heading ("${L[lang].done(today())}") belongs in ${f}; never write done headings for earlier days, the plugin moves them to the done/ folder.`,
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
  for (const a of r.archived) {
    const file = `${dir}/todo/done/${a.date}.md`
    await $.process.run(['mkdir', '-p', `${dir}/todo/done`])
    const existing = await $.fs.read(file).then(String).catch(() => undefined)
    const body = dropExisting(existing, a.body)
    if (body) await $.fs.write(file, appendDone(existing, a.date, base, body, lang))
  }
}

// The latest 3 earlier days with this session's finished items, shown under the TODO tab only (as JSON for pastText).
// Done files are newest-first scanned; a 4th matching day tells there is more (older).
async function pastDays($: any) {
  const names: { name: string }[] = await $.fs.list(`${dir}/todo/done`).catch(() => [])
  const t = today()
  const all = names.map(n => n.name).filter(n => /^\d{4}-\d{2}-\d{2}\.md$/.test(n) && n.slice(0, 10) < t).sort().reverse()
  const days: PastDay[] = []
  let older = false
  for (const n of all) {
    const path = `${dir}/todo/done/${n}`
    const items = sessionItems(String(await $.fs.read(path).catch(() => '')), sessionId)
    if (!items.length) continue
    if (days.length === 3) {
      older = true
      break
    }
    days.push({ date: n.slice(0, 10), items, path })
  }
  return JSON.stringify({ days, older })
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

// Which of this plugin's panes /todo-pane-wrap acts on: the one the dock is showing; undefined when neither is.
export const wrapTarget = (panes: readonly { id: string; isShown: boolean }[]): 'todo' | 'pin' | undefined => {
  const shown = panes.find(x => x.isShown && (x.id === NOW_PANE || x.id === PIN_PANE))?.id
  return shown === NOW_PANE ? 'todo' : shown === PIN_PANE ? 'pin' : undefined
}

// Markdown for a pane `cols` wide: tables are drawn by layoutTable, fitted to the pane (Markdown wraps them at the
// terminal width instead); the rest stays Markdown, through `cut`. Without a width it is plain Markdown.
const mdOf = ({ Box, Markdown, Text }: any, cols: number, cut: (x: string) => string) => (x: string, dimColor?: boolean) =>
  cols > 0
    ? splitTables(x).map((p, i) =>
        'table' in p ? (
          <Box flexDirection="column">
            {layoutTable(p.table, cols).map((l, j) => (
              <Text wrap="truncate" dimColor={dimColor}>
                {l.map((s, k) => (
                  <Text bold={s.bold} strikethrough={s.strike} color={s.code ? 'suggestion' : undefined}>{s.text}</Text>
                ))}
              </Text>
            ))}
          </Box>
        ) : (
          <Markdown dimColor={dimColor} text={cut(p.text)} />
        ))
    : <Markdown dimColor={dimColor} text={x} />

export const register: Register = (on, options) => {
  dir = dirFrom(options)
  p = pathsFor(dir, base)

  on('session.start', async ($, e, next) => {
    await sync($)
    const savedWrap = (await $.store.get('wrap').catch(() => undefined)) === true
    const savedPinWrap = (await $.store.get('pinWrap').catch(() => undefined)) !== false
    const refresh = async () => {
      await sync($).catch(() => {})
      await archiveIfNeeded($).catch(() => {})
      const file = String(await $.fs.read(p.todo).catch(() => '')).slice(0, 9000)
      const now = file
      const past = file ? await pastDays($) : ''
      const pin = String(await $.fs.read(p.pin).catch(() => '')).slice(0, 9000)
      await update($, nowText, prev => (prev === now ? prev : now))
      await update($, pastText, prev => (prev === past ? prev : past))
      await update($, pinText, prev => (prev === pin ? prev : pin))
      return pin
    }
    await update($, wrapOn, () => savedWrap)
    await update($, pinWrapOn, () => savedPinWrap)
    const pin = await refresh()
    // ponytail: polls every 3s; a file watch would be nicer if the API grows one
    $.clock.every(3000, () => void refresh())
    void openPane($, NOW_PANE, L[lang].todoTitle)
    // The pin board opens at start only when this session's file exists; /todo-pane-pinboard opens it later.
    if (pin) void openPane($, PIN_PANE, L[lang].pinTitle)
    // Last, and each guarded: a taken name must not stop the panes or the timer above. Immediate: they only open,
    // close or toggle a pane, so they run mid-turn instead of waiting for Claude to finish.
    for (const [name, description] of [['todo-pane', 'Open, bring forward, or close the TODO pane'], ['todo-pane-pinboard', 'Open, bring forward, or close the pinboard pane'], ['todo-pane-wrap', 'Toggle wrapping long lines in the pane in front']])
      try { await $.command.register({ name, description, immediate: true }) } catch (err) { $.ui.log(`command ${name} not registered: ${err}`, { to: 'debug' }) }

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

  on('command.run', { command: 'todo-pane-wrap' }, async $ => {
    const target = wrapTarget(await $.ui.panes().catch(() => []))
    if (!target) return { text: 'No todo-pane pane is shown.' }
    const v = target === 'todo' ? !(await read($, wrapOn)) : !(await read($, pinWrapOn))
    if (target === 'todo') await update($, wrapOn, () => v)
    else await update($, pinWrapOn, () => v)
    await $.store.set(target === 'todo' ? 'wrap' : 'pinWrap', v).catch(() => {})
    return { text: `${target === 'todo' ? 'TODO' : 'Pins'}: ${v ? 'wrap on.' : 'wrap off (truncate).'}` }
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
    const { Box, Markdown, Text } = $.ui.resolve(e)
    const body = fixSkinTone(await read($, nowText))
    // Width of this draw; the engine redraws when it changes. Without one, nothing is cut.
    const cols = Number((e.props as any)?.bodyColumns)
    const todo = body ? markEmptySections(numberSubsections(body), L[lang].empty) : L[lang].emptyTodo
    const wrap = await read($, wrapOn)
    // Rows of this draw; without them only the newest earlier day is shown.
    const rows = Number((e.props as any)?.scroll?.bodyRows)
    let past = { days: [] as PastDay[], older: false }
    try { past = JSON.parse((await read($, pastText)) || 'null') ?? past } catch {}
    // The block starts "\n\n---"; the blank row between the parts becomes marginTop, and the block is drawn faint.
    const block = body ? fixSkinTone(pastDaysBlock(past.days, past.older, `${dir}/todo/done/`, rowsOf(todo, cols, wrap), rows, cols, wrap, lang)) : ''
    const cut = (x: string) => (wrap || !(cols > 0) ? x : truncateForWidth(x, cols))
    const md = mdOf({ Box, Markdown, Text }, cols, cut)
    return (
      <Box flexDirection="column">
        {md(todo)}
        {block && (
          <Box marginTop={1}>
            {md(block.replace(/^\n+/, ''), true)}
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PIN_PANE }, async ($, e) => {
    const { Box, Markdown, Text } = $.ui.resolve(e)
    const body = fixSkinTone(await read($, pinText))
    const cols = Number((e.props as any)?.bodyColumns)
    const text = body || L[lang].emptyPin
    const wrap = await read($, pinWrapOn)
    const cut = (x: string) => (wrap || !(cols > 0) ? x : truncateForWidth(x, cols))
    const md = mdOf({ Box, Markdown, Text }, cols, cut)
    return (
      <Box flexDirection="column">
        {md(text)}
      </Box>
    )
  })
}
