import React, { useRef, useEffect, useState } from 'react'
import { Terminal as XTermTerminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import 'xterm/css/xterm.css'
import { useTerminalTabStore } from '../stores/ui'
import { WriteToSession, ResizeTerminal, CreateShell } from '../../wailsjs/go/ssh/SSHService'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import { TerminalTab } from '../types'

const terminalTheme = {
  background: '#0a0a0a',
  foreground: '#d4d4d4',
  cursor: '#64ffda',
  cursorAccent: '#0a0a0a',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff',
}

interface TerminalInstanceProps {
  tab: TerminalTab
  isActive: boolean
}

const TerminalInstance: React.FC<TerminalInstanceProps> = ({ tab, isActive }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTermTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon>(new FitAddon())
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!terminalRef.current || initialized) return

    const term = new XTermTerminal({
      theme: terminalTheme,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      allowProposedApi: true,
    })

    const fitAddon = fitAddonRef.current
    term.loadAddon(fitAddon)
    try {
      term.loadAddon(new WebLinksAddon())
    } catch (e) {
      // web-links addon optional
    }

    term.open(terminalRef.current)

    if (tab.connected && tab.sessionId) {
      term.writeln(`\x1b[1;32mConnected to ${tab.serverName}\x1b[0m`)
      term.writeln(`\x1b[90mSession: ${tab.sessionId}\x1b[0m`)
      term.writeln('')
    } else {
      term.writeln('\x1b[1;36mwsShell Terminal\x1b[0m')
      term.writeln('\x1b[90mConnecting...\x1b[0m')
      term.writeln('')
    }

    term.onData(async (data) => {
      if (!tab.sessionId) {
        term.write(data)
        return
      }
      try {
        await WriteToSession({ sessionId: tab.sessionId, data })
      } catch (e) {
        console.error('write error:', e)
      }
    })

    xtermRef.current = term
    setInitialized(true)

    return () => {
      term.dispose()
    }
  }, [tab.id])

  useEffect(() => {
    const term = xtermRef.current
    if (!term || !tab.sessionId) return

    const stdoutHandler = (data: string) => {
      term.write(data)
    }
    const stderrHandler = (data: string) => {
      term.write(data)
    }

    EventsOn(`ssh:${tab.sessionId}:stdout`, stdoutHandler)
    EventsOn(`ssh:${tab.sessionId}:stderr`, stderrHandler)

    return () => {
      EventsOff(`ssh:${tab.sessionId}:stdout`)
      EventsOff(`ssh:${tab.sessionId}:stderr`)
    }
  }, [tab.sessionId, initialized])

  useEffect(() => {
    if (!isActive || !initialized) return

    const handleResize = () => {
      const term = xtermRef.current
      if (!term) return
      fitAddonRef.current.fit()
      if (tab.sessionId && term.rows && term.cols) {
        ResizeTerminal({ sessionId: tab.sessionId, rows: term.rows, cols: term.cols } as any).catch(() => {})
      }
    }

    setTimeout(handleResize, 100)

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(handleResize, 100)
    })
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [isActive, initialized, tab.sessionId])

  return (
    <div
      ref={terminalRef}
      className="w-full h-full"
      style={{ display: isActive ? 'block' : 'none' }}
    />
  )
}

const Terminal: React.FC = () => {
  const {
    terminalTabs,
    activeTerminalTabId,
    addTerminalTab,
    removeTerminalTab,
    setActiveTerminalTab,
  } = useTerminalTabStore()

  const handleAddTab = async () => {
    if (terminalTabs.length === 0) {
      return
    }
    const activeTab = terminalTabs.find((t) => t.id === activeTerminalTabId)
    if (!activeTab || !activeTab.sessionId) return

    try {
      const result = await CreateShell({ baseSessionId: activeTab.sessionId })
      if (result.success && result.sessionId) {
        const newTab: TerminalTab = {
          id: `${activeTab.serverId}-${Date.now()}`,
          serverId: activeTab.serverId,
          sessionId: result.sessionId,
          label: `${activeTab.serverName} #${terminalTabs.filter(t => t.serverId === activeTab.serverId).length + 1}`,
          serverName: activeTab.serverName,
          connected: true,
        }
        addTerminalTab(newTab)
      }
    } catch (e) {
      console.error('CreateShell error:', e)
    }
  }

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeTerminalTab(tabId)
  }

  const handleTabClick = (tabId: string) => {
    setActiveTerminalTab(tabId)
  }

  if (terminalTabs.length === 0) {
    return (
      <div className="w-full h-full bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <div className="text-4xl mb-4">⌨</div>
          <div>选择左侧服务器开始连接</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[#0a0a0a] flex flex-col">
      <div className="flex bg-[#1a1a1a] border-b border-[#333] h-9 shrink-0">
        {terminalTabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`
              flex items-center gap-2 px-3 h-full cursor-pointer
              border-r border-[#333] min-w-[120px] max-w-[200px]
              ${tab.id === activeTerminalTabId ? 'bg-[#0a0a0a] text-white' : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525]'}
            `}
          >
            <span className="truncate flex-1 text-sm">{tab.label}</span>
            <button
              onClick={(e) => handleCloseTab(tab.id, e)}
              className="text-gray-500 hover:text-white px-1 rounded hover:bg-[#333] text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={handleAddTab}
          className="px-3 h-full text-gray-500 hover:text-white hover:bg-[#252525] text-lg"
          title="新建标签"
        >
          +
        </button>
      </div>
      <div className="flex-1 relative">
        {terminalTabs.map((tab) => (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{ display: tab.id === activeTerminalTabId ? 'block' : 'none' }}
          >
            <TerminalInstance tab={tab} isActive={tab.id === activeTerminalTabId} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default Terminal
