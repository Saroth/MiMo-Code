import type { LayoutDefinition } from "@tui/context/layout"

// Default layout uses the Session component directly from routes/session
// No wrapper needed - the session/index.tsx handles default layout rendering
export const DefaultLayout: LayoutDefinition = {
  name: "default",
  label: "Default",
  description: "Standard MiMoCode layout",
  // Session is null - routes/session/index.tsx handles default rendering
  Session: null as any,
  Home: () => <></>,
}
