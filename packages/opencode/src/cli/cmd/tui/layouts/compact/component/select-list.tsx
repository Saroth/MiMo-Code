import { createSignal, createMemo, createEffect, Show, For, untrack } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useTerminalDimensions } from "@opentui/solid"
import type { SeparatorRef } from "./separator"

export type SelectOption = {
  display: string
  value: string
  description?: string
}

export type SelectListRef = {
  visible: boolean
  onKeyDown: (e: any) => boolean
  show(): void
  hide(): void
  getSelected(): string | undefined
}

function strWidth(text: string): number {
  return Bun.stringWidth(text)
}

function padToWidth(text: string, targetWidth: number): string {
  const currentWidth = strWidth(text)
  if (currentWidth >= targetWidth) return text
  return text + " ".repeat(targetWidth - currentWidth)
}

function isCJK(ch: string): boolean {
  const code = ch.codePointAt(0)!
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xffef) ||
    (code >= 0x3040 && code <= 0x309f) ||
    (code >= 0x30a0 && code <= 0x30ff) ||
    (code >= 0xac00 && code <= 0xd7af)
  )
}

function tokenize(text: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (/\s/.test(ch)) {
      let spaces = ""
      while (i < text.length && /\s/.test(text[i])) {
        spaces += text[i]
        i++
      }
      tokens.push(spaces)
    } else if (isCJK(ch)) {
      tokens.push(ch)
      i++
    } else {
      let word = ""
      while (i < text.length && !/\s/.test(text[i]) && !isCJK(text[i])) {
        word += text[i]
        i++
      }
      tokens.push(word)
    }
  }
  return tokens
}

function wrapText(text: string, maxWidth: number, maxLines: number): string[] {
  if (maxWidth <= 0) return []
  const tokens = tokenize(text)
  const lines: string[] = []
  let currentLine = ""
  let currentWidth = 0

  for (const token of tokens) {
    const tokenWidth = strWidth(token)
    const isSpace = /^\s+$/.test(token)

    if (currentWidth > 0 && currentWidth + tokenWidth > maxWidth) {
      lines.push(currentLine)
      currentLine = isSpace ? "" : token
      currentWidth = isSpace ? 0 : tokenWidth
      if (lines.length >= maxLines) {
        truncateLastLine(lines, maxWidth)
        return lines
      }
    } else {
      currentLine += token
      currentWidth += tokenWidth
    }
  }

  if (currentLine.length > 0) {
    if (lines.length >= maxLines) {
      truncateLastLine(lines, maxWidth)
    } else {
      lines.push(currentLine)
    }
  }
  return lines
}

function truncateLastLine(lines: string[], maxWidth: number) {
  const lastLine = lines[lines.length - 1]
  if (strWidth(lastLine) > maxWidth - 3) {
    let truncated = ""
    let width = 0
    for (const ch of lastLine) {
      const chWidth = strWidth(ch)
      if (width + chWidth > maxWidth - 3) break
      truncated += ch
      width += chWidth
    }
    lines[lines.length - 1] = truncated + "..."
  } else {
    lines[lines.length - 1] = lastLine + "..."
  }
}

type LineSegment = {
  text: string
  type: "name" | "desc"
}

type OptionLine = {
  segments: LineSegment[]
  optionIndex: number
}

const MAX_DESC_LINES = 3
const GAP = 2

export function SelectList(props: {
  ref: (ref: SelectListRef) => void
  options: SelectOption[]
  visible: boolean
  title?: string
  emptyText?: string
  maxItems?: number
  separatorRef?: SeparatorRef
  onSelect: (option: SelectOption) => void
  onDismiss: () => void
}) {
  const { theme } = useTheme()
  const dims = useTerminalDimensions()

  const [selected, setSelected] = createSignal(0)
  const [scrollOffset, setScrollOffset] = createSignal(0)

  const emptyText = createMemo(() => props.emptyText ?? "No items")
  const title = createMemo(() => props.title ?? "Items")

  // Layout - recomputed on every dimension change
  const layout = createMemo(() => {
    const d = dims()
    const width = d.width - 4
    const start = Math.floor(width * 0.4)
    const maxLines = Math.min(9, Math.floor((d.height - 5)))
    return { width, start, maxLines }
  })

  // Build all lines for all options
  const allLines = createMemo((): OptionLine[] => {
    const { width, start } = layout()
    const result: OptionLine[] = []

    for (let optIdx = 0; optIdx < props.options.length; optIdx++) {
      const option = props.options[optIdx]

      if (option.description) {
        const firstLineDescWidth = width - start - GAP
        const descLines = wrapText(option.description, firstLineDescWidth, MAX_DESC_LINES)

        const paddedName = padToWidth(option.display, start)
        result.push({
          segments: [
            { text: paddedName, type: "name" },
            { text: "  " + descLines[0], type: "desc" },
          ],
          optionIndex: optIdx,
        })

        const linePadding = " ".repeat(start + GAP)
        for (let i = 1; i < descLines.length; i++) {
          result.push({
            segments: [{ text: linePadding + descLines[i], type: "desc" }],
            optionIndex: optIdx,
          })
        }
      } else {
        result.push({
          segments: [{ text: option.display, type: "name" }],
          optionIndex: optIdx,
        })
      }
    }

    return result
  })

  // Visible window of lines - use signal for explicit control
  const [visibleLines, setVisibleLines] = createSignal<OptionLine[]>([])

  // Update visible lines when dependencies change
  createEffect(() => {
    const lines = allLines()
    const offset = scrollOffset()
    const max = layout().maxLines
    setVisibleLines(lines.slice(offset, offset + max))
  })

  // Update scroll when selected changes
  createEffect(() => {
    const idx = selected()
    const lines = allLines()
    const { maxLines } = layout()

    let firstLine = -1
    let lineCount = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].optionIndex === idx) {
        if (firstLine === -1) firstLine = i
        lineCount++
      }
    }
    if (firstLine === -1) return

    const idealStart = Math.max(0, firstLine - Math.floor((maxLines - lineCount) / 2))
    const maxStart = Math.max(0, lines.length - maxLines)
    const newOffset = Math.min(idealStart, maxStart)

    if (scrollOffset() !== newOffset) {
      setScrollOffset(newOffset)
    }
  })

  // Update separator
  createEffect(() => {
    const sep = props.separatorRef
    if (!sep || !props.visible) return
    const total = props.options.length
    sep.setTitle(total > 0 ? `${title()} ${selected() + 1}/${total}` : title())
    sep.setColor(undefined)
  })

  // Keep selected in bounds
  createEffect(() => {
    const len = props.options.length
    if (len > 0 && selected() >= len) {
      setSelected(len - 1)
    }
  })

  // Expose ref
  const ref: SelectListRef = {
    get visible() { return props.visible },
    onKeyDown(e: any) {
      if (!props.visible) return false
      const name = e.name

      if (name === "escape") {
        setSelected(0)
        setScrollOffset(0)
        props.onDismiss()
        e.preventDefault()
        return true
      }

      if (name === "up" || (e.ctrl && name === "p")) {
        setSelected(prev => {
          const len = props.options.length
          return prev > 0 ? prev - 1 : len - 1
        })
        e.preventDefault()
        return true
      }

      if (name === "down" || (e.ctrl && name === "n")) {
        setSelected(prev => {
          const len = props.options.length
          return prev < len - 1 ? prev + 1 : 0
        })
        e.preventDefault()
        return true
      }

      if (name === "return" || name === "enter" || name === "tab") {
        const option = props.options[selected()]
        if (option) {
          setSelected(0)
          setScrollOffset(0)
          props.onSelect(option)
        }
        e.preventDefault()
        return true
      }

      return false
    },
    show() {
      setSelected(0)
      setScrollOffset(0)
    },
    hide() {
      setSelected(0)
      setScrollOffset(0)
    },
    getSelected() {
      return props.options[selected()]?.value
    },
  }

  createEffect(() => {
    props.ref(ref)
  })

  return (
    <Show when={props.visible}>
      <box flexDirection="column">
        <Show when={props.options.length > 0} fallback={
          <box paddingLeft={2} paddingRight={2}>
            <text fg={theme.textMuted}>{emptyText()}</text>
          </box>
        }>
          <For each={visibleLines()}>
            {(line) => {
              const isSelected = createMemo(() => line.optionIndex === selected())
              const nameColor = createMemo(() => isSelected() ? theme.primary : theme.text)
              const descColor = createMemo(() => isSelected() ? theme.primary : theme.textMuted)

              return (
                <box paddingLeft={2} paddingRight={2}>
                  <text wrapMode="none">
                    {line.segments.map((seg) => (
                      <span style={{ fg: seg.type === "name" ? nameColor() : descColor() }}>
                        {seg.text}
                      </span>
                    ))}
                  </text>
                </box>
              )
            }}
          </For>
        </Show>
      </box>
    </Show>
  )
}
