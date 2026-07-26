// Layout registry - manually import and register layouts
// To add a new layout, import it here and add it to the layouts object

import type { LayoutDefinition } from "@tui/context/layout"
import { DefaultLayout } from "./default"
import { CompactLayout } from "./compact"

// Register all available layouts
export const layouts: Record<string, LayoutDefinition> = {
  [DefaultLayout.name]: DefaultLayout,
  [CompactLayout.name]: CompactLayout,
}

export function getDiscoveredLayouts(): Record<string, LayoutDefinition> {
  return layouts
}
