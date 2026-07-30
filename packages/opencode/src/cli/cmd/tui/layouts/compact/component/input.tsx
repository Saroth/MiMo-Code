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
  const [historySteps, setHistorySteps] = createSignal(0)
  const [lastSubmittedText, setLastSubmittedText] = createSignal<string | null>(null)
  const [lastUserMessageId, setLastUserMessageId] = createSignal<string | null>(null)

  let textareaEl: any = null
  let autocompleteRef: CompactAutocompleteRef | undefined
  let exitTimer: ReturnType<typeof setTimeout> | undefined
  let suppressAutocomplete = false
  let suppressHistoryReset = false
  let savedInput = ""

  // Check if session is processing
  const isProcessing = createMemo(() => {
    if (!props.sessionID) return false
    const messages = sync.data.message[props.sessionID]
    if (!messages) return false
    const allMessages = Object.values(messages).flat()
    return allMessages.some((x) => x.role === "assistant" && !x.time.completed)
  })

  // Check if the assistant response to our last message has content
  const hasResponseContent = createMemo(() => {
    const userMsgId = lastUserMessageId()
    if (!userMsgId || !props.sessionID) return false
    const messages = sync.data.message[props.sessionID]
    if (!messages) return false
    const allMessages = Object.values(messages).flat()
    // Find assistant message that comes after our user message and has text content
    const userMsgIndex = allMessages.findIndex((x) => x.id === userMsgId)
    if (userMsgIndex === -1) return false
    // Check messages after the user message
    for (let i = userMsgIndex + 1; i < allMessages.length; i++) {
      const msg = allMessages[i]
      if (msg.role === "assistant") {
        const parts = sync.data.part[msg.id]
        if (parts?.some((p) => p.type === "text" && p.text?.length > 0)) {
          return true
        }
      }
    }
    return false
  })

  // Add to history when first response content is received
  createEffect(() => {
    if (hasResponseContent() && lastSubmittedText()) {
      history.append({ input: lastSubmittedText()!, parts: [] })
      setLastSubmittedText(null)
      setLastUserMessageId(null)
    }
  })

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
      return
    }

    if (historySteps() > 0) {
      const total = history.length
      const current = total - historySteps() + 1
      sep.setTitle(`History ${current}/${total}`)
      sep.setColor(undefined)
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

    // Reset history and save text for potential history add or revert
    resetHistory()
    setLastSubmittedText(text)

    // Immediately clear input
    setValue("")
    if (textareaEl) textareaEl.setText("")

    // Check if this is a slash command
    if (text.startsWith("/")) {
      const clientSlash = command.slashes().find((s) => s.display === text)
      if (clientSlash) {
        clientSlash.onSelect?.()
        setLastSubmittedText(null)
        return
      }

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
        setLastSubmittedText(null)
        props.onSubmit?.()
        return
      }
    }

    // Regular message
    const selectedModel = local.model.current()
    if (!selectedModel) {
      toast.show({ message: "Please select a model first", variant: "warning" })
      setLastSubmittedText(null)
      return
    }

    try {
      await sdk.client.session.prompt({
        sessionID,
        parts: [{ type: "text", text }],
      })
      // Find the user message ID we just sent
      const messages = sync.data.message[sessionID]
      if (messages) {
        const allMessages = Object.values(messages).flat()
        const lastUserMsg = allMessages.findLast((x) => x.role === "user")
        if (lastUserMsg) {
          setLastUserMessageId(lastUserMsg.id)
        }
      }
      props.onSubmit?.()
    } catch (error) {
      toast.show({
        message: error instanceof Error ? error.message : "Failed to send message",
        variant: "error",
      })
    }
  }

  function handleSelect(command: string) {
    suppressAutocomplete = true
    setValue(command)
    if (textareaEl) {
      textareaEl.setText(command)
      textareaEl.gotoBufferEnd()
    }
    setAutocompleteVisible(false)
    resetHistory()
    setTimeout(() => {
      suppressAutocomplete = false
    }, 100)
  }

  function handleDismiss() {
    if (value().startsWith("/")) {
      setValue("")
      if (textareaEl) textareaEl.setText("")
    }
    setAutocompleteVisible(false)
  }

  // Navigate history
  function navigateHistory(direction: 1 | -1) {
    const currentInput = value()

    if (historySteps() === 0 && direction === -1) {
      savedInput = currentInput
    }

    const inputForHistory = (direction === -1 && historySteps() === 0 && currentInput.length > 0)
      ? ""
      : currentInput

    const item = history.move(direction, inputForHistory)
    if (item) {
      suppressAutocomplete = true
      suppressHistoryReset = true
      setValue(item.input)
      if (textareaEl) {
        textareaEl.setText(item.input)
        textareaEl.gotoBufferEnd()
      }
      setTimeout(() => {
        suppressAutocomplete = false
        suppressHistoryReset = false
      }, 100)

      if (direction === -1) {
        const newSteps = historySteps() + 1
        if (newSteps <= history.length) {
          setHistorySteps(newSteps)
        }
      } else {
        const newSteps = historySteps() - 1
        if (newSteps <= 0) {
          resetHistory()
          suppressAutocomplete = true
          suppressHistoryReset = true
          setValue(savedInput)
          if (textareaEl) {
            textareaEl.setText(savedInput)
            textareaEl.gotoBufferEnd()
          }
          setTimeout(() => {
            suppressAutocomplete = false
            suppressHistoryReset = false
          }, 100)
        } else {
          setHistorySteps(newSteps)
        }
      }
    }
  }

  function clearInput() {
    setValue("")
    if (textareaEl) textareaEl.setText("")
    resetHistory()
  }

  const placeholderText = createMemo(() => {
    return exitPending() ? "Press Ctrl-C again to exit." : ""
  })

  return (
    <Show when={props.visible !== false}>
      <box flexDirection="column" flexShrink={0} backgroundColor={theme.backgroundElement}>
        {/* Autocomplete menu */}
        <CompactAutocomplete
          ref={(r) => {
            autocompleteRef = r
            if (r) {
              const origOnInput = r.onInput
              r.onInput = (val: string) => {
                origOnInput(val)
                setAutocompleteVisible(r.visible)
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
                if (!suppressAutocomplete) {
                  autocompleteRef?.onInput(text)
                }
                if (text !== "" && exitPending()) {
                  setExitPending(false)
                  if (exitTimer) clearTimeout(exitTimer)
                }
                if (historySteps() > 0 && !suppressHistoryReset) {
                  resetHistory()
                }
              }
            }}
            onKeyDown={async (e) => {
              if (autocompleteRef?.visible) {
                autocompleteRef.onKeyDown(e)
                if (e.defaultPrevented) return
              }

              // Handle Ctrl+C - double press to exit
              if (e.ctrl && e.name === "c") {
                if (value() !== "") {
                  clearInput()
                } else if (exitPending()) {
                  await exit()
                } else {
                  setExitPending(true)
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

              // Handle history navigation - Up arrow or Ctrl+P
              if (e.name === "up" || (e.ctrl && e.name === "p")) {
                if (!autocompleteRef?.visible) {
                  const cursorRow = textareaEl?.visualCursor?.visualRow ?? 0
                  if (cursorRow === 0) {
                    navigateHistory(-1)
                    e.preventDefault()
                    return
                  }
                }
              }

              // Handle history navigation - Down arrow or Ctrl+N
              if (e.name === "down" || (e.ctrl && e.name === "n")) {
                if (!autocompleteRef?.visible) {
                  const cursorOffset = textareaEl?.cursorOffset ?? 0
                  const textLength = textareaEl?.plainText?.length ?? 0
                  if (cursorOffset >= textLength) {
                    navigateHistory(1)
                    e.preventDefault()
                    return
                  }
                }
              }

              // Handle Enter - submit
              if (e.name === "return" || (e.name === "enter" && !e.shift)) {
                e.preventDefault()
                await submit()
                return
              }

              // Handle Escape - abort processing
              if (e.name === "escape") {
                const pendingText = lastSubmittedText()
                if (pendingText && props.sessionID) {
                  // Abort any processing first
                  await sdk.client.session.abort({ sessionID: props.sessionID }).catch(() => {})
                  
                  // Use the tracked user message ID for revert
                  const userMsgId = lastUserMessageId()
                  if (userMsgId) {
                    try {
                      await sdk.client.session.revert({
                        sessionID: props.sessionID,
                        messageID: userMsgId,
                      })
                    } catch (err) {
                      // Revert failed, continue anyway
                    }
                  }
                  
                  // Clear tracked state
                  setLastSubmittedText(null)
                  setLastUserMessageId(null)
                  
                  // Restore input and reset history
                  suppressAutocomplete = true
                  suppressHistoryReset = true
                  setValue(pendingText)
                  if (textareaEl) {
                    textareaEl.setText(pendingText)
                    textareaEl.gotoBufferEnd()
                  }
                  resetHistory()
                  setTimeout(() => {
                    suppressAutocomplete = false
                    suppressHistoryReset = false
                  }, 100)
                  e.preventDefault()
                  return
                }
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
