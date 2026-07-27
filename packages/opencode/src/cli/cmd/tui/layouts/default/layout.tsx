import { Session } from "../../routes/session"

// Wrapper component that adapts the existing Session to the layout interface
export function DefaultSession(props: { sessionID: string }) {
  // The existing Session component handles its own routing via useRouteData
  // so we just render it directly
  return <Session />
}
