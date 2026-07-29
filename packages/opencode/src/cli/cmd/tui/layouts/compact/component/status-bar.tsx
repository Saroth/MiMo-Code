import { createMemo } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useLocal } from "@tui/context/local"
import { useSync } from "@tui/context/sync"

export function StatusBar() {
  const { theme } = useTheme()
  const local = useLocal()
  const sync = useSync()

  const currentModel = createMemo(() => {
    const model = local.model.current()
    if (!model) return "No model"
    return model.modelID
  })

  const sessionCount = createMemo(() => sync.data.session.length)

  return (
    <box
      flexShrink={0}
      height={1}
      backgroundColor={theme.backgroundElement}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="row"
      alignItems="center"
    >
      <text fg={theme.textMuted}>{currentModel()}</text>
      <box flexGrow={1} />
      <text fg={theme.textMuted}>{sessionCount()} sessions</text>
    </box>
  )
}
