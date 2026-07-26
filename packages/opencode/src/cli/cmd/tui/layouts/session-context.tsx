// Shared session context - used by all layouts
import { createContext } from "solid-js"
import type { ThinkingMode } from "@tui/context/thinking"
import type { Provider } from "@mimo-ai/sdk/v2"
import type { useSync } from "@tui/context/sync"
import type { useTuiConfig } from "@tui/context/tui-config"

export interface SessionContextValue {
  width: number
  sessionID: string
  conceal: () => boolean
  thinkingMode: () => ThinkingMode
  showThinking: () => boolean
  showTimestamps: () => boolean
  showDetails: () => boolean
  showGenericToolOutput: () => boolean
  diffWrapMode: () => "word" | "none"
  providers: () => ReadonlyMap<string, Provider>
  sync: ReturnType<typeof useSync>
  tui: ReturnType<typeof useTuiConfig>
  freeApiSunset: () => boolean
}

export const SessionContext = createContext<SessionContextValue>()
