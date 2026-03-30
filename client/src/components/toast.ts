import { createContext, useContext } from 'react'

export type ToastKind = 'info' | 'success' | 'error'

export type ToastApi = {
  info(message: string, title?: string): void
  success(message: string, title?: string): void
  error(message: string, title?: string): void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const v = useContext(ToastContext)
  if (!v) throw new Error('useToast must be used within ToastProvider')
  return v
}

