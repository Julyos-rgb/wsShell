import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import VncViewer from './components/VncViewer'
import FileManager from './components/FileManager'
import StatusBar from './components/StatusBar'
import AddServerDialog from './components/AddServerDialog'
import MonitorPanel from './components/MonitorPanel'
import DockerManager from './components/DockerManager'
import NetworkMonitor from './components/NetworkMonitor'
import NetworkTools from './components/NetworkTools'
import CommandPalette, { usePaletteStore } from './components/CommandPalette'
import { DialogProvider } from './components/Dialog'
import { useUIStore, useConnectionStore, useTerminalTabStore } from './stores/ui'
import { useEffect, useRef, useState, useCallback } from 'react'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'

type MainTab = 'terminal' | 'vnc'
type ToolTab = 'monitor' | 'network' | 'docker' | 'tools'

const mainTabs: { id: MainTab; label: string }[] = [
  { id: 'terminal', label: '终端' },
  { id: 'vnc', label: 'VNC' },
]

const toolTabs: { id: ToolTab; label: string; icon: JSX.Element }[] = [
  {
    id: 'monitor', label: '监控',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  },
  {
    id: 'docker', label: 'Docker',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" /></svg>,
  },
  {
    id: 'network', label: '网络',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>,
  },
  {
    id: 'tools', label: '工具',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1 3.03a.75.75 0 01-1.09-.8l1.22-5.73-4.4-3.72a.75.75 0 01.43-1.32l5.85-.43 2.23-5.36a.75.75 0 011.38 0l2.23 5.36 5.85.43a.75.75 0 01.43 1.32l-4.4 3.72 1.22 5.73a.75.75 0 01-1.09.8l-5.1-3.03a.75.75 0 00-.78 0z" /></svg>,
  },
]

function App() {
  const { activeTab, activeToolTab, filePanelOpen, theme, setTheme, toggleFilePanel, setActiveToolTab } = useUIStore()
  const { connections } = useConnectionStore()
  const registeredRef = useRef<Set<string>>(new Set())
  const togglePalette = usePaletteStore((s) => s.toggle)
  const [filePanelHeight, setFilePanelHeight] = useState(280)
  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  useEffect(() => {
    const newlyRegistered: string[] = []

    Object.entries(connections).forEach(([_serverId, conn]) => {
      const sid = conn.sessionId

      if (registeredRef.current.has(sid)) return
      registeredRef.current.add(sid)
      newlyRegistered.push(sid)

      const handleKeepalive = (data: any) => {
        if (data && typeof data.latency === 'number') {
          useUIStore.getState().setLatency(data.latency)
        }
      }

      const handleKeepaliveFailed = () => {
        useUIStore.getState().setLatency(-1)
      }

      const handleDisconnected = (data: any) => {
        if (!data?.sessionId) return

        const connStore = useConnectionStore.getState()
        let disconnectedServerId: string | null = null
        Object.entries(connStore.connections).forEach(([sid2, c]) => {
          if (c.sessionId === data.sessionId) {
            disconnectedServerId = sid2
          }
        })

        if (!disconnectedServerId) return

        if (connStore.sftpSessions[disconnectedServerId]) {
          useConnectionStore.getState().removeSftpSession(disconnectedServerId)
        }
        useConnectionStore.getState().removeConnection(disconnectedServerId)

        const tabStore = useTerminalTabStore.getState()
        tabStore.terminalTabs
          .filter(t => t.serverId === disconnectedServerId)
          .forEach(t => tabStore.removeTerminalTab(t.id))

        if (useUIStore.getState().activeServerId === disconnectedServerId) {
          useUIStore.getState().setActiveServerId(null)
        }

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
      Object.values(connections).forEach((c) => {
        if (c.sessionId === sid) found = true
      })
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
        if (e.key === '1') {
          e.preventDefault()
          useUIStore.getState().setActiveTab('terminal')
        } else if (e.key === '2') {
          e.preventDefault()
          useUIStore.getState().setActiveTab('vnc')
        } else if (e.key === 'e') {
          e.preventDefault()
          useUIStore.getState().toggleFilePanel()
        } else if (e.key === 'b') {
          e.preventDefault()
          useUIStore.getState().toggleSidebar()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePalette])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    startYRef.current = e.clientY
    startHeightRef.current = filePanelHeight

    const handleMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return
      const delta = startYRef.current - ev.clientY
      const newHeight = Math.max(120, Math.min(startHeightRef.current + delta, 600))
      setFilePanelHeight(newHeight)
    }

    const handleUp = () => {
      draggingRef.current = false
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [filePanelHeight])

  const showToolPanel = activeToolTab !== null

  return (
    <DialogProvider>
    <div className="flex flex-col h-screen w-screen bg-surface-400 text-text overflow-hidden">
      <div className="h-9 bg-surface-400 flex items-center px-3 flex-shrink-0 border-b border-border/40">
        <div className="flex items-center gap-0.5">
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${activeTab === tab.id ? 'text-primary-500 bg-primary-500/10' : 'text-text-dim hover:text-text-muted'}`}
              onClick={() => useUIStore.getState().setActiveTab(tab.id)}
            >{tab.label}</button>
          ))}
          {activeTab === 'terminal' && (
            <button
              className={`px-2.5 py-1 text-xs rounded transition-colors ml-1 ${filePanelOpen ? 'text-primary-500 bg-primary-500/10' : 'text-text-dim hover:text-text-muted'}`}
              onClick={toggleFilePanel}
              title="文件管理器 (Ctrl+E)"
            >
              文件
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center">
          <button
            className="p-1.5 rounded text-text-dim hover:text-text transition-colors"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          >
            {theme === 'dark' ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-shrink-0">
          <Sidebar />
          <div className="flex flex-col border-t border-border/30 bg-surface-400">
            {toolTabs.map((tool) => (
              <button
                key={tool.id}
                className={`w-10 h-9 flex items-center justify-center transition-colors ${
                  activeToolTab === tool.id
                    ? 'text-primary-400 bg-primary-500/10'
                    : 'text-text-dim hover:text-text-muted hover:bg-surface-50/30'
                }`}
                onClick={() => setActiveToolTab(tool.id)}
                title={tool.label}
              >
                {tool.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {showToolPanel ? (
            <div className="absolute inset-0 flex" style={{ display: 'flex' }}>
              <div className="flex-1 flex flex-col overflow-hidden">
                {activeTab === 'terminal' ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-hidden">
                      <Terminal />
                    </div>
                    {filePanelOpen && (
                      <>
                        <div
                          className="h-1.5 cursor-row-resize flex-shrink-0 bg-surface-500 hover:bg-primary-500/30 transition-colors flex items-center justify-center group"
                          onMouseDown={handleDragStart}
                        >
                          <div className="w-8 h-0.5 rounded-full bg-text-dim/20 group-hover:bg-primary-400/50 transition-colors" />
                        </div>
                        <div className="flex-shrink-0 overflow-hidden" style={{ height: filePanelHeight }}>
                          <FileManager />
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 overflow-hidden">
                    <VncViewer />
                  </div>
                )}
              </div>
              <div className="w-72 border-l border-border/40 flex-shrink-0 overflow-hidden flex flex-col bg-surface-300/50">
                <div className="h-8 flex items-center px-3 border-b border-border/30 flex-shrink-0">
                  <span className="text-xs font-medium text-text">
                    {toolTabs.find(t => t.id === activeToolTab)?.label}
                  </span>
                  <button
                    className="ml-auto p-0.5 text-text-dim hover:text-text transition-colors"
                    onClick={() => setActiveToolTab(null)}
                    title="关闭"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  {activeToolTab === 'monitor' && <MonitorPanel />}
                  {activeToolTab === 'docker' && <DockerManager />}
                  {activeToolTab === 'network' && <NetworkMonitor />}
                  {activeToolTab === 'tools' && <NetworkTools />}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="absolute inset-0" style={{ display: activeTab === 'terminal' ? 'flex' : 'none', flexDirection: 'column' }}>
                <div className="flex-1 overflow-hidden">
                  <Terminal />
                </div>
                {filePanelOpen && activeTab === 'terminal' && (
                  <>
                    <div
                      className="h-1.5 cursor-row-resize flex-shrink-0 bg-surface-500 hover:bg-primary-500/30 transition-colors flex items-center justify-center group"
                      onMouseDown={handleDragStart}
                    >
                      <div className="w-8 h-0.5 rounded-full bg-text-dim/20 group-hover:bg-primary-400/50 transition-colors" />
                    </div>
                    <div className="flex-shrink-0 overflow-hidden" style={{ height: filePanelHeight }}>
                      <FileManager />
                    </div>
                  </>
                )}
              </div>
              <div className="absolute inset-0" style={{ display: activeTab === 'vnc' ? 'flex' : 'none', flexDirection: 'column' }}>
                <VncViewer />
              </div>
            </>
          )}
        </div>
      </div>

      <StatusBar />
      <AddServerDialog />
      <CommandPalette />
    </div>
    </DialogProvider>
  )
}

export default App
