import { createSignal, createMemo, Show } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useTerminalDimensions } from "@opentui/solid"

export type SeparatorRef = {
  setTitle(title: string | undefined): void
  setColor(color: string | undefined): void
  setOffset(offset: number): void
  hide(): void
  show(): void
}

export function Separator(props: {
  ref?: (ref: SeparatorRef | undefined) => void
}) {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()

  const [title, setTitle] = createSignal<string | undefined>(undefined)
  const [color, setColor] = createSignal<string | undefined>(undefined)
  const [offset, setOffset] = createSignal(4)
  const [hidden, setHidden] = createSignal(false)

  // Expose ref
  const ref: SeparatorRef = {
    setTitle(t: string | undefined) { setTitle(t) },
    setColor(c: string | undefined) { setColor(c) },
    setOffset(o: number) { setOffset(o) },
    hide() { setHidden(true) },
    show() { setHidden(false) },
  }

  // Call ref callback
  if (props.ref) {
    // Use createEffect or onMount to call ref after mount
    // For simplicity, call it immediately (SolidJS handles this)
    props.ref(ref)
  }

  const line = createMemo(() => {
    const width = dimensions().width
    const t = title()
    const o = offset()

    if (!t) {
      return "─".repeat(width)
    }

    const titleLen = t.length
    const leftLen = Math.max(0, o)
    const rightLen = Math.max(0, width - leftLen - titleLen - 2) // 2 for spaces
    return "─".repeat(leftLen) + " " + t + " " + "─".repeat(rightLen)
  })

  const fg = createMemo(() => {
    return color() || theme.textMuted
  })

  return (
    <Show when={!hidden()}>
      <text fg={fg()}>{line()}</text>
    </Show>
  )
}
