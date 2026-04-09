import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useUIStore, useConnectionStore, useTerminalTabStore } from '../stores/ui'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import { WriteToSession, ResizeTerminal, CreateShell } from '../../wailsjs/go/ssh/SSHService'
import AutocompletePopup from './AutocompletePopup'
import { useDialog } from './Dialog'

const xtermTheme = {
  background: '#11111b',
  foreground: '#cdd6f4',
  cursor: '#818cf8',
  cursorAccent: '#11111b',
  selectionBackground: '#45475a',
  selectionForeground: '#cdd6f4',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
}

interface TerminalInstanceProps {
  tabId: string
  sessionId: string
  serverId: string
  active: boolean
  appVisible: boolean
}

const TerminalInstance: React.FC<TerminalInstanceProps> = ({ sessionId, active, appVisible }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const activeRef = useRef(active)
  const appVisibleRef = useRef(appVisible)
  const currentLineRef = useRef('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showAC, setShowAC] = useState(false)
  const [acPrefix, setAcPrefix] = useState('')
  const [acPosition, setAcPosition] = useState({ top: 0, left: 0 })

  activeRef.current = active
  appVisibleRef.current = appVisible

  const triggerAutocomplete = useCallback((term: Terminal) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const buf = term.buffer.active
      const line = buf.getLine(buf.cursorY)
      if (!line) { setShowAC(false); return }
      const lineText = line.translateToString(true, 0, buf.cursorX)
      const trimmed = lineText.trimStart()
      const firstWord = trimmed.split(/\s+/)[0] || ''
      if (firstWord.length < 2) { setShowAC(false); return }
      setAcPrefix(firstWord)
      setShowAC(true)
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const charWidth = term.cols > 0 ? rect.width / term.cols : 8
        const charHeight = term.rows > 0 ? rect.height / term.rows : 16
        setAcPosition({
          top: rect.top + (buf.cursorY + 1) * charHeight,
          left: rect.left + buf.cursorX * charWidth,
        })
      }
    }, 150)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, Monaco, 'Courier New', monospace",
      theme: xtermTheme,
      allowProposedApi: true,
      scrollback: 10000,
      drawBoldTextInBrightColors: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)

    termRef.current = term
    fitRef.current = fitAddon

    const ro = new ResizeObserver(() => {
      if (!activeRef.current || !appVisibleRef.current) return
      if (!containerRef.current || containerRef.current.offsetWidth === 0) return
      try { fitAddon.fit() } catch {}
    })
    ro.observe(containerRef.current)
    roRef.current = ro

    requestAnimationFrame(() => {
      if (!containerRef.current || containerRef.current.offsetWidth === 0) return
      try { fitAddon.fit() } catch {}
    })

    term.onData((data: string) => {
      WriteToSession({ sessionId, data })
      if (data === '\r' || data === '\n') {
        currentLineRef.current = ''
        setShowAC(false)
      } else if (data === '\x7f' || data === '\b') {
        currentLineRef.current = currentLineRef.current.slice(0, -1)
        triggerAutocomplete(term)
      } else if (data === '\t') {
        setShowAC(false)
      } else if (data === '\x03') {
        currentLineRef.current = ''
        setShowAC(false)
      } else if ((data.length === 1 && data >= ' ') || data.length > 1) {
        currentLineRef.current += data
        triggerAutocomplete(term)
      }
    })

    const handleStdout = (d: string) => { term.write(d) }
    const handleStderr = (d: string) => { term.write(d) }

    EventsOn(`ssh:${sessionId}:stdout`, handleStdout)
    EventsOn(`ssh:${sessionId}:stderr`, handleStderr)

    requestAnimationFrame(() => {
      if (!containerRef.current || containerRef.current.offsetWidth === 0) return
      try {
        fitAddon.fit()
        const { cols, rows } = term
        ResizeTerminal({ sessionId, cols, rows })
      } catch {}
    })

    return () => {
      EventsOff(`ssh:${sessionId}:stdout`)
      EventsOff(`ssh:${sessionId}:stderr`)
      ro.disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [sessionId])

  useEffect(() => {
    const shouldActivate = active && appVisible
    if (!shouldActivate) return
    if (!fitRef.current || !termRef.current) return

    const timer = setTimeout(() => {
      try {
        fitRef.current?.fit()
        const term = termRef.current
        if (term) {
          const { cols, rows } = term
          ResizeTerminal({ sessionId, cols, rows })
          const buf = term.buffer.active
          term.refresh(0, Math.max(0, buf.length - 1))
          term.focus()
        }
      } catch {}
    }, 50)
    return () => clearTimeout(timer)
  }, [active, appVisible, sessionId])

  const handleAcSelect = useCallback((command: string) => {
    const term = termRef.current
    if (!term) return
    const prefix = acPrefix
    const remaining = command.slice(prefix.length)
    if (remaining) {
      WriteToSession({ sessionId, data: remaining })
      currentLineRef.current += remaining
    }
    setShowAC(false)
    term.focus()
  }, [sessionId, acPrefix])

  const handleAcClose = useCallback(() => {
    setShowAC(false)
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-full w-full p-1 bg-[#11111b]"
      style={{ display: active ? 'block' : 'none' }}
    >
      {showAC && (
        <AutocompletePopup
          sessionId={sessionId}
          visible={showAC}
          prefix={acPrefix}
          position={acPosition}
          onSelect={handleAcSelect}
          onClose={handleAcClose}
        />
      )}
    </div>
  )
}

const XTerminal: React.FC = () => {
  const { activeServerId, activeTab } = useUIStore()
  const { connections } = useConnectionStore()
  const {
    terminalTabs, activeTerminalTabId,
    setActiveTerminalTab, removeTerminalTab, addTerminalTab,
  } = useTerminalTabStore()
  const { prompt: dialogPrompt } = useDialog()
  const appVisible = activeTab === 'terminal'

  const handleNewShell = async () => {
    const connEntries = Object.entries(connections)
    if (connEntries.length === 0) return

    let targetServerId = activeServerId

    if (!targetServerId || !connections[targetServerId]) {
      if (connEntries.length === 1) {
        targetServerId = connEntries[0][0]
      } else {
        const serverNames = connEntries.map(([_id, c]) => c.serverName)
        const choice = await dialogPrompt({
          title: '新建终端',
          message: '选择要在哪台服务器上新建终端',
          suggestions: serverNames,
          confirmText: '新建',
        })
        if (choice === null) return
        const entry = connEntries.find(([_id, c]) => c.serverName === choice)
        if (!entry) return
        targetServerId = entry[0]
      }
    }

    const conn = connections[targetServerId]
    if (!conn) return

    try {
      const resp = await CreateShell({ baseSessionId: conn.sessionId })
      if (resp.success && resp.sessionId) {
        addTerminalTab({
          id: `${targetServerId}-${resp.sessionId}`,
          serverId: targetServerId,
          sessionId: resp.sessionId,
          label: `Shell ${terminalTabs.filter(t => t.serverId === targetServerId).length + 1}`,
          serverName: conn.serverName,
          connected: true,
        })
      }
    } catch (e) {
      console.error('New shell failed:', e)
    }
  }

  const hasActiveConnection = activeTerminalTabId
    ? terminalTabs.some(t => t.id === activeTerminalTabId && t.serverId in connections)
    : false

  return (
    <div className="flex flex-col h-full">
      {terminalTabs.length > 1 && (
        <div className="flex items-center bg-surface-400 border-b border-border/40 px-1 flex-shrink-0">
          {terminalTabs.map((tab) => (
            <div
              key={tab.id}
              className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-b-2 transition-all ${
                tab.id === activeTerminalTabId
                  ? 'text-primary-300 border-primary-400 bg-surface-300/50'
                  : 'text-text-dim border-transparent hover:text-text-muted hover:bg-surface-50/30'
              }`}
              onClick={() => setActiveTerminalTab(tab.id)}
            >
              <span className="truncate max-w-[120px]">{tab.label}</span>
              <button
                className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger transition-all ml-1"
                onClick={(e) => { e.stopPropagation(); removeTerminalTab(tab.id) }}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            className="px-2 py-1 text-text-dim hover:text-primary-300 transition-colors"
            onClick={handleNewShell}
            title="新建 Shell"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1 relative">
        {!hasActiveConnection ? (
          <div className="flex items-center justify-center h-full text-text-dim">
            <div className="text-center">
              <div className="text-sm">点击左侧服务器开始连接</div>
              <div className="text-xs text-text-dim/50 mt-1">Ctrl+1~7 切换标签 / Ctrl+B 侧边栏 / Ctrl+Shift+P 命令面板</div>
            </div>
          </div>
        ) : (
          terminalTabs.map((tab) => {
            const conn = connections[tab.serverId]
            if (!conn) return null
            const sid = tab.sessionId || conn.sessionId
            return (
              <TerminalInstance
                key={tab.id}
                tabId={tab.id}
                sessionId={sid}
                serverId={tab.serverId}
                active={tab.id === activeTerminalTabId}
                appVisible={appVisible}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

export default XTerminal
