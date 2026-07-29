import { createMemo, createSignal, Show, For } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useCurrentAgentID } from "@tui/context/route"
import { useLocal } from "@tui/context/local"
import { Spinner } from "@tui/component/spinner"
import { TextAttributes } from "@opentui/core"
import { useLanguage } from "@tui/context/language"
import { useTuiConfig } from "@tui/context/tui-config"
import type { Message, Part, ToolPart, TextPart } from "@mimo-ai/sdk/v2"
import { getScrollAcceleration } from "@tui/util/scroll"

export function CompactMessages(props: { sessionID: string; showWelcome?: boolean }) {
  const sync = useSync()
  const { theme } = useTheme()
  const currentAgentID = useCurrentAgentID()
  const lang = useLanguage()
  const local = useLocal()
  const tuiConfig = useTuiConfig()

  const messages = createMemo(() => {
    if (props.showWelcome) return []
    const buckets = sync.data.message[props.sessionID]
    const agentID = currentAgentID()
    if (agentID === "main" && !buckets?.["main"]?.length) return buckets?.[props.sessionID] ?? []
    return buckets?.[agentID] ?? []
  })

  const pending = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant" && !x.time.completed)?.id
  })

  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  return (
    <scrollbox
      flexGrow={1}
      stickyScroll={true}
      stickyStart="bottom"
      scrollAcceleration={scrollAcceleration()}
      viewportOptions={{
        paddingRight: 0,
      }}
    >
      {/* Welcome info for new sessions */}
      <Show when={props.showWelcome}>
        <box flexDirection="column" paddingLeft={2} paddingTop={1}>
          <text fg={theme.primary} attributes={TextAttributes.BOLD}>
            MiMo Code
          </text>
          <text fg={theme.textMuted}>
            Where Models and Agents Co-Evolve
          </text>
          <box height={1} />
          <text fg={theme.textMuted}>
            Type your message below to start a new conversation
          </text>
          <text fg={theme.textMuted}>
            Use <span style={{ fg: theme.text }}>/help</span> to see available commands
          </text>
          <text fg={theme.textMuted}>
            Press <span style={{ fg: theme.text }}>Ctrl+O</span> to open command palette
          </text>
        </box>
      </Show>

      {/* Messages */}
      <For each={messages()}>
        {(message) => (
          <MessageItem
            message={message}
            parts={sync.data.part[message.id] ?? []}
            isPending={pending() === message.id}
          />
        )}
      </For>

      {/* Pending indicator for streaming */}
      <Show when={pending()}>
        <box flexDirection="row" gap={1} paddingLeft={2}>
          <Spinner color={theme.primary} />
          <text fg={theme.textMuted}>Thinking...</text>
        </box>
      </Show>
    </scrollbox>
  )
}

function MessageItem(props: { message: Message; parts: Part[]; isPending: boolean }) {
  const { theme } = useTheme()

  return (
    <box marginBottom={1}>
      <Show when={props.message.role === "user"}>
        <UserMessageContent message={props.message} parts={props.parts} />
      </Show>
      <Show when={props.message.role === "assistant"}>
        <AssistantMessageContent
          message={props.message}
          parts={props.parts}
          isPending={props.isPending}
        />
      </Show>
    </box>
  )
}

function UserMessageContent(props: { message: Message; parts: Part[] }) {
  const { theme } = useTheme()
  const local = useLocal()

  const textParts = createMemo(() =>
    props.parts.filter((p) => p.type === "text" && !p.synthetic) as TextPart[]
  )
  const fileParts = createMemo(() => props.parts.filter((p) => p.type === "file"))

  return (
    <box backgroundColor={theme.backgroundPanel} paddingLeft={0} paddingRight={1}>
      <box flexDirection="column">
        {/* Text content with > prefix */}
        <For each={textParts()}>
          {(part) => (
            <box flexDirection="row">
              <text fg={theme.primary}>{"> "}</text>
              <text fg={theme.text}>{part.text}</text>
            </box>
          )}
        </For>

        {/* File attachments */}
        <Show when={fileParts().length > 0}>
          <box flexDirection="row" gap={1} paddingTop={1} paddingLeft={2} flexWrap="wrap">
            <For each={fileParts()}>
              {(file: any) => (
                <text fg={theme.textMuted}>
                  <span style={{ bg: theme.backgroundElement }}> 📎 {file.filename ?? "file"} </span>
                </text>
              )}
            </For>
          </box>
        </Show>
      </box>
    </box>
  )
}

function AssistantMessageContent(props: { message: Message; parts: Part[]; isPending: boolean }) {
  const { theme } = useTheme()
  const local = useLocal()

  const textParts = createMemo(() =>
    props.parts.filter((p) => p.type === "text") as TextPart[]
  )
  const toolParts = createMemo(() =>
    props.parts.filter((p) => p.type === "tool") as ToolPart[]
  )

  const agentColor = createMemo(() => local.agent.color(props.message.agent))

  return (
    <box>
      {/* Text content */}
      <For each={textParts()}>
        {(part) => (
          <box paddingLeft={2}>
            <text fg={theme.text}>{part.text}</text>
          </box>
        )}
      </For>

      {/* Tool calls */}
      <For each={toolParts()}>
        {(part) => <ToolCallItem part={part} />}
      </For>

      {/* Streaming indicator */}
      <Show when={props.isPending && textParts().length === 0 && toolParts().length === 0}>
        <box paddingLeft={2} flexDirection="row" gap={1}>
          <Spinner color={theme.primary} />
          <text fg={theme.textMuted}>Processing...</text>
        </box>
      </Show>
    </box>
  )
}

function ToolCallItem(props: { part: ToolPart }) {
  const { theme } = useTheme()

  const statusIcon = createMemo(() => {
    switch (props.part.state.status) {
      case "completed":
        return "✓"
      case "running":
        return "⟳"
      case "error":
        return "✗"
      default:
        return "⋯"
    }
  })

  const statusColor = createMemo(() => {
    switch (props.part.state.status) {
      case "completed":
        return theme.success
      case "running":
        return theme.primary
      case "error":
        return theme.error
      default:
        return theme.textMuted
    }
  })

  const toolName = createMemo(() => props.part.tool)
  const toolInput = createMemo(() => {
    const input = (props.part.state as any).input
    if (!input) return ""
    // Show first meaningful field
    if (typeof input === "string") return input.slice(0, 80)
    if (input.command) return String(input.command).slice(0, 80)
    if (input.path) return String(input.path)
    if (input.pattern) return String(input.pattern)
    if (input.query) return String(input.query)
    return ""
  })

  return (
    <box paddingLeft={2} flexDirection="row" gap={1}>
      <text fg={statusColor()}>{statusIcon()}</text>
      <text fg={theme.textMuted}>
        <span style={{ fg: theme.text }}>{toolName()}</span>
        <Show when={toolInput()}>
          <span> {toolInput()}</span>
        </Show>
      </text>
    </box>
  )
}
