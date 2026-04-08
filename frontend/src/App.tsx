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
      <div className="h-9 bg-surface-400 flex items-center px-3 flex-shrink-0 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-danger/80" />
          <div className="w-3 h-3 rounded-full bg-accent-yellow/80" />
          <div className="w-3 h-3 rounded-full bg-accent-green/80" />
        </div>
        <span className="text-xs text-text-dim ml-3 font-medium">wsShell</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'terminal' ? 'text-primary-300 bg-primary-500/10' : 'text-text-dim hover:text-text-muted'}`}
            onClick={() => useUIStore.getState().setActiveTab('terminal')}
          >终端</button>
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'vnc' ? 'text-primary-300 bg-primary-500/10' : 'text-text-dim hover:text-text-muted'}`}
            onClick={() => useUIStore.getState().setActiveTab('vnc')}
          >VNC</button>
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'file' ? 'text-primary-300 bg-primary-500/10' : 'text-text-dim hover:text-text-muted'}`}
            onClick={() => useUIStore.getState().setActiveTab('file')}
          >文件</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-hidden">
          {activeTab === 'terminal' && <Terminal />}
          {activeTab === 'vnc' && <VncViewer />}
          {activeTab === 'file' && <FileManager />}
        </div>
      </div>

      <StatusBar />
      <AddServerDialog />
    </div>
  )
}

export default App
