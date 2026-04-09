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

type ToolTab = 'monitor' | 'network' | 'docker' | 'tools'

const toolTabs: { id: ToolTab; label: string; icon: JSX.Element }[] = [
  {
    id: 'monitor', label: '系统监控',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  },
  {
    id: 'docker', label: 'Docker',
    icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor"><path d="M13.98 11.08h2.12a.19.19 0 00.19-.19V9.01a.19.19 0 00-.19-.19h-2.12a.19.19 0 00-.19.19v1.88c0 .1.09.19.19.19m-2.95-5.43h2.12a.19.19 0 00.19-.19V3.58a.19.19 0 00-.19-.19h-2.12a.19.19 0 00-.19.19v1.88c0 .1.08.19.19.19m0 2.71h2.12a.19.19 0 00.19-.19V6.29a.19.19 0 00-.19-.19h-2.12a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19m-2.93 0h2.12a.19.19 0 00.19-.19V6.29a.19.19 0 00-.19-.19H8.1a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19m-2.96 0h2.12a.19.19 0 00.19-.19V6.29a.19.19 0 00-.19-.19H5.14a.19.19 0 00-.19.19v1.88c0 .11.09.19.19.19m5.89 2.72h2.12a.19.19 0 00.19-.19V9.01a.19.19 0 00-.19-.19h-2.12a.19.19 0 00-.19.19v1.88c0 .1.08.19.19.19m-2.93 0h2.12a.19.19 0 00.19-.19V9.01a.19.19 0 00-.19-.19H8.1a.19.19 0 00-.19.19v1.88c0 .1.08.19.19.19m-2.96 0h2.12a.19.19 0 00.19-.19V9.01a.19.19 0 00-.19-.19H5.14a.19.19 0 00-.19.19v1.88c0 .1.09.19.19.19M23 12.28a4.64 4.64 0 00-2.47-2.32 3.37 3.37 0 00-2.12.14 4.33 4.33 0 00-1.81-.84 10.38 10.38 0 00-.4-2.57 7.77 7.77 0 00-2.1 1.58 6.09 6.09 0 00-1.77-2.49 7.54 7.54 0 00-1.07 2.87A5.37 5.37 0 008.1 6.64a8.78 8.78 0 00.28 3.37A3.81 3.81 0 006 11.56 4.64 4.64 0 001 12.28c0 4.58 4.46 8.32 9.95 8.68V23h2.1v-2.04c5.49-.36 9.95-4.1 9.95-8.68" /></svg>,
  },
  {
    id: 'network', label: '网络监控',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>,
  },
  {
    id: 'tools', label: '网络工具',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1 3.03a.75.75 0 01-1.09-.8l1.22-5.73-4.4-3.72a.75.75 0 01.43-1.32l5.85-.43 2.23-5.36a.75.75 0 011.38 0l2.23 5.36 5.85.43a.75.75 0 01.43 1.32l-4.4 3.72 1.22 5.73a.75.75 0 01-1.09.8l-5.1-3.03a.75.75 0 00-.78 0z" /></svg>,
  },
]

function App() {
  const { activeTab, activeToolTab, filePanelOpen, theme, setTheme, setActiveToolTab } = useUIStore()
  const { connections } = useConnectionStore()
  const registeredRef = useRef<Set<string>>(new Set())
  const togglePalette = usePaletteStore((s) => s.toggle)
  const [filePanelHeight, setFilePanelHeight] = useState(240)
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
        if (e.key === 'e') {
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
  const isTerminal = activeTab === 'terminal'

  return (
    <DialogProvider>
    <div className="flex h-screen w-screen bg-surface-400 text-text overflow-hidden">
      <div className="flex flex-col flex-shrink-0 h-full">
        <Sidebar />
        <div className="border-t border-border/20">
          {toolTabs.map((tool) => (
            <button
              key={tool.id}
              className={`w-[inherit] h-10 flex items-center justify-center transition-all duration-150 ${
                activeToolTab === tool.id
                  ? 'text-primary-500 bg-primary-500/8'
                  : 'text-text-dim/60 hover:text-text-muted hover:bg-surface-50/20'
              }`}
              onClick={() => setActiveToolTab(tool.id)}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
          <div className="h-px mx-2 bg-border/20 my-0.5" />
          <button
            className={`w-[inherit] h-10 flex items-center justify-center transition-all duration-150 ${
              !isTerminal
                ? 'text-primary-500 bg-primary-500/8'
                : 'text-text-dim/60 hover:text-text-muted hover:bg-surface-50/20'
            }`}
            onClick={() => useUIStore.getState().setActiveTab(isTerminal ? 'vnc' : 'terminal')}
            title={isTerminal ? 'VNC 远程桌面' : 'SSH 终端'}
          >
            {isTerminal ? (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" /></svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" /></svg>
            )}
          </button>
          <button
            className={`w-[inherit] h-10 flex items-center justify-center transition-all duration-150 text-text-dim/60 hover:text-text-muted hover:bg-surface-50/20`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? '浅色主题' : '深色主题'}
          >
            {theme === 'dark' ? (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col" style={{ display: isTerminal ? 'flex' : 'none' }}>
              <div className="flex-1 overflow-hidden">
                <Terminal />
              </div>
              {isTerminal && (
                <>
                  <div
                    className="h-[3px] cursor-row-resize flex-shrink-0 hover:bg-primary-500/20 transition-colors relative group"
                    onMouseDown={handleDragStart}
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-border/30 group-hover:bg-primary-400/40" />
                  </div>
                  <div
                    className="flex-shrink-0 overflow-hidden border-t border-border/10"
                    style={{ height: filePanelOpen ? filePanelHeight : 0, transition: filePanelOpen ? 'none' : 'height 0.2s ease' }}
                  >
                    <FileManager />
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 overflow-hidden" style={{ display: isTerminal ? 'none' : 'flex' }}>
              <VncViewer />
            </div>
          </div>

          {showToolPanel && (
            <div className="w-80 border-l border-border/20 flex-shrink-0 flex flex-col bg-surface-300/30">
              <div className="h-10 flex items-center px-4 border-b border-border/15 flex-shrink-0">
                <span className="text-xs font-medium text-text-muted tracking-wide">
                  {toolTabs.find(t => t.id === activeToolTab)?.label}
                </span>
                <button
                  className="ml-auto p-1 rounded text-text-dim/50 hover:text-text-dim hover:bg-surface-500/30 transition-colors"
                  onClick={() => setActiveToolTab(null)}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
          )}
        </div>

        <StatusBar />
      </div>

      <AddServerDialog />
      <CommandPalette />
    </div>
    </DialogProvider>
  )
}

export default App
