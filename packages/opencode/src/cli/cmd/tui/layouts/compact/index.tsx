import type { LayoutDefinition } from "@tui/context/layout"
import { CompactLayout as CompactLayoutComponent } from "./layout"

export const CompactLayout: LayoutDefinition = {
  name: "compact",
  label: "Compact",
  description: "Compact, efficient layout",
  showHome: false,
  Session: (props) => <CompactLayoutComponent sessionID={props.sessionID} />,
  Home: () => <></>,
}
