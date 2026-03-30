import { useState } from 'react'
import { C, F } from './tokens'

export type ToastState = { msg: string; type: 'ok' | 'err' } | null

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null)

  function show(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  return { toast, show }
}

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      background: toast.type === 'ok' ? C.ink : C.red.text,
      color: '#fff', borderRadius: 8, padding: '12px 18px',
      fontSize: 13, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      fontFamily: F.body,
    }}>
      {toast.msg}
    </div>
  )
}