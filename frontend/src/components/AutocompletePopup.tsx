import React, { useEffect, useRef, useState, useCallback } from 'react'
import { FetchCommands, Complete } from '../../wailsjs/go/autocomplete/AutoCompleteService'

interface Suggestion {
  command: string
  description: string
  type: string
}

interface AutocompletePopupProps {
  sessionId: string | null
  visible: boolean
  prefix: string
  onSelect: (command: string) => void
  onClose: () => void
  position: { top: number; left: number }
}

const TYPE_COLORS: Record<string, string> = {
  alias: 'text-accent-green',
  builtin: 'text-accent-yellow',
  file: 'text-accent-blue',
  function: 'text-accent-mauve',
  keyword: 'text-accent-peach',
}

const AutocompletePopup: React.FC<AutocompletePopupProps> = ({
  sessionId,
  visible,
  prefix,
  onSelect,
  onClose,
  position,
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  useEffect(() => {
    if (!sessionId) return
    FetchCommands({ sessionId }).catch(() => {})
  }, [sessionId])

  useEffect(() => {
    setSelectedIndex(0)
  }, [prefix])

  useEffect(() => {
    if (!visible || !sessionId || !prefix) {
      setSuggestions([])
      return
    }
    loadingRef.current = true
    Complete({ sessionId, prefix })
      .then((resp: any) => {
        if (resp?.success && Array.isArray(resp.suggestions)) {
          setSuggestions(resp.suggestions.slice(0, 50))
        } else {
          setSuggestions([])
        }
      })
      .catch(() => setSuggestions([]))
      .finally(() => { loadingRef.current = false })
  }, [visible, sessionId, prefix])

  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[selectedIndex] as HTMLElement
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % suggestions.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length)
        break
      case 'Tab':
      case 'Enter':
        e.preventDefault()
        if (suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex].command)
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [visible, suggestions, selectedIndex, onSelect, onClose])

  useEffect(() => {
    if (!visible) return
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [visible, handleKeyDown])

  if (!visible || suggestions.length === 0) return null

  const highlightPrefix = (command: string) => {
    if (!prefix) return <span>{command}</span>
    const idx = command.toLowerCase().indexOf(prefix.toLowerCase())
    if (idx === -1) return <span>{command}</span>
    return (
      <span>
        {command.slice(0, idx)}
        <span className="text-primary-300 font-semibold">{command.slice(idx, idx + prefix.length)}</span>
        {command.slice(idx + prefix.length)}
      </span>
    )
  }

  return (
    <div
      className="fixed z-50 min-w-[280px] max-w-[480px] bg-surface-400 border border-border/60 rounded-md shadow-glass animate-fade-in overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div
        ref={listRef}
        className="overflow-y-auto py-1"
        style={{ maxHeight: `${Math.min(suggestions.length, 10) * 30 + 8}px` }}
      >
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.command}
            className={`flex items-center gap-2 px-3 cursor-pointer transition-colors ${
              index === selectedIndex
                ? 'bg-primary-500/15 text-text'
                : 'text-text-muted hover:bg-surface-50/40'
            }`}
            style={{ height: 30 }}
            onClick={() => onSelect(suggestion.command)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span
              className={`font-mono text-xs w-24 truncate flex-shrink-0 ${
                index === selectedIndex ? 'text-primary-300' : (TYPE_COLORS[suggestion.type] || 'text-text')
              }`}
            >
              {highlightPrefix(suggestion.command)}
            </span>
            <span className={`text-[11px] truncate ${index === selectedIndex ? 'text-text-muted' : 'text-text-dim'}`}>
              {suggestion.description}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-3 py-1 border-t border-border/30 text-text-dim text-[10px]">
        <span>{suggestions.length} 条结果</span>
        <span className="flex gap-2">
          <span>
            <kbd className="px-1 py-0.5 bg-surface-50/50 rounded text-[9px]">↑↓</kbd> 导航
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-surface-50/50 rounded text-[9px]">Tab</kbd> 选择
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-surface-50/50 rounded text-[9px]">Esc</kbd> 关闭
          </span>
        </span>
      </div>
    </div>
  )
}

export default AutocompletePopup
