import {
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js"
import { useRouteData, useCurrentAgentID } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { useKeybind } from "@tui/context/keybind"
import { useTuiConfig } from "@tui/context/tui-config"
import { usePromptRef } from "@tui/context/prompt"
import { Prompt, type PromptRef } from "@tui/component/prompt"
import { Toast } from "@tui/ui/toast"
import { Spinner } from "@tui/component/spinner"
import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { TuiPluginRuntime } from "@tui/plugin"
import { SessionContext } from "../session-context"

export function CompactSession(props: { sessionID: string }) {
  const sync = useSync()
  const { theme } = useTheme()
  const keybind = useKeybind()
  const tuiConfig = useTuiConfig()
  const promptRef = usePromptRef()
  const dimensions = useTerminalDimensions()
  const currentAgentID = useCurrentAgentID()

  const session = createMemo(() => sync.session.get(props.sessionID))
  const messages = createMemo(() => {
    const buckets = sync.data.message[props.sessionID]
    const agentID = currentAgentID()
    if (agentID === "main" && !buckets?.["main"]?.length) return buckets?.[props.sessionID] ?? []
    return buckets?.[agentID] ?? []
  })
  const permissions = createMemo(() => sync.data.permission[props.sessionID] ?? [])
  const questions = createMemo(() => sync.data.question[props.sessionID] ?? [])
  const visible = createMemo(
    () =>
      currentAgentID() === "main" &&
      permissions().length === 0 &&
      questions().length === 0,
  )
  const disabled = createMemo(() => permissions().length > 0 || questions().length > 0)

  const pending = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant" && !x.time.completed)?.id
  })

  // Sidebar state (always open in compact layout)
  const [sidebarOpen] = createSignal(true)
  const sidebarWidth = createMemo(() => sidebarOpen() ? 24 : 0)

  // Content width
  const contentWidth = createMemo(() => dimensions().width - sidebarWidth() - 4)

  // Bind prompt ref
  const bind = (r: PromptRef | undefined) => {
    promptRef.set(r)
  }

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
      <box flexDirection="column" width={dimensions().width} height={dimensions().height}>
        {/* Top status bar */}
        <box
          height={1}
          backgroundColor={theme.backgroundPanel}
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={theme.textMuted}>
            MiMo Code
            <Show when={session()}>
              {" | "}
              <span style={{ fg: theme.text }}>{session()?.title ?? "Untitled"}</span>
            </Show>
          </text>
          <box flexGrow={1} />
          <text fg={theme.textMuted}>
            {keybind.print("command_list")} Command Palette
          </text>
        </box>

        {/* Main content area */}
        <box flexDirection="row" flexGrow={1}>
          {/* Left sidebar */}
          <Show when={sidebarOpen()}>
            <box
              width={sidebarWidth()}
              height="100%"
              backgroundColor={theme.backgroundPanel}
              flexDirection="column"
              paddingTop={1}
              paddingBottom={1}
              paddingLeft={1}
              paddingRight={1}
            >
              {/* Context section */}
              <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
                Context
              </text>
              <box height={1} />

              {/* Sessions */}
              <text fg={theme.text}>📁 Sessions</text>
              <text fg={theme.textMuted} paddingLeft={1}>
                {sync.data.session.length} sessions
              </text>

              {/* Commands */}
              <box height={1} />
              <text fg={theme.text}>🔧 Commands</text>
              <text fg={theme.textMuted} paddingLeft={1}>
                {sync.data.command.length} commands
              </text>

              {/* Status */}
              <box height={1} />
              <text fg={theme.text}>📊 Status</text>
              <Show when={session()}>
                <text fg={theme.textMuted} paddingLeft={1}>
                  {sync.data.session_status[props.sessionID]?.type ?? "idle"}
                </text>
              </Show>

              {/* Spacer */}
              <box flexGrow={1} />

              {/* Version */}
              <text fg={theme.textMuted}>
                v0.1.7
              </text>
            </box>
          </Show>

          {/* Main chat area */}
          <box
            flexGrow={1}
            flexDirection="column"
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
          >
            {/* Messages */}
            <box flexGrow={1}>
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

            {/* Input area */}
            <box flexShrink={0} paddingTop={1}>
              <TuiPluginRuntime.Slot
                name="session_prompt"
                mode="replace"
                session_id={props.sessionID}
                visible={visible()}
                disabled={disabled()}
                ref={bind}
              >
                <Prompt
                  visible={visible()}
                  ref={bind}
                  disabled={disabled()}
                  sessionID={props.sessionID}
                  right={<TuiPluginRuntime.Slot name="session_prompt_right" session_id={props.sessionID} />}
                />
              </TuiPluginRuntime.Slot>
            </box>

            <Toast />
          </box>
        </box>

        {/* Bottom status bar */}
        <box
          height={1}
          backgroundColor={theme.backgroundPanel}
          paddingLeft={1}
          paddingRight={1}
        >
          <text fg={theme.textMuted}>
            Tab: Switch Mode | Ctrl+K: Settings | @: Attach | /: Commands
          </text>
          <box flexGrow={1} />
          <Show when={session()}>
            <text fg={theme.textMuted}>
              {sync.data.session_status[props.sessionID]?.type ?? "ready"}
            </text>
          </Show>
        </box>
      </box>
    </SessionContext.Provider>
  )
}
