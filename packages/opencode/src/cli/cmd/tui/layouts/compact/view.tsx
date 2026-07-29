import { createMemo, createSignal } from "solid-js"
import { useTuiConfig } from "@tui/context/tui-config"
import { useTerminalDimensions } from "@opentui/solid"
import { useCurrentAgentID, useRoute } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { CompactMessages } from "./component/messages"
import { CompactInput, type CompactInputRef } from "./component/input"
import { Separator, type SeparatorRef } from "./component/separator"
import { StatusBar } from "./component/status-bar"

export function CompactView(props: { sessionID: string }) {
  const sync = useSync()
  const tuiConfig = useTuiConfig()
  const dimensions = useTerminalDimensions()
  const currentAgentID = useCurrentAgentID()
  const route = useRoute()

  // Track the actual session ID (may change from "__new__" to real ID)
  const [actualSessionID, setActualSessionID] = createSignal(props.sessionID)
  const isNewSession = createMemo(() => actualSessionID() === "__new__")

  const permissions = createMemo(() => sync.data.permission[actualSessionID()] ?? [])
  const questions = createMemo(() => sync.data.question[actualSessionID()] ?? [])
  const visible = createMemo(
    () =>
      currentAgentID() === "main" &&
      permissions().length === 0 &&
      questions().length === 0,
  )
  const disabled = createMemo(() => permissions().length > 0 || questions().length > 0)

  // Refs
  let inputRef: CompactInputRef | undefined
  let separatorRef: SeparatorRef | undefined

  const bindInput = (r: CompactInputRef | undefined) => {
    inputRef = r
  }

  const bindSeparator = (r: SeparatorRef | undefined) => {
    separatorRef = r
  }

  const handleSessionCreated = (sessionID: string) => {
    setActualSessionID(sessionID)
    // Navigate to the real session
    route.navigate({ type: "session", sessionID })
  }

  return (
    <box flexDirection="column" width={dimensions().width} height={dimensions().height}>
      {/* Messages area - takes remaining space */}
      <CompactMessages sessionID={actualSessionID()} showWelcome={isNewSession()} />

      {/* Separator line */}
      <Separator ref={bindSeparator} />

      {/* Input area */}
      <CompactInput
        sessionID={actualSessionID()}
        visible={visible()}
        disabled={disabled()}
        ref={bindInput}
        separatorRef={separatorRef}
        onSessionCreated={handleSessionCreated}
        onSubmit={() => {
          // Scroll to bottom after submit
        }}
      />

      {/* Status bar */}
      <StatusBar />
    </box>
  )
}
