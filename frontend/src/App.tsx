import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import VncViewer from './components/VncViewer'
import FileManager from './components/FileManager'
import StatusBar from './components/StatusBar'
import AddServerDialog from './components/AddServerDialog'
import MonitorPanel from './components/MonitorPanel'
import CommandPalette, { usePaletteStore } from './components/CommandPalette'
import { DialogProvider } from './components/Dialog'
import { useUIStore, useConnectionStore, useTerminalTabStore } from './stores/ui'
import { useEffect, useRef, useState, useCallback } from 'react'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'

function App() {
  const { activeTab, theme, setTheme } = useUIStore()
  const { connections } = useConnectionStore()
  const registeredRef = useRef<Set<string>>(new Set())
  const togglePalette = usePaletteStore((s) => s.toggle)
  const [leftWidth, setLeftWidth] = useState(280)
  const [bottomHeight, setBottomHeight] = useState(220)
  const draggingRef = useRef<{ type: 'h' | 'v'; startX: number; startY: number; startVal: number } | null>(null)

  useEffect(() => {
    const newlyRegistered: string[] = []

    Object.entries(connections).forEach(([_serverId, conn]) => {
      const sid = conn.sessionId
      if (registeredRef.current.has(sid)) return
      registeredRef.current.add(sid)
      newlyRegistered.push(sid)

      const handleKeepalive = (data: any) => {
        if (data && typeof data.latency === 'number') useUIStore.getState().setLatency(data.latency)
      }
      const handleKeepaliveFailed = () => useUIStore.getState().setLatency(-1)
      const handleDisconnected = (data: any) => {
        if (!data?.sessionId) return
        const connStore = useConnectionStore.getState()
        let disconnectedServerId: string | null = null
        Object.entries(connStore.connections).forEach(([sid2, c]) => {
          if (c.sessionId === data.sessionId) disconnectedServerId = sid2
        })
        if (!disconnectedServerId) return
        if (connStore.sftpSessions[disconnectedServerId]) useConnectionStore.getState().removeSftpSession(disconnectedServerId)
        useConnectionStore.getState().removeConnection(disconnectedServerId)
        const tabStore = useTerminalTabStore.getState()
        tabStore.terminalTabs.filter(t => t.serverId === disconnectedServerId).forEach(t => tabStore.removeTerminalTab(t.id))
        if (useUIStore.getState().activeServerId === disconnectedServerId) useUIStore.getState().setActiveServerId(null)
        useUIStore.getState().setStatusMessage(`连接已断开: ${data.error || '未知错误'}`)
        useUIStore.getState().setLatency(0)
        EventsOff(`ssh:${data.sessionId}:keepalive`)
        EventsOff(`ssh:${data.sessionId}:keepalive:failed`)
        EventsOff(`ssh:${data.sessionId}:disconnected`)
        registeredRef.current.delete(data.sessionId)
      }

      EventsOn(`ssh:${sid}:keepalive`, handleKeepalive)
      EventsOn(`ssh:${sid}:keepalive:failed`, handleKeepaliveFailed)
      EventsOn(`ssh:${sid}:disconnected`, handleDisconnected)
    })

    const staleIds: string[] = []
    registeredRef.current.forEach((sid) => {
      let found = false
      Object.values(connections).forEach((c) => { if (c.sessionId === sid) found = true })
      if (!found) staleIds.push(sid)
    })
    staleIds.forEach((sid) => {
      EventsOff(`ssh:${sid}:keepalive`)
      EventsOff(`ssh:${sid}:keepalive:failed`)
      EventsOff(`ssh:${sid}:disconnected`)
      registeredRef.current.delete(sid)
    })

    return () => {
      newlyRegistered.forEach((sid) => {
        EventsOff(`ssh:${sid}:keepalive`)
        EventsOff(`ssh:${sid}:keepalive:failed`)
        EventsOff(`ssh:${sid}:disconnected`)
        registeredRef.current.delete(sid)
      })
    }
  }, [connections])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        togglePalette()
        return
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') { e.preventDefault(); useUIStore.getState().toggleSidebar() }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePalette])

  useEffect(() => {
    const handleMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      const d = draggingRef.current
      if (d.type === 'h') {
        const delta = ev.clientX - d.startX
        setLeftWidth(Math.max(200, Math.min(d.startVal + delta, 500)))
      } else {
        const delta = d.startY - ev.clientY
        setBottomHeight(Math.max(120, Math.min(d.startVal + delta, 500)))
      }
    }
    const handleUp = () => { draggingRef.current = null }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  const startDragH = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = { type: 'h', startX: e.clientX, startY: 0, startVal: leftWidth }
  }, [leftWidth])

  const startDragV = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = { type: 'v', startX: 0, startY: e.clientY, startVal: bottomHeight }
  }, [bottomHeight])

  const isTerminal = activeTab === 'terminal'

  return (
    <DialogProvider>
    <div className="flex flex-col h-screen w-screen bg-surface-400 text-text overflow-hidden select-none">
      <div className="h-10 flex items-center px-4 border-b border-border/30 flex-shrink-0 bg-surface-400">
        <div className="flex items-center gap-1">
          <button
            className={`px-3 py-1 text-xs rounded-md transition-all ${isTerminal ? 'text-primary-500 bg-primary-500/10 font-medium' : 'text-text-dim hover:text-text-muted'}`}
            onClick={() => useUIStore.getState().setActiveTab('terminal')}
          >终端</button>
          <button
            className={`px-3 py-1 text-xs rounded-md transition-all ${!isTerminal ? 'text-primary-500 bg-primary-500/10 font-medium' : 'text-text-dim hover:text-text-muted'}`}
            onClick={() => useUIStore.getState().setActiveTab('vnc')}
          >VNC 远程桌面</button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="p-1.5 rounded-md text-text-dim hover:text-text-muted hover:bg-surface-500/50 transition-colors"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? '切换浅色主题' : '切换深色主题'}
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {isTerminal ? (
          <>
            <div className="flex flex-col flex-shrink-0" style={{ width: leftWidth }}>
              <div className="flex-1 overflow-hidden">
                <Sidebar />
              </div>
              <div
                className="h-2 cursor-row-resize flex-shrink-0 flex items-center justify-center hover:bg-primary-500/15 transition-colors group"
                onMouseDown={startDragV}
              >
                <div className="w-10 h-[2px] rounded-full bg-border/40 group-hover:bg-primary-400/60 transition-colors" />
              </div>
              <div className="overflow-hidden flex-shrink-0 border-t border-border/15" style={{ height: bottomHeight }}>
                <MonitorPanel />
              </div>
            </div>

            <div
              className="w-2 cursor-col-resize flex-shrink-0 flex items-center justify-center hover:bg-primary-500/15 transition-colors group"
              onMouseDown={startDragH}
            >
              <div className="w-[2px] h-10 rounded-full bg-border/40 group-hover:bg-primary-400/60 transition-colors" />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <Terminal />
              </div>
              <div
                className="h-2 cursor-row-resize flex-shrink-0 flex items-center justify-center hover:bg-primary-500/15 transition-colors group"
                onMouseDown={startDragV}
              >
                <div className="w-10 h-[2px] rounded-full bg-border/40 group-hover:bg-primary-400/60 transition-colors" />
              </div>
              <div className="overflow-hidden flex-shrink-0 border-t border-border/15" style={{ height: bottomHeight }}>
                <FileManager />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden">
            <VncViewer />
          </div>
        )}
      </div>

      <div className="h-8 bg-surface-500/30 border-t border-border/30 flex items-center px-4 flex-shrink-0">
        <StatusBar />
      </div>

      <AddServerDialog />
      <CommandPalette />
    </div>
    </DialogProvider>
  )
}

export default App
