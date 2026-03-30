import { useCallback, useMemo, useState } from 'react'
import { ToastContext, type ToastApi, type ToastKind } from './toast'

type ToastItem = {
  id: string
  kind: ToastKind
  title?: string
  message: string
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((kind: ToastKind, message: string, title?: string) => {
    const id = Math.random().toString(16).slice(2) + Date.now().toString(16)
    const toast: ToastItem = { id, kind, title, message }
    setItems((prev) => [toast, ...prev].slice(0, 4))
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 4200)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      info: (m, t) => push('info', m, t),
      success: (m, t) => push('success', m, t),
      error: (m, t) => push('error', m, t),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-message">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
