import type { LayoutDefinition } from "@tui/context/layout"
import { DefaultSession } from "./layout"

export const DefaultLayout: LayoutDefinition = {
  name: "default",
  label: "Default",
  description: "Standard MiMoCode layout",
  Session: (props) => <DefaultSession sessionID={props.sessionID} />,
  Home: () => <></>,
}
