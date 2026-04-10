import React, { useState, useCallback, createContext, useContext, useRef } from 'react'

interface ToastItem {
  id: string
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
}

interface ToastContextType {
  toast: (message: string, type?: ToastItem['type']) => void
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

const icons: Record<ToastItem['type'], React.ReactNode> = {
  info: (
    <svg className="w-3.5 h-3.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-3.5 h-3.5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-3.5 h-3.5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-3.5 h-3.5 text-accent-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
}

const bgColors: Record<ToastItem['type'], string> = {
  info: 'bg-accent-blue/10 border-accent-blue/30',
  success: 'bg-accent-green/10 border-accent-green/30',
  error: 'bg-danger/10 border-danger/30',
  warning: 'bg-accent-yellow/10 border-accent-yellow/30',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const toast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = `toast-${++idRef.current}`
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-14 right-4 z-[200] flex flex-col gap-1.5 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border shadow-glass animate-slide-up text-xs text-text ${bgColors[t.type]}`}
          >
            {icons[t.type]}
            <span className="max-w-xs truncate">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
