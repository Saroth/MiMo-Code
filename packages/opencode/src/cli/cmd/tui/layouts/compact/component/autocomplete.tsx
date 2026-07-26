import { createSignal, createMemo, createEffect, Show, Index, onMount, onCleanup } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useLanguage } from "@tui/context/language"
import { slashCommandDescription } from "@tui/i18n/slash-command"
import { skillDescription, skillSlashAliases } from "@tui/i18n/skill"
import { useTerminalDimensions } from "@opentui/solid"
import type { SeparatorRef } from "./separator"

export type CompactAutocompleteRef = {
  visible: boolean
  onKeyDown: (e: any) => void
  onInput: (value: string) => void
}

type CommandOption = {
  display: string
  value: string
  description?: string
}

export function CompactAutocomplete(props: {
  ref: (ref: CompactAutocompleteRef) => void
  onSelect: (value: string) => void
  onDismiss: () => void
  separatorRef?: SeparatorRef
}) {
  const { theme } = useTheme()
  const sync = useSync()
  const command = useCommandDialog()
  const lang = useLanguage()
  const dimensions = useTerminalDimensions()

  const [visible, setVisible] = createSignal(false)
  const [selected, setSelected] = createSignal(0)
  const [search, setSearch] = createSignal("")
  const [scrollOffset, setScrollOffset] = createSignal(0)

  // Get all available commands
  const commands = createMemo((): CommandOption[] => {
    const results: CommandOption[] = [...command.slashes().map(s => ({
      display: s.display,
      value: s.display,
      description: s.description,
    }))]

    for (const serverCommand of sync.data.command) {
      const desc = serverCommand.source === "skill"
        ? skillDescription(lang.t, serverCommand.name, serverCommand.description, serverCommand.bundled)
        : slashCommandDescription(lang.t, serverCommand.name, serverCommand.description)
      results.push({
        display: "/" + serverCommand.name,
        value: "/" + serverCommand.name,
        description: desc,
      })
    }

    results.sort((a, b) => a.display.localeCompare(b.display))
    return results
  })

  // Filter commands based on search
  const filteredCommands = createMemo(() => {
    const searchValue = search()
    if (!searchValue) return commands()

    const lower = searchValue.toLowerCase()
    return commands().filter(cmd =>
      cmd.display.toLowerCase().includes(lower) ||
      cmd.description?.toLowerCase().includes(lower)
    )
  })

  // Max visible items
  const maxVisibleItems = createMemo(() => Math.min(7, Math.floor((dimensions().height - 5) / 1)))

  // Keep selected item centered (unless at top or bottom)
  function updateScrollOffset(index: number) {
    const maxItems = maxVisibleItems()
    const totalItems = filteredCommands().length

    // Calculate ideal offset to center selected item
    const idealOffset = Math.max(0, index - Math.floor(maxItems / 2))

    // Clamp to valid range
    const maxOffset = Math.max(0, totalItems - maxItems)
    const clampedOffset = Math.min(idealOffset, maxOffset)

    setScrollOffset(clampedOffset)
  }

  // Visible items based on scroll offset
  const visibleItems = createMemo(() => {
    const maxItems = maxVisibleItems()
    const offset = scrollOffset()
    return filteredCommands().slice(offset, offset + maxItems)
  })

  // Update separator when autocomplete state changes
  createEffect(() => {
    const sep = props.separatorRef
    if (!sep) return

    if (visible()) {
      const total = filteredCommands().length
      if (total === 0) {
        sep.setTitle("Commands")
      } else {
        sep.setTitle(`Command ${selected() + 1}/${total}`)
      }
      sep.setColor(undefined) // Use default color
    }
  })

  // Expose ref
  const ref: CompactAutocompleteRef = {
    get visible() { return visible() },
    onKeyDown(e: any) {
      if (!visible()) return

      const name = e.name

      if (name === "escape") {
        setVisible(false)
        setSelected(0)
        setSearch("")
        setScrollOffset(0)
        props.onDismiss()
        e.preventDefault()
        return
      }

      // Up: arrow up or ctrl+p
      if (name === "up" || (e.ctrl && name === "p")) {
        setSelected(prev => {
          const len = filteredCommands().length
          const next = prev > 0 ? prev - 1 : len - 1
          updateScrollOffset(next)
          return next
        })
        e.preventDefault()
        return
      }

      // Down: arrow down or ctrl+n
      if (name === "down" || (e.ctrl && name === "n")) {
        setSelected(prev => {
          const len = filteredCommands().length
          const next = prev < len - 1 ? prev + 1 : 0
          updateScrollOffset(next)
          return next
        })
        e.preventDefault()
        return
      }

      if (name === "return" || name === "enter" || name === "tab") {
        const cmd = filteredCommands()[selected()]
        if (cmd) {
          setVisible(false)
          setSelected(0)
          setSearch("")
          setScrollOffset(0)
          props.onSelect(cmd.value)
        }
        e.preventDefault()
        return
      }
    },
    onInput(value: string) {
      if (value.startsWith("/")) {
        setVisible(true)
        setSearch(value.slice(1))
        setSelected(0)
        setScrollOffset(0)
      } else {
        setVisible(false)
        setSearch("")
        setSelected(0)
        setScrollOffset(0)
      }
    },
  }

  onMount(() => {
    props.ref(ref)
  })

  // Keep selected in bounds
  createEffect(() => {
    const len = filteredCommands().length
    if (selected() >= len) {
      setSelected(Math.max(0, len - 1))
      setScrollOffset(0)
    }
  })

  return (
    <Show when={visible()}>
      <box flexDirection="column">
        {/* Menu items - show even when empty to maintain layout */}
        <box flexDirection="column">
          <Show when={filteredCommands().length > 0} fallback={
            <box paddingLeft={2} paddingRight={2}>
              <text fg={theme.textMuted}>No matching commands</text>
            </box>
          }>
            <Index each={visibleItems()}>
              {(option, index) => {
                const actualIndex = createMemo(() => index + scrollOffset())
                return (
                  <box paddingLeft={2} paddingRight={2}>
                    <text
                      fg={actualIndex() === selected() ? theme.primary : theme.text}
                      wrapMode="none"
                    >
                      {option().display}
                      <Show when={option().description}>
                        <span style={{ fg: actualIndex() === selected() ? theme.primary : theme.textMuted }}>
                          {"  "}{option().description}
                        </span>
                      </Show>
                    </text>
                  </box>
                )
              }}
            </Index>
          </Show>
        </box>
      </box>
    </Show>
  )
}
