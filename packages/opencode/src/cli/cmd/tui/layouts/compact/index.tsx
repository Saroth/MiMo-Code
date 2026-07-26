import type { LayoutDefinition } from "@tui/context/layout"
import { CompactSession } from "./session"

export const CompactLayout: LayoutDefinition = {
  name: "compact",
  label: "Compact",
  description: "Compact, efficient layout",
  Session: (props) => <CompactSession sessionID={props.sessionID} />,
  Home: () => <></>,
}
