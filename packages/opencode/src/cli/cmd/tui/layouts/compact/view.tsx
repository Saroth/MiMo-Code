import { createMemo } from "solid-js"
import { useTuiConfig } from "@tui/context/tui-config"
import { useTerminalDimensions } from "@opentui/solid"
import { useCurrentAgentID } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { SessionContext } from "../context"
import { CompactMessages } from "./component/messages"
import { CompactInput, type CompactInputRef } from "./component/input"
import { Separator, type SeparatorRef } from "./component/separator"

export function CompactView(props: { sessionID: string }) {
  const sync = useSync()
  const tuiConfig = useTuiConfig()
  const dimensions = useTerminalDimensions()
  const currentAgentID = useCurrentAgentID()

  const permissions = createMemo(() => sync.data.permission[props.sessionID] ?? [])
  const questions = createMemo(() => sync.data.question[props.sessionID] ?? [])
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

  return (
    <box flexDirection="column" width={dimensions().width} height={dimensions().height}>
      {/* Messages area */}
      <CompactMessages sessionID={props.sessionID} />

      {/* Fixed separator line */}
      <box flexShrink={0}>
        <Separator ref={bindSeparator} />
      </box>

      {/* Input area - fixed height, always visible */}
      <box flexShrink={0}>
        <CompactInput
          sessionID={props.sessionID}
          visible={visible()}
          disabled={disabled()}
          ref={bindInput}
          separatorRef={separatorRef}
          onSubmit={() => {
            // Scroll to bottom after submit
          }}
        />
      </box>
    </box>
  )
}
