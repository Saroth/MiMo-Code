import { createMemo, createSignal, Show, For, Switch, Match } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useCurrentAgentID } from "@tui/context/route"
import { useLocal } from "@tui/context/local"
import { Spinner } from "@tui/component/spinner"
import { TextAttributes } from "@opentui/core"
import { useLanguage } from "@tui/context/language"
import { useTuiConfig } from "@tui/context/tui-config"
import { useTerminalDimensions } from "@opentui/solid"
import type { Message, Part, ToolPart, TextPart, ReasoningPart, AssistantMessage } from "@mimo-ai/sdk/v2"
import { getScrollAcceleration } from "@tui/util/scroll"
import { Locale } from "@/util"
import stripAnsi from "strip-ansi"

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

// Format timestamp
function formatTimestamp(time: number): string {
  const date = new Date(time)
  const now = new Date()

  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const timeStr = `${hours}:${minutes}`

  if (date.getFullYear() !== now.getFullYear()) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isSameDay) {
    return timeStr
  }

  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${month}-${day} ${timeStr}`
}

// Format duration in ms to human readable
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function MessageItem(props: { message: Message; parts: Part[]; isPending: boolean }) {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()

  const timestamp = createMemo(() => {
    const time = props.message.time?.created
    if (!time) return null
    return formatTimestamp(time)
  })

  // Separator line with optional timestamp
  const separatorContent = createMemo(() => {
    const width = dimensions().width - 1
    const ts = timestamp()

    if (!ts) {
      return "─".repeat(width)
    }

    const label = ` ${ts} `
    const labelLen = label.length
    const rightLen = Math.max(0, 2)
    const leftLen = Math.max(0, width - labelLen - 2)
    return "─".repeat(leftLen) + label + "─".repeat(rightLen)
  })

  const [hovered, setHovered] = createSignal(false)
  const separatorColor = createMemo(() => hovered() ? theme.primary : theme.backgroundPanel)

  return (
    <box
      marginBottom={0}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      {/* Separator above user message with timestamp */}
      <Show when={props.message.role === "user"}>
        <box backgroundColor={theme.background} paddingLeft={0} paddingRight={0}>
          <text fg={separatorColor()}>{separatorContent()}</text>
        </box>
      </Show>

      <Show when={props.message.role === "user"}>
        <UserMessageContent
          message={props.message}
          parts={props.parts}
          hovered={hovered()}
        />
      </Show>
      <Show when={props.message.role === "assistant"}>
        <AssistantMessageContent
          message={props.message as AssistantMessage}
          parts={props.parts}
          isPending={props.isPending}
        />
      </Show>
    </box>
  )
}

function UserMessageContent(props: { message: Message; parts: Part[]; hovered: boolean }) {
  const { theme } = useTheme()

  const textParts = createMemo(() =>
    props.parts.filter((p) => p.type === "text" && !p.synthetic) as TextPart[]
  )
  const fileParts = createMemo(() => props.parts.filter((p) => p.type === "file"))

  const bgColor = createMemo(() => props.hovered ? theme.backgroundElement : theme.backgroundPanel)
  const textColor = createMemo(() => props.hovered ? theme.primary : theme.text)

  return (
    <box backgroundColor={bgColor()} paddingLeft={0} paddingRight={1}>
      <box flexDirection="column">
        <For each={textParts()}>
          {(part) => (
            <box flexDirection="row">
              <text fg={theme.primary}>{"> "}</text>
              <text fg={textColor()}>{part.text}</text>
            </box>
          )}
        </For>

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

function AssistantMessageContent(props: { message: AssistantMessage; parts: Part[]; isPending: boolean }) {
  const { theme, syntax } = useTheme()
  const local = useLocal()
  const sync = useSync()
  const dimensions = useTerminalDimensions()

  const textParts = createMemo(() =>
    props.parts.filter((p) => p.type === "text") as TextPart[]
  )
  const toolParts = createMemo(() =>
    props.parts.filter((p) => p.type === "tool") as ToolPart[]
  )
  const reasoningParts = createMemo(() =>
    props.parts.filter((p) => p.type === "reasoning") as ReasoningPart[]
  )

  // Duration calculation
  const duration = createMemo(() => {
    if (!props.message.time?.completed) return 0
    if (!props.message.parentID) return 0
    const messages = sync.data.message[props.message.sessionID]?.[props.message.agentID ?? "main"] ?? []
    const userMsg = messages.find((x) => x.role === "user" && x.id === props.message.parentID)
    if (!userMsg?.time?.created) return 0
    return props.message.time.completed - userMsg.time.created
  })

  return (
    <box paddingLeft={1}>
      {/* Reasoning/Thinking parts */}
      <For each={reasoningParts()}>
        {(part) => <ReasoningPartItem part={part} />}
      </For>

      {/* Tool calls */}
      <For each={toolParts()}>
        {(part) => <ToolCallItem part={part} />}
      </For>

      {/* Text content with Markdown rendering */}
      <For each={textParts()}>
        {(part) => (
          <Show when={part.text.trim()}>
            <box paddingLeft={1} marginTop={0} width={dimensions().width - 4}>
              <markdown
                syntaxStyle={syntax()}
                streaming={true}
                content={part.text.trim()}
                conceal={false}
                fg={theme.markdownText}
                bg={theme.background}
                width={dimensions().width - 6}
              />
            </box>
          </Show>
        )}
      </For>

      {/* Streaming indicator */}
      <Show when={props.isPending && textParts().length === 0 && toolParts().length === 0 && reasoningParts().length === 0}>
        <box paddingLeft={1} flexDirection="row" gap={1}>
          <Spinner color={theme.primary} />
          <text fg={theme.textMuted}>Processing...</text>
        </box>
      </Show>

      {/* Footer with agent/model/duration */}
      <Show when={!props.isPending && (textParts().length > 0 || toolParts().length > 0)}>
        <box paddingLeft={1} paddingTop={1} flexDirection="row" justifyContent="space-between">
          <text fg={theme.textMuted}>
            <span style={{ fg: local.agent.color(props.message.agent) }}>▣ </span>
            <span style={{ fg: theme.text }}>{Locale.titlecase(props.message.mode)}</span>
            <Show when={duration()}>
              <span> · {formatDuration(duration())}</span>
            </Show>
          </text>
        </box>
      </Show>
    </box>
  )
}

function ReasoningPartItem(props: { part: ReasoningPart }) {
  const { theme } = useTheme()
  const [expanded, setExpanded] = createSignal(false)

  const duration = createMemo(() => {
    if (!props.part.time?.start || !props.part.time?.end) return null
    return props.part.time.end - props.part.time.start
  })

  return (
    <box paddingLeft={1} marginTop={1}>
      <box flexDirection="row" onMouseUp={() => setExpanded(!expanded())}>
        <text fg={theme.textMuted}>
          <span>{expanded() ? "▼" : "▶"} </span>
          <span>Thought</span>
          <Show when={duration()}>
            <span>: {formatDuration(duration()!)}</span>
          </Show>
        </text>
      </box>
      <Show when={expanded() && props.part.text?.trim()}>
        <box paddingLeft={2} paddingTop={1}>
          <text fg={theme.textMuted} wrapMode="word">{props.part.text.trim()}</text>
        </box>
      </Show>
    </box>
  )
}

function ToolCallItem(props: { part: ToolPart }) {
  const { theme, syntax } = useTheme()
  const sync = useSync()
  const dimensions = useTerminalDimensions()
  const [expanded, setExpanded] = createSignal(false)

  const isRunning = createMemo(() => props.part.state.status === "running")
  const isCompleted = createMemo(() => props.part.state.status === "completed")
  const isError = createMemo(() => props.part.state.status === "error")

  const statusIcon = createMemo(() => {
    if (isRunning()) return "⟳"
    if (isError()) return "✗"
    if (isCompleted()) return "✓"
    return "⋯"
  })

  const statusColor = createMemo(() => {
    if (isRunning()) return theme.primary
    if (isError()) return theme.error
    if (isCompleted()) return theme.success
    return theme.textMuted
  })

  const toolName = createMemo(() => props.part.tool)
  
  const toolInput = createMemo(() => {
    const input = (props.part.state as any).input
    if (!input) return null
    if (typeof input === "string") return { command: input }
    return input
  })

  const description = createMemo(() => {
    const input = toolInput()
    if (!input) return toolName()
    // For bash tool, show description or command
    if (input.description) return input.description
    if (input.command) return String(input.command).slice(0, 80)
    if (input.path) return String(input.path)
    if (input.pattern) return String(input.pattern)
    if (input.query) return String(input.query)
    return toolName()
  })

  const command = createMemo(() => {
    const input = toolInput()
    if (!input?.command) return null
    return String(input.command)
  })

  const output = createMemo(() => {
    const out = (props.part.state as any).output
    if (!out) return ""
    return stripAnsi(String(out).trim())
  })

  const workdir = createMemo(() => {
    const input = toolInput()
    return input?.workdir
  })

  return (
    <box paddingLeft={1} marginTop={1}>
      {/* Header with status and description */}
      <box
        flexDirection="row"
        gap={1}
        onMouseUp={() => {
          if (output() || command()) {
            setExpanded(!expanded())
          }
        }}
      >
        <text fg={statusColor()}>{statusIcon()}</text>
        <text fg={theme.text} wrapMode="none">
          {description()}
        </text>
        <Show when={isRunning()}>
          <Spinner color={theme.primary} />
        </Show>
      </box>

      {/* Expanded content */}
      <Show when={expanded()}>
        <box paddingLeft={2} paddingTop={1}>
          {/* Command with $ prefix */}
          <Show when={command()}>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>$</text>
              <text fg={theme.text}>{command()}</text>
            </box>
          </Show>

          {/* Work directory */}
          <Show when={workdir()}>
            <text fg={theme.textMuted}>in {workdir()}</text>
          </Show>

          {/* Output */}
          <Show when={output()}>
            <box paddingTop={1}>
              <code
                filetype="text"
                drawUnstyledText={false}
                syntaxStyle={syntax()}
                content={output()!}
                fg={theme.text}
                width={dimensions().width - 6}
              />
            </box>
          </Show>
        </box>
      </Show>
    </box>
  )
}
