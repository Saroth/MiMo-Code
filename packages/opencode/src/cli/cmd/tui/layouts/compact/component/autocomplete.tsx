import { createSignal, createMemo, onMount } from "solid-js"
import { useSync } from "@tui/context/sync"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useLanguage } from "@tui/context/language"
import { slashCommandDescription } from "@tui/i18n/slash-command"
import { skillDescription } from "@tui/i18n/skill"
import { SelectList, type SelectListRef, type SelectOption } from "./select-list"
import type { SeparatorRef } from "./separator"

export type CompactAutocompleteRef = {
  visible: boolean
  onKeyDown: (e: any) => void
  onInput: (value: string) => void
}

export function CompactAutocomplete(props: {
  ref: (ref: CompactAutocompleteRef) => void
  onSelect: (value: string) => void
  onDismiss: () => void
  separatorRef?: SeparatorRef
}) {
  const sync = useSync()
  const command = useCommandDialog()
  const lang = useLanguage()

  const [visible, setVisible] = createSignal(false)
  const [search, setSearch] = createSignal("")
  let listRef: SelectListRef | undefined

  // Get all available commands
  const commands = createMemo((): SelectOption[] => {
    const results: SelectOption[] = [...command.slashes().map(s => ({
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

  // Expose ref
  const ref: CompactAutocompleteRef = {
    get visible() { return visible() },
    onKeyDown(e: any) {
      if (!visible()) return
      listRef?.onKeyDown(e)
    },
    onInput(value: string) {
      if (value.startsWith("/")) {
        setVisible(true)
        setSearch(value.slice(1))
        listRef?.show()
      } else {
        setVisible(false)
        setSearch("")
        listRef?.hide()
      }
    },
  }

  onMount(() => {
    props.ref(ref)
  })

  return (
    <SelectList
      ref={(r) => { listRef = r }}
      options={filteredCommands()}
      visible={visible()}
      title="Command"
      emptyText="No matching commands"
      separatorRef={props.separatorRef}
      onSelect={(option) => {
        setVisible(false)
        setSearch("")
        props.onSelect(option.value)
      }}
      onDismiss={() => {
        setVisible(false)
        setSearch("")
        props.onDismiss()
      }}
    />
  )
}
