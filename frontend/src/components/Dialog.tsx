import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'

interface DialogItem {
  id: string
  type: 'confirm' | 'prompt'
  title: string
  message?: string
  danger?: boolean
  confirmText?: string
  cancelText?: string
  placeholder?: string
  defaultValue?: string
  suggestions?: string[]
  resolve: (value: string | boolean | null) => void
}

const DialogContext = createContext<{
  confirm: (options: Omit<DialogItem, 'id' | 'type' | 'resolve'>) => Promise<boolean>
  prompt: (options: Omit<DialogItem, 'id' | 'type' | 'resolve'>) => Promise<string | null>
}>({
  confirm: () => Promise.resolve(false),
  prompt: () => Promise.resolve(null),
})

export function useDialog() {
  return useContext(DialogContext)
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogItem[]>([])
  const idRef = useRef(0)

  const addDialog = useCallback((dialog: Omit<DialogItem, 'id'>) => {
    const id = `dialog-${++idRef.current}`
    const item = { ...dialog, id }
    setDialogs((prev) => [...prev, item])
    return item
  }, [])

  const removeDialog = useCallback((id: string) => {
    setDialogs((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const confirm = useCallback((options: Omit<DialogItem, 'id' | 'type' | 'resolve'>): Promise<boolean> => {
    return new Promise((resolve) => {
      addDialog({ ...options, type: 'confirm', resolve: (v) => resolve(v === true) })
    })
  }, [addDialog])

  const prompt = useCallback((options: Omit<DialogItem, 'id' | 'type' | 'resolve'>): Promise<string | null> => {
    return new Promise((resolve) => {
      addDialog({ ...options, type: 'prompt', resolve: (v) => resolve(typeof v === 'string' ? v : null) })
    })
  }, [addDialog])

  const handleResolve = useCallback((id: string, value: string | boolean | null) => {
    const dialog = dialogs.find((d) => d.id === id)
    if (dialog) {
      dialog.resolve(value)
      removeDialog(id)
    }
  }, [dialogs, removeDialog])

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialogs.map((dialog) => (
        <DialogOverlay key={dialog.id} dialog={dialog} onResolve={handleResolve} />
      ))}
    </DialogContext.Provider>
  )
}

function DialogOverlay({ dialog, onResolve }: {
  dialog: DialogItem
  onResolve: (id: string, value: string | boolean | null) => void
}) {
  const [inputValue, setInputValue] = useState(dialog.defaultValue || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (dialog.type === 'prompt') {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [dialog.type])

  const handleConfirm = () => {
    if (dialog.type === 'prompt') {
      onResolve(dialog.id, inputValue)
    } else {
      onResolve(dialog.id, true)
    }
  }

  const handleCancel = () => {
    onResolve(dialog.id, null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') handleCancel()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={handleCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
      <div
        className="relative glass-panel shadow-glass rounded-2xl overflow-hidden w-full max-w-[340px] mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="text-center px-5 py-4 border-b border-border/20">
          <span className="text-sm font-medium text-text">{dialog.title}</span>
        </div>

        <div className="px-5 py-4 space-y-3">
          {dialog.message && (
            <div className="text-xs text-text-muted">{dialog.message}</div>
          )}
          {dialog.type === 'prompt' && (
            <>
              <input
                ref={inputRef}
                className="w-full bg-surface-50 rounded-xl px-3 py-2 text-sm border-none"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={dialog.placeholder || ''}
                autoFocus
              />
              {dialog.suggestions && dialog.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dialog.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`rounded-lg px-2.5 py-1 text-[11px] transition-colors ${
                        inputValue === s
                          ? 'bg-primary-500/25 text-primary-400 ring-1 ring-primary-400/40'
                          : 'bg-surface-500/60 text-text-muted hover:bg-surface-50/30 hover:text-text'
                      }`}
                      onClick={() => setInputValue(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex border-t border-border/20">
          <button className="flex-1 py-2.5 text-sm font-medium text-center text-text-muted transition-colors border-r border-border/20" onClick={handleCancel}>
            {dialog.cancelText || '取消'}
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-semibold text-center transition-colors ${
              dialog.danger
                ? 'text-danger'
                : 'text-primary-500'
            }`}
            onClick={handleConfirm}
          >
            {dialog.confirmText || (dialog.type === 'prompt' ? '确定' : '确认')}
          </button>
        </div>
      </div>
    </div>
  )
}
