import React, { useEffect, useRef, useState, useCallback } from 'react'

export interface MenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  separator?: false
}

export interface MenuSeparator {
  separator: true
}

export type ContextMenuItem = MenuItem | MenuSeparator

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState({ x, y })

  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let nx = x
    let ny = y
    if (x + rect.width > vw - 8) nx = vw - rect.width - 8
    if (ny + rect.height > vh - 8) ny = vh - rect.height - 8
    if (nx < 4) nx = 4
    if (ny < 4) ny = 4
    setAdjustedPos({ x: nx, y: ny })
  }, [x, y])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleScroll = () => onClose()

    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] py-1 bg-surface-300 border border-border/60 rounded-lg shadow-glass animate-fade-in"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={`sep-${i}`} className="my-1 border-t border-border/40" />
        }
        const mi = item as MenuItem
        return (
          <button
            key={`item-${i}`}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors text-left
              ${mi.disabled
                ? 'text-text-dim/40 cursor-not-allowed'
                : mi.danger
                  ? 'text-danger hover:bg-danger/10'
                  : 'text-text-muted hover:bg-surface-50/40 hover:text-text'
              }`}
            onClick={(e) => {
              e.stopPropagation()
              if (!mi.disabled) {
                mi.onClick()
                onClose()
              }
            }}
            disabled={mi.disabled}
          >
            {mi.icon && <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{mi.icon}</span>}
            <span>{mi.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function useContextMenu() {
  const [state, setState] = useState<{
    visible: boolean
    x: number
    y: number
    items: ContextMenuItem[]
  }>({ visible: false, x: 0, y: 0, items: [] })

  const show = useCallback((e: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation: () => void }, items: ContextMenuItem[]) => {
    e.preventDefault()
    e.stopPropagation()
    setState({ visible: true, x: e.clientX, y: e.clientY, items })
  }, [])

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }))
  }, [])

  const ContextMenuOverlay = useCallback(() => {
    if (!state.visible) return null
    return <ContextMenu x={state.x} y={state.y} items={state.items} onClose={hide} />
  }, [state.visible, state.x, state.y, state.items, hide])

  return { show, hide, ContextMenuOverlay }
}

export default ContextMenu
