import { create } from 'zustand'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useUIStore } from '../stores/ui'

interface Command {
  id: string
  label: string
  shortcut?: string
  category: string
  execute: () => void
}

interface PaletteState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const usePaletteStore = create<PaletteState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}))

export function useCommandPalette() {
  const isOpen = usePaletteStore((s) => s.isOpen)
  const open = usePaletteStore((s) => s.open)
  const close = usePaletteStore((s) => s.close)
  const toggle = usePaletteStore((s) => s.toggle)
  return { isOpen, open, close, toggle }
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

function getCommands(): Command[] {
  return [
    { id: 'tab-terminal', label: '切换到终端', shortcut: 'Ctrl+1', category: '导航', execute: () => useUIStore.getState().setActiveTab('terminal') },
    { id: 'tab-vnc', label: '切换到VNC', shortcut: 'Ctrl+2', category: '导航', execute: () => useUIStore.getState().setActiveTab('vnc') },
    { id: 'new-shell', label: '新建Shell', shortcut: 'Ctrl+T', category: '操作', execute: () => {} },
    { id: 'toggle-sidebar', label: '切换侧边栏', shortcut: 'Ctrl+B', category: '视图', execute: () => useUIStore.getState().toggleSidebar() },
    { id: 'add-server', label: '添加服务器', shortcut: 'Ctrl+N', category: '操作', execute: () => useUIStore.getState().setShowAddServerDialog(true) },
  ]
}

export default function CommandPalette() {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const isOpen = usePaletteStore((s) => s.isOpen)
  const close = usePaletteStore((s) => s.close)

  const commands = getCommands()
  const filtered = query
    ? commands.filter((cmd) => fuzzyMatch(query, cmd.label))
    : commands

  useEffect(() => {
    setSelectedIndex(0)
    setQuery('')
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('[data-command-item]')
    const selected = items[selectedIndex] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, filtered.length])

  const executeCommand = useCallback(
    (cmd: Command) => {
      cmd.execute()
      close()
    },
    [close]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (filtered[selectedIndex]) {
            executeCommand(filtered[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          close()
          break
      }
    },
    [filtered, selectedIndex, executeCommand, close]
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg rounded-2xl border border-border/20
          backdrop-blur-2xl bg-surface-400/85 shadow-glass overflow-hidden animate-scale-in"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center border-b border-border/20 px-4">
          <svg className="h-4 w-4 shrink-0 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent px-3 py-3 text-sm text-text placeholder:text-text-dim outline-none"
            placeholder="输入命令搜索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center rounded-lg border border-border/30 bg-surface-50/80 px-1.5 py-0.5 text-[10px] text-text-dim font-mono">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-dim">
              未找到匹配的命令
            </div>
          ) : (
            filtered.map((cmd, index) => (
              <button
                key={cmd.id}
                data-command-item
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5
                  text-left text-sm transition-colors duration-75 cursor-pointer
                  ${index === selectedIndex
                    ? 'bg-primary-500/12 text-text'
                    : 'text-text hover:bg-surface-50/50'
                  }`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-dim w-8 text-right">
                    {cmd.category === '导航' ? '↗' : cmd.category === '视图' ? '◫' : '+'}
                  </span>
                  <span>{cmd.label}</span>
                </div>
                {cmd.shortcut && (
                  <kbd className="text-[10px] text-text-dim font-mono bg-surface-50/80 border border-border/30 rounded-lg px-1.5 py-0.5">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border/20 px-4 py-2 flex items-center gap-4 text-[11px] text-text-dim">
          <span className="flex items-center gap-1">
            <kbd className="font-mono bg-surface-50/80 border border-border/30 rounded-lg px-1.5 py-0.5">↑↓</kbd>
            导航
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono bg-surface-50/80 border border-border/30 rounded-lg px-1.5 py-0.5">↵</kbd>
            执行
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono bg-surface-50/80 border border-border/30 rounded-lg px-1.5 py-0.5">esc</kbd>
            关闭
          </span>
        </div>
      </div>
    </div>
  )
}
