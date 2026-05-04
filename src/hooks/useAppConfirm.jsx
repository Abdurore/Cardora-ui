import { useState } from 'react'
import ConfirmModal from '../components/ConfirmModal.jsx'

export function useAppConfirm() {
  const [state, setState] = useState(null)

  const confirm = (title, message, opts = {}) =>
    new Promise(resolve => {
      setState({ title, message, resolve, ...opts })
    })

  const modal = state ? (
    <ConfirmModal
      title={state.title}
      message={state.message}
      variant={state.variant}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      onConfirm={() => { state.resolve(true);  setState(null) }}
      onCancel={() =>  { state.resolve(false); setState(null) }}
    />
  ) : null

  return { confirm, ConfirmModal: modal }
}
