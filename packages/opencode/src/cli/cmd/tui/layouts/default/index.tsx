import type { LayoutDefinition } from "@tui/context/layout"
import type { JSX } from "solid-js"

// The default layout uses the existing Session component from session/index.tsx
// This is a placeholder that will be replaced with the actual component
// when the layout system is fully integrated

export const DefaultLayout: LayoutDefinition = {
  name: "default",
  label: "Default",
  description: "Standard OpenCode layout",
  Session: (props: { sessionID: string }): JSX.Element => {
    // This will be replaced by the actual Session component
    // For now, return a placeholder
    return <></>
  },
  Home: (): JSX.Element => {
    return <></>
  },
}
