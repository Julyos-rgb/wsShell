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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-surface-300 rounded-lg shadow-glass w-[380px] border border-border/60 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="px-4 py-3 border-b border-border/40">
          <span className="text-sm font-medium text-text">{dialog.title}</span>
        </div>

        <div className="p-4 space-y-3">
          {dialog.message && (
            <div className="text-xs text-text-muted">{dialog.message}</div>
          )}
          {dialog.type === 'prompt' && (
            <>
              <input
                ref={inputRef}
                className="input-field text-xs"
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
                      className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
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

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border/40">
          <button className="btn-ghost text-xs" onClick={handleCancel}>
            {dialog.cancelText || '取消'}
          </button>
          <button
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 ${
              dialog.danger
                ? 'bg-danger/20 text-danger hover:bg-danger/30'
                : 'btn-primary'
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
