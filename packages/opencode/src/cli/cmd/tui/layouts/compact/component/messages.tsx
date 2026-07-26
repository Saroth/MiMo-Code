import { createMemo, Show, For } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useCurrentAgentID } from "@tui/context/route"
import { Spinner } from "@tui/component/spinner"
import { TextAttributes } from "@opentui/core"

export function CompactMessages(props: { sessionID: string }) {
  const sync = useSync()
  const { theme } = useTheme()
  const currentAgentID = useCurrentAgentID()

  const messages = createMemo(() => {
    const buckets = sync.data.message[props.sessionID]
    const agentID = currentAgentID()
    if (agentID === "main" && !buckets?.["main"]?.length) return buckets?.[props.sessionID] ?? []
    return buckets?.[agentID] ?? []
  })

  const pending = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant" && !x.time.completed)?.id
  })

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      paddingLeft={0}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
      overflow="hidden"
    >
      <For each={messages()}>
        {(message) => (
          <box marginBottom={1}>
            {/* User message */}
            <Show when={message.role === "user"}>
              <box flexDirection="row" gap={1}>
                <text fg={theme.primary} attributes={TextAttributes.BOLD}>
                  User:
                </text>
                <text fg={theme.text}>
                  {sync.data.part[message.id]?.find((p) => p.type === "text")?.text ?? ""}
                </text>
              </box>
            </Show>

            {/* Assistant message */}
            <Show when={message.role === "assistant"}>
              <box flexDirection="row" gap={1}>
                <text fg={theme.secondary} attributes={TextAttributes.BOLD}>
                  Assistant:
                </text>
                <text fg={theme.text}>
                  {sync.data.part[message.id]?.find((p) => p.type === "text")?.text ?? ""}
                </text>
              </box>
            </Show>
          </box>
        )}
      </For>

      {/* Pending indicator */}
      <Show when={pending()}>
        <box flexDirection="row" gap={1}>
          <Spinner color={theme.primary} />
          <text fg={theme.textMuted}>Thinking...</text>
        </box>
      </Show>
    </box>
  )
}
