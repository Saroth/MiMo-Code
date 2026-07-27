import { createSimpleContext } from "./helper"
import { useKV } from "./kv"
import { createStore } from "solid-js/store"
import { createMemo, type JSX } from "solid-js"
import { getDiscoveredLayouts } from "../layouts"

export interface LayoutDefinition {
  name: string
  label: string
  description: string
  /** Whether to show the home screen (default: true) */
  showHome?: boolean
  Session: (props: { sessionID: string }) => JSX.Element
  Home: () => JSX.Element
}

type State = {
  layouts: Record<string, LayoutDefinition>
  active: string
  ready: boolean
}

const DEFAULT_LAYOUT = "default"

const [store, setStore] = createStore<State>({
  layouts: {},
  active: DEFAULT_LAYOUT,
  ready: false,
})

export const { use: useLayout, provider: LayoutProvider } = createSimpleContext({
  name: "Layout",
  init: () => {
    const kv = useKV()

    // Auto-discover layouts from the layouts directory
    const discovered = getDiscoveredLayouts()
    for (const [name, layout] of Object.entries(discovered)) {
      setStore("layouts", name, layout)
    }

    // Restore layout preference from KV, fallback to default
    const saved = kv.get("layout", DEFAULT_LAYOUT)
    const isValidLayout = store.layouts[saved] !== undefined
    setStore("active", isValidLayout ? saved : DEFAULT_LAYOUT)
    setStore("ready", true)

    // Reactive computation for home screen visibility
    const showHome = createMemo(() => {
      const current = store.layouts[store.active]
      return current?.showHome !== false
    })

    return {
      get active() {
        return store.active
      },
      get ready() {
        return store.ready
      },
      get layouts() {
        return store.layouts
      },
      get current(): LayoutDefinition | undefined {
        return store.layouts[store.active]
      },
      /** Call this function in JSX for reactive updates */
      showHome,
      set(layout: string) {
        if (!store.layouts[layout]) return false
        setStore("active", layout)
        kv.set("layout", layout)
        return true
      },
      register(layout: LayoutDefinition) {
        setStore("layouts", layout.name, layout)
      },
      all() {
        return store.layouts
      },
      names() {
        return Object.keys(store.layouts)
      },
    }
  },
})
