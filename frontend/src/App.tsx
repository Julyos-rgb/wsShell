import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import VncViewer from './components/VncViewer'
import FileManager from './components/FileManager'
import StatusBar from './components/StatusBar'
import AddServerDialog from './components/AddServerDialog'
import { useUIStore, useConnectionStore } from './stores/ui'
import { useEffect } from 'react'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'

function App() {
  const { activeTab, activeServerId } = useUIStore()
  const { connections } = useConnectionStore()

  useEffect(() => {
    if (!activeServerId) return
    const conn = connections.get(activeServerId)
    if (!conn) return

    const sessionId = conn.sessionId

    const handleKeepalive = (data: any) => {
      if (data && typeof data.latency === 'number') {
        useUIStore.getState().setLatency(data.latency)
      }
    }

    const handleKeepaliveFailed = (_data: any) => {
      useUIStore.getState().setLatency(-1)
    }

    const handleDisconnected = (data: any) => {
      if (data?.sessionId) {
        useUIStore.getState().setStatusMessage(`连接已断开: ${data.error || '未知错误'}`)
        useUIStore.getState().setLatency(0)
      }
    }

    EventsOn(`ssh:${sessionId}:keepalive`, handleKeepalive)
    EventsOn(`ssh:${sessionId}:keepalive:failed`, handleKeepaliveFailed)
    EventsOn(`ssh:${sessionId}:disconnected`, handleDisconnected)

    return () => {
      EventsOff(`ssh:${sessionId}:keepalive`)
      EventsOff(`ssh:${sessionId}:keepalive:failed`)
      EventsOff(`ssh:${sessionId}:disconnected`)
    }
  }, [activeServerId, connections])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault()
            useUIStore.getState().setActiveTab('terminal')
            break
          case '2':
            e.preventDefault()
            useUIStore.getState().setActiveTab('vnc')
            break
          case '3':
            e.preventDefault()
            useUIStore.getState().setActiveTab('file')
            break
          case 'b':
            e.preventDefault()
            useUIStore.getState().toggleSidebar()
            break
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen bg-surface-400 text-text overflow-hidden">
      <div className="glass-panel px-4 py-1 flex items-center justify-between flex-shrink-0 rounded-none border-x-0 border-t-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-danger/80 hover:bg-danger transition-colors cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-accent-yellow/80 hover:bg-accent-yellow transition-colors cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-accent-green/80 hover:bg-accent-green transition-colors cursor-pointer" />
          </div>
          <span className="text-xs text-text-dim font-medium ml-2 tracking-wider uppercase">wsShell</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-dim">
          <span className="flex items-center gap-1.5">
            <span className={`status-dot ${activeServerId ? 'status-dot-connected' : 'status-dot-disconnected'}`} />
            {activeServerId ? '已连接' : '未连接'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-surface-400 flex border-b border-border flex-shrink-0">
            <button
              className={`tab-btn ${activeTab === 'terminal' ? 'tab-btn-active' : 'text-text-dim hover:text-text-muted'}`}
              onClick={() => useUIStore.getState().setActiveTab('terminal')}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                终端
              </span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'vnc' ? 'tab-btn-active' : 'text-text-dim hover:text-text-muted'}`}
              onClick={() => useUIStore.getState().setActiveTab('vnc')}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                VNC
              </span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'file' ? 'tab-btn-active' : 'text-text-dim hover:text-text-muted'}`}
              onClick={() => useUIStore.getState().setActiveTab('file')}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                文件
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'terminal' && <Terminal />}
            {activeTab === 'vnc' && <VncViewer />}
            {activeTab === 'file' && <FileManager />}
          </div>
        </div>
      </div>

      <StatusBar />
      <AddServerDialog />
    </div>
  )
}

export default App
