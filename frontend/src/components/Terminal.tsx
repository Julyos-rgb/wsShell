import React, { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useUIStore, useConnectionStore, useTerminalTabStore } from '../stores/ui'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'

const XTerminal: React.FC = () => {
  const { activeServerId } = useUIStore()
  const { connections } = useConnectionStore()
  const {
    terminalTabs, activeTerminalTabId,
    setActiveTerminalTab, removeTerminalTab, addTerminalTab,
  } = useTerminalTabStore()

  const termContainerRef = useRef<HTMLDivElement | null>(null) as React.MutableRefObject<HTMLDivElement | null>
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const dataDisposableRef = useRef<any>(null)
  const activeSessionIdRef = useRef<string | null>(null)

  const activeTab = activeTerminalTabId
    ? terminalTabs.find(t => t.id === activeTerminalTabId)
    : null
  const activeConn = activeTab
    ? connections.get(activeTab.serverId)
    : (activeServerId ? connections.get(activeServerId) : null)

  const initTerminal = useCallback(() => {
    if (!termContainerRef.current) return
    if (xtermRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, Monaco, 'Courier New', monospace",
      theme: {
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
      },
      allowProposedApi: true,
      scrollback: 10000,
      drawBoldTextInBrightColors: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termContainerRef.current)

    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch {}
    })

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    const ro = new ResizeObserver(() => {
      try { fitAddon.fit() } catch {}
    })
    ro.observe(termContainerRef.current)
    resizeObserverRef.current = ro

    term.onData((data: string) => {
      const sid = activeSessionIdRef.current
      if (!sid) return
      import('../../wailsjs/go/ssh/SSHService').then(({ WriteToSession }) => {
        WriteToSession({ sessionId: sid, data })
      })
    })
  }, [])

  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!activeConn || !activeTab) {
      if (dataDisposableRef.current) {
        dataDisposableRef.current.dispose()
        dataDisposableRef.current = null
      }
      activeSessionIdRef.current = null
      return
    }

    const sessionId = activeTab.sessionId || activeConn.sessionId

    if (activeSessionIdRef.current === sessionId && xtermRef.current) return

    activeSessionIdRef.current = sessionId

    if (!xtermRef.current) return

    const term = xtermRef.current

    const handleStdout = (data: string) => { term.write(data) }
    const handleStderr = (data: string) => { term.write(data) }

    EventsOn(`ssh:${sessionId}:stdout`, handleStdout)
    EventsOn(`ssh:${sessionId}:stderr`, handleStderr)

    requestAnimationFrame(() => {
      try {
        fitAddonRef.current?.fit()
        const { cols, rows } = term
        import('../../wailsjs/go/ssh/SSHService').then(({ ResizeTerminal }) => {
          ResizeTerminal({ sessionId, cols, rows })
        })
      } catch {}
    })

    term.focus()

    return () => {
      EventsOff(`ssh:${sessionId}:stdout`)
      EventsOff(`ssh:${sessionId}:stderr`)
    }
  }, [activeTab, activeConn, terminalTabs, connections])

  useEffect(() => {
    const handleResize = () => {
      if (!xtermRef.current || !fitAddonRef.current || !activeSessionIdRef.current) return
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit()
          if (xtermRef.current) {
            const { cols, rows } = xtermRef.current
            const sid = activeSessionIdRef.current
            if (sid) {
              import('../../wailsjs/go/ssh/SSHService').then(({ ResizeTerminal }) => {
                ResizeTerminal({ sessionId: sid, cols, rows })
              })
            }
          }
        } catch {}
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleNewShell = async () => {
    if (!activeServerId) return
    const conn = connections.get(activeServerId)
    if (!conn) return

    try {
      const { CreateShell } = await import('../../wailsjs/go/ssh/SSHService')
      const resp = await CreateShell({ baseSessionId: conn.sessionId })
      if (resp.success && resp.sessionId) {
        addTerminalTab({
          id: `${activeServerId}-${resp.sessionId}`,
          serverId: activeServerId,
          sessionId: resp.sessionId,
          label: `Shell ${terminalTabs.filter(t => t.serverId === activeServerId).length + 1}`,
          serverName: conn.serverName,
          connected: true,
        })
      }
    } catch (e) {
      console.error('New shell failed:', e)
    }
  }

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
        {!activeConn ? (
          <div className="flex items-center justify-center h-full text-text-dim">
            <div className="text-center">
              <div className="text-sm">点击左侧服务器开始连接</div>
              <div className="text-xs text-text-dim/50 mt-1">Ctrl+1 终端 / Ctrl+2 VNC / Ctrl+3 文件 / Ctrl+B 侧边栏</div>
            </div>
          </div>
        ) : (
          <div
            ref={(el) => {
              termContainerRef.current = el
              if (el) initTerminal()
            }}
            className="h-full w-full p-1 bg-[#11111b]"
          />
        )}
      </div>
    </div>
  )
}

export default XTerminal
