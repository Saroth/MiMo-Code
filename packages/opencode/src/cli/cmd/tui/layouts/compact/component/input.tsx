import { createSignal, createMemo, Show, onMount, onCleanup, createEffect } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useSDK } from "@tui/context/sdk"
import { useLocal } from "@tui/context/local"
import { useKeybind } from "@tui/context/keybind"
import { useToast } from "@tui/ui/toast"
import { useTerminalDimensions } from "@opentui/solid"
import { useExit } from "@tui/context/exit"
import { usePromptHistory } from "@tui/component/prompt/history"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useLanguage } from "@tui/context/language"
import { CompactAutocomplete, type CompactAutocompleteRef } from "./autocomplete"
import type { SeparatorRef } from "./separator"

export type CompactInputRef = {
  focused: boolean
  value: string
  set(value: string): void
  reset(): void
  blur(): void
  focus(): void
  submit(): void
}

export function CompactInput(props: {
  sessionID?: string
  visible?: boolean
  disabled?: boolean
  onSubmit?: () => void
  onSessionCreated?: (sessionID: string) => void
  ref?: (ref: CompactInputRef | undefined) => void
  separatorRef?: SeparatorRef
}) {
  const { theme } = useTheme()
  const sync = useSync()
  const sdk = useSDK()
  const local = useLocal()
  const keybind = useKeybind()
  const toast = useToast()
  const dimensions = useTerminalDimensions()
  const exit = useExit()
  const history = usePromptHistory()
  const command = useCommandDialog()
  const lang = useLanguage()

  const [value, setValue] = createSignal("")
  const [focused, setFocused] = createSignal(true)
  const [autocompleteVisible, setAutocompleteVisible] = createSignal(false)
  const [exitPending, setExitPending] = createSignal(false)
  // Track history navigation: 0 = not navigating, positive = steps back from current
  const [historySteps, setHistorySteps] = createSignal(0)
  let textareaEl: any = null
  let autocompleteRef: CompactAutocompleteRef | undefined
  let exitTimer: ReturnType<typeof setTimeout> | undefined
  let suppressAutocomplete = false // Flag to suppress autocomplete after selection

  // Expose ref
  const ref: CompactInputRef = {
    get focused() { return focused() },
    get value() { return value() },
    set(val: string) {
      setValue(val)
      if (textareaEl) textareaEl.setText(val)
    },
    reset() {
      setValue("")
      if (textareaEl) textareaEl.setText("")
    },
    blur() { setFocused(false) },
    focus() { setFocused(true) },
    submit() { submit() },
  }

  onMount(() => {
    props.ref?.(ref)
  })

  onCleanup(() => {
    props.ref?.(undefined)
    if (exitTimer) clearTimeout(exitTimer)
  })

  // Update separator when history or autocomplete state changes
  createEffect(() => {
    const sep = props.separatorRef
    if (!sep) return

    if (autocompleteVisible()) {
      // When autocomplete is visible, it controls the separator
      return
    }

    // Update separator for history navigation
    if (historySteps() > 0) {
      const total = history.length
      const current = total - historySteps() + 1
      sep.setTitle(`History ${current}/${total}`)
      sep.setColor(undefined) // Use default color
    } else {
      sep.setTitle(undefined)
      sep.setColor(undefined)
    }
  })

  // Reset history navigation state
  function resetHistory() {
    setHistorySteps(0)
    history.reset()
  }

  async function submit() {
    const text = value().trim()
    if (!text) return

    // Handle new session creation
    let sessionID = props.sessionID
    if (sessionID === "__new__" || !sessionID) {
      try {
        const result = await sdk.client.session.create({})
        if (result.data?.id) {
          sessionID = result.data.id
          props.onSessionCreated?.(sessionID)
        } else {
          toast.show({ message: "Failed to create session", variant: "error" })
          return
        }
      } catch (error) {
        toast.show({
          message: error instanceof Error ? error.message : "Failed to create session",
          variant: "error",
        })
        return
      }
    }

    // Save to history before submitting
    history.append({ input: text, parts: [] })
    resetHistory()

    // Immediately clear input
    setValue("")
    if (textareaEl) textareaEl.setText("")

    // Check if this is a slash command
    if (text.startsWith("/")) {
      // Check for client slash commands (like /help, /models, etc.)
      const clientSlash = command.slashes().find((s) => s.display === text)
      if (clientSlash) {
        clientSlash.onSelect?.()
        return
      }

      // Check for server slash commands
      const commandName = text.split("\n")[0].split(" ")[0].slice(1)
      const serverCommand = sync.data.command.find((item) => item.name === commandName)
      if (serverCommand) {
        const args = text.includes(" ") ? text.slice(text.indexOf(" ") + 1) : ""
        try {
          await sdk.client.session.command({
            sessionID,
            command: serverCommand.name,
            arguments: args,
          })
        } catch (error) {
          toast.show({
            message: error instanceof Error ? error.message : "Failed to execute command",
            variant: "error",
          })
        }
        props.onSubmit?.()
        return
      }
    }

    // Regular message
    const selectedModel = local.model.current()
    if (!selectedModel) {
      toast.show({ message: "Please select a model first", variant: "warning" })
      return
    }

    try {
      await sdk.client.session.prompt({
        sessionID,
        parts: [{ type: "text", text }],
      })
      props.onSubmit?.()
    } catch (error) {
      toast.show({
        message: error instanceof Error ? error.message : "Failed to send message",
        variant: "error",
      })
    }
  }

  function handleSelect(command: string) {
    // Suppress autocomplete from showing after selection
    suppressAutocomplete = true
    // Replace the current input with the selected command
    setValue(command)
    if (textareaEl) {
      textareaEl.setText(command)
      textareaEl.gotoBufferEnd()
    }
    setAutocompleteVisible(false)
    resetHistory()
    // Reset suppress flag after a short delay
    setTimeout(() => {
      suppressAutocomplete = false
    }, 100)
  }

  function handleDismiss() {
    // Clear the "/" from input if autocomplete was dismissed
    if (value().startsWith("/")) {
      setValue("")
      if (textareaEl) textareaEl.setText("")
    }
    setAutocompleteVisible(false)
  }

  // Navigate history
  function navigateHistory(direction: 1 | -1) {
    const currentInput = value()
    const item = history.move(direction, currentInput)
    if (item) {
      // Suppress autocomplete during history navigation
      suppressAutocomplete = true
      setValue(item.input)
      if (textareaEl) {
        textareaEl.setText(item.input)
        textareaEl.gotoBufferEnd()
      }
      // Reset suppress flag after a short delay
      setTimeout(() => {
        suppressAutocomplete = false
      }, 100)
      // Update history steps
      if (direction === -1) {
        // Going back in history
        const newSteps = historySteps() + 1
        // Cap at history length
        if (newSteps <= history.length) {
          setHistorySteps(newSteps)
        }
      } else {
        // Going forward in history
        const newSteps = historySteps() - 1
        if (newSteps <= 0) {
          resetHistory()
        } else {
          setHistorySteps(newSteps)
        }
      }
    }
  }

  // Clear input and reset history
  function clearInput() {
    setValue("")
    if (textareaEl) textareaEl.setText("")
    resetHistory()
  }

  // Placeholder text based on exit pending state
  const placeholderText = createMemo(() => {
    return exitPending() ? "Press Ctrl-C again to exit." : ""
  })

  return (
    <Show when={props.visible !== false}>
      <box flexDirection="column">
        {/* Autocomplete menu */}
        <CompactAutocomplete
          ref={(r) => {
            autocompleteRef = r
            // Track autocomplete visibility and update separator
            if (r) {
              const origOnInput = r.onInput
              r.onInput = (val: string) => {
                origOnInput(val)
                setAutocompleteVisible(r.visible)
                // When autocomplete becomes visible, it will set its own separator title
                if (r.visible && props.separatorRef) {
                  // Autocomplete will handle its own separator title via its own effect
                }
              }
            }
          }}
          onSelect={handleSelect}
          onDismiss={handleDismiss}
          separatorRef={props.separatorRef}
        />

        {/* Text input with prompt indicator */}
        <box flexDirection="row" gap={0} paddingLeft={0} paddingRight={1}>
          <text fg={theme.primary} flexShrink={0}>{"> "}</text>
          <textarea
            placeholder={placeholderText()}
            placeholderColor={exitPending() ? theme.warning : theme.textMuted}
            textColor={theme.text}
            focusedTextColor={theme.text}
            showCursor={true}
            cursorStyle={{ blinking: false }}
            minHeight={1}
            maxHeight={6}
            focused={focused()}
            flexGrow={1}
            onContentChange={() => {
              if (textareaEl) {
                const text = textareaEl.plainText
                setValue(text)
                // Notify autocomplete of input change (unless suppressed after selection)
                if (!suppressAutocomplete) {
                  autocompleteRef?.onInput(text)
                }
                // Clear exit pending state when user types
                if (text !== "" && exitPending()) {
                  setExitPending(false)
                  if (exitTimer) clearTimeout(exitTimer)
                }
              }
            }}
            onKeyDown={async (e) => {
              // Let autocomplete handle keys first
              if (autocompleteRef?.visible) {
                autocompleteRef.onKeyDown(e)
                if (e.defaultPrevented) return
              }

              // Handle Ctrl+C - double press to exit
              if (e.ctrl && e.name === "c") {
                if (value() !== "") {
                  // Clear input if there's text
                  clearInput()
                } else if (exitPending()) {
                  // Second press within 0.8s - exit
                  await exit()
                } else {
                  // First press - show exit hint
                  setExitPending(true)
                  // Reset after 0.8 seconds
                  if (exitTimer) clearTimeout(exitTimer)
                  exitTimer = setTimeout(() => {
                    setExitPending(false)
                  }, 800)
                }
                e.preventDefault()
                return
              }

              if (props.disabled) {
                e.preventDefault()
                return
              }

              // Handle history navigation - Up arrow or Ctrl+P (when no autocomplete)
              if (e.name === "up" || (e.ctrl && e.name === "p")) {
                if (!autocompleteRef?.visible) {
                  navigateHistory(-1)
                  e.preventDefault()
                  return
                }
              }

              // Handle history navigation - Down arrow or Ctrl+N (when no autocomplete)
              if (e.name === "down" || (e.ctrl && e.name === "n")) {
                if (!autocompleteRef?.visible) {
                  navigateHistory(1)
                  e.preventDefault()
                  return
                }
              }

              // Handle Enter - submit
              if (e.name === "return" || (e.name === "enter" && !e.shift)) {
                e.preventDefault()
                await submit()
                return
              }

              // Handle Escape - clear and reset history
              if (e.name === "escape" && value() !== "") {
                clearInput()
                e.preventDefault()
                return
              }
            }}
            ref={(r) => {
              textareaEl = r
            }}
          />
        </box>
      </box>
    </Show>
  )
}
