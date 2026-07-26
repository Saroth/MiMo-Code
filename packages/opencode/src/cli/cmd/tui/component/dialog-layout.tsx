import { DialogSelect, type DialogSelectRef } from "../ui/dialog-select"
import { useLayout } from "../context/layout"
import { useDialog } from "../ui/dialog"
import { createMemo, onCleanup } from "solid-js"

export function DialogLayout() {
  const layout = useLayout()
  const dialog = useDialog()
  let confirmed = false
  let ref: DialogSelectRef<string>
  const initial = layout.active

  // Dynamically generate options from registered layouts
  const options = createMemo(() =>
    Object.values(layout.layouts).map((l) => ({
      title: l.label,
      value: l.name,
      description: l.description,
    }))
  )

  onCleanup(() => {
    if (!confirmed) layout.set(initial)
  })

  return (
    <DialogSelect
      title="Layout"
      options={options()}
      current={initial}
      onMove={(opt) => {
        layout.set(opt.value)
      }}
      onSelect={(opt) => {
        layout.set(opt.value)
        confirmed = true
        dialog.clear()
      }}
      ref={(r) => {
        ref = r
      }}
      onFilter={(query) => {
        if (query.length === 0) {
          layout.set(initial)
          return
        }

        const first = ref.filtered[0]
        if (first) layout.set(first.value)
      }}
    />
  )
}
