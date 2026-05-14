import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import VncViewer from './components/VncViewer'
import FileManager from './components/FileManager'
import StatusBar from './components/StatusBar'
import AddServerDialog from './components/AddServerDialog'
import MonitorPanel from './components/MonitorPanel'
import CommandPalette, { usePaletteStore } from './components/CommandPalette'
import { DialogProvider } from './components/Dialog'
import { ToastProvider } from './components/Toast'
import { useUIStore, useConnectionStore, useTerminalTabStore } from './stores/ui'
import { useEffect, useRef, useState, useCallback } from 'react'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'

function App() {
  const { activeTab, theme, setTheme, sidebarCollapsed } = useUIStore()
  const { connections } = useConnectionStore()
  const registeredRef = useRef<Set<string>>(new Set())
  const togglePalette = usePaletteStore((s) => s.toggle)
  const [leftRatio, setLeftRatio] = useState(0.2)
  const [leftTopRatio, setLeftTopRatio] = useState(0.65)
  const [rightTopRatio, setRightTopRatio] = useState(0.55)
  const [filePanelVisible, setFilePanelVisible] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftColRef = useRef<HTMLDivElement>(null)
  const rightColRef = useRef<HTMLDivElement>(null)

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

  const startDragCol = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    let moved = false

    const onMove = (ev: MouseEvent) => {
      if (!moved) {
        if (Math.abs(ev.clientX - startX) < 3) return
        moved = true
      }
      const container = containerRef.current
      if (!container) return
      const ratio = (ev.clientX - container.getBoundingClientRect().left) / container.getBoundingClientRect().width
      setLeftRatio(Math.max(0.08, Math.min(0.45, ratio)))
    }
    const onUp = () => {
      if (!moved) useUIStore.getState().toggleSidebar()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [leftRatio])

  const startDragLeftRow = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    let moved = false

    const onMove = (ev: MouseEvent) => {
      if (!moved) {
        if (Math.abs(ev.clientY - startY) < 3) return
        moved = true
      }
      const col = leftColRef.current
      if (!col) return
      const r = col.getBoundingClientRect()
      const ratio = (ev.clientY - r.top) / r.height
      setLeftTopRatio(Math.max(0.2, Math.min(0.8, ratio)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [leftTopRatio])

  const startDragRightRow = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    let moved = false
    const HANDLE_H = 12

    const onMove = (ev: MouseEvent) => {
      if (!moved) {
        if (Math.abs(ev.clientY - startY) < 3) return
        moved = true
      }
      const c = rightColRef.current
      if (!c) return
      const r = c.getBoundingClientRect()
      const available = r.height - HANDLE_H
      if (available <= 0) return
      const y = ev.clientY - r.top
      const ratio = Math.max(0.15, Math.min(0.85, (y - HANDLE_H / 2) / available))
      setRightTopRatio(ratio)
    }
    const onUp = () => {
      if (!moved) setFilePanelVisible(v => !v)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const isTerminal = activeTab === 'terminal'

  return (
    <DialogProvider>
    <ToastProvider>
    <div className="flex flex-col h-screen w-screen bg-surface-400 text-text overflow-hidden select-none">
      <div className="h-11 flex items-center px-4 flex-shrink-0 bg-surface-400/90 backdrop-blur-xl">
        <div className="flex items-center bg-surface-50/80 rounded-xl p-0.5">
          <button
            className={`px-5 py-1 text-xs rounded-lg transition-all duration-200 ${isTerminal ? 'bg-surface-400 text-primary-500 font-semibold shadow-sm' : 'text-text-dim'}`}
            onClick={() => useUIStore.getState().setActiveTab('terminal')}
          >终端</button>
          <button
            className={`px-5 py-1 text-xs rounded-lg transition-all duration-200 ${!isTerminal ? 'bg-surface-400 text-primary-500 font-semibold shadow-sm' : 'text-text-dim'}`}
            onClick={() => useUIStore.getState().setActiveTab('vnc')}
          >VNC 远程桌面</button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="p-2 rounded-xl text-text-dim hover:text-text-muted hover:bg-surface-50/50 transition-colors"
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

      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center justify-center w-10 bg-surface-400 border-r border-border/30 flex-shrink-0">
            <button
              className="p-2 rounded text-text-dim hover:text-text hover:bg-surface-500/50 transition-colors"
              onClick={() => useUIStore.getState().toggleSidebar()}
              title="展开侧栏"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div
              ref={leftColRef}
              className="flex flex-col overflow-hidden"
              style={{ flex: `${leftRatio} 0 0` }}
            >
              <div className="overflow-hidden min-h-0" style={{ flex: `${leftTopRatio} 0 0` }}>
                <Sidebar />
              </div>
              <div
                className="h-1.5 cursor-row-resize flex-shrink-0 flex items-center justify-center hover:bg-primary-500/8 transition-colors group"
                onMouseDown={startDragLeftRow}
              >
                <div className="w-8 h-[2px] rounded-full bg-border/40 group-hover:bg-primary-400/60 transition-colors" />
              </div>
              <div className="overflow-hidden min-h-0 border-t border-border/15" style={{ flex: `${1 - leftTopRatio} 0 0` }}>
                <MonitorPanel />
              </div>
            </div>

            <div
              className="w-3 cursor-col-resize flex-shrink-0 flex items-center justify-center hover:bg-primary-500/8 transition-colors group relative"
              onMouseDown={startDragCol}
            >
              <div className="w-[2px] h-10 rounded-full bg-border/40 group-hover:bg-primary-400/60 transition-colors" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 p-0.5 text-text-dim/30 group-hover:text-text-dim/60 transition-all">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                </svg>
              </div>
            </div>
          </>
        )}

        <div
          ref={rightColRef}
          className="min-w-0 min-h-0 overflow-hidden"
          style={{
            flex: sidebarCollapsed ? '1 1 0' : `${1 - leftRatio} 1 0`,
            display: isTerminal && filePanelVisible ? 'grid' : 'flex',
            flexDirection: 'column',
            gridTemplateRows: isTerminal && filePanelVisible
              ? `${rightTopRatio}fr 12px ${1 - rightTopRatio}fr`
              : undefined,
          }}
        >
          <div
            className="min-h-0 overflow-hidden border-b border-border/20"
            style={{
              ...(!isTerminal ? { display: 'none' } : filePanelVisible ? {} : { flex: '1 1 0' }),
            }}
          >
            <Terminal />
          </div>
          <div
            className="cursor-row-resize flex items-center justify-center hover:bg-primary-500/8 transition-colors group relative"
            style={{ display: isTerminal && filePanelVisible ? undefined : 'none' }}
            onMouseDown={startDragRightRow}
          >
            <div className="w-12 h-[2px] rounded-full bg-border/30 group-hover:bg-primary-400/70 transition-colors" />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-text-dim/30 group-hover:text-text-dim/60 transition-all">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
              </svg>
            </div>
          </div>
          <div
            className="flex-shrink-0 flex items-center justify-center hover:bg-primary-500/8 transition-colors group cursor-pointer"
            style={{ height: '12px', display: isTerminal && !filePanelVisible ? undefined : 'none' }}
            onClick={() => setFilePanelVisible(true)}
          >
            <div className="text-text-dim/30 group-hover:text-text-dim/60 transition-all">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </div>
          </div>
          <div
            className="min-h-0 overflow-hidden border-t border-border/20"
            style={{ display: isTerminal && filePanelVisible ? undefined : 'none' }}
          >
            <FileManager />
          </div>
          <div
            className="flex-1 min-h-0 overflow-hidden"
            style={{ display: isTerminal ? 'none' : undefined }}
          >
            <VncViewer />
          </div>
        </div>
      </div>

      <div className="h-7 bg-surface-400/80 backdrop-blur-xl border-t border-border/30 flex items-center px-4 flex-shrink-0">
        <StatusBar />
      </div>

      <AddServerDialog />
      <CommandPalette />
    </div>
    </ToastProvider>
    </DialogProvider>
  )
}

export default App
