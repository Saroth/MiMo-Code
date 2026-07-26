import { createMemo, onMount, onCleanup } from "solid-js"
import { useCurrentAgentID } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { useTuiConfig } from "@tui/context/tui-config"
import { useKeyboard } from "@opentui/solid"
import { useTerminalDimensions } from "@opentui/solid"
import { SessionContext } from "../context"
import { CompactView } from "./view"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useKeybind } from "@tui/context/keybind"

export function CompactLayout(props: { sessionID: string }) {
  const sync = useSync()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const dimensions = useTerminalDimensions()
  const currentAgentID = useCurrentAgentID()
  const command = useCommandDialog()
  const keybind = useKeybind()

  const messages = createMemo(() => {
    const buckets = sync.data.message[props.sessionID]
    const agentID = currentAgentID()
    if (agentID === "main" && !buckets?.["main"]?.length) return buckets?.[props.sessionID] ?? []
    return buckets?.[agentID] ?? []
  })

  // Content width (full width minus padding)
  const contentWidth = createMemo(() => dimensions().width - 4)

  // Suspend the default command_list keybind (ctrl+p) in compact layout
  onMount(() => {
    command.keybinds(false) // Suspend command dialog keybinds
  })

  onCleanup(() => {
    command.keybinds(true) // Unsuspend when leaving compact layout
  })

  // Use compact_command_list (ctrl+o) to open command palette
  useKeyboard((evt) => {
    if (keybind.match("compact_command_list", evt)) {
      evt.preventDefault()
      command.show()
    }
  })

  // Context value for child components
  const contextValue = createMemo(() => ({
    get width() {
      return contentWidth()
    },
    sessionID: props.sessionID,
    conceal: () => true,
    thinkingMode: () => "hide" as const,
    showThinking: () => false,
    showTimestamps: () => false,
    showDetails: () => true,
    showGenericToolOutput: () => false,
    diffWrapMode: () => "word" as const,
    providers: () => new Map(),
    sync,
    tui: tuiConfig,
    freeApiSunset: () => false,
  }))

  return (
    <SessionContext.Provider value={contextValue()}>
      <CompactView sessionID={props.sessionID} />
    </SessionContext.Provider>
  )
}
