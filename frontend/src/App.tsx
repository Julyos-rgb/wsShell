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
import { useEffect, useRef } from 'react'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'

type TabId = 'terminal' | 'vnc' | 'file' | 'monitor' | 'network' | 'docker' | 'tools'

const tabs: { id: TabId; label: string; shortcut: string }[] = [
  { id: 'terminal', label: '终端', shortcut: '1' },
  { id: 'vnc', label: 'VNC', shortcut: '2' },
  { id: 'file', label: '文件', shortcut: '3' },
  { id: 'monitor', label: '监控', shortcut: '4' },
  { id: 'network', label: '网络', shortcut: '5' },
  { id: 'docker', label: 'Docker', shortcut: '6' },
  { id: 'tools', label: '工具', shortcut: '7' },
]

function App() {
  const { activeTab } = useUIStore()
  const { connections } = useConnectionStore()
  const registeredRef = useRef<Set<string>>(new Set())
  const togglePalette = usePaletteStore((s) => s.toggle)

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
        const tabMap: Record<string, TabId> = {
          '1': 'terminal', '2': 'vnc', '3': 'file',
          '4': 'monitor', '5': 'network', '6': 'docker', '7': 'tools',
        }
        if (tabMap[e.key]) {
          e.preventDefault()
          useUIStore.getState().setActiveTab(tabMap[e.key])
          return
        }
        if (e.key === 'b') {
          e.preventDefault()
          useUIStore.getState().toggleSidebar()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePalette])

  return (
    <DialogProvider>
    <div className="flex flex-col h-screen w-screen bg-surface-400 text-text overflow-hidden">
      <div className="h-9 bg-surface-400 flex items-center px-3 flex-shrink-0 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-danger/80" />
          <div className="w-3 h-3 rounded-full bg-accent-yellow/80" />
          <div className="w-3 h-3 rounded-full bg-accent-green/80" />
        </div>
        <span className="text-xs text-text-dim ml-3 font-medium">wsShell</span>
        <div className="ml-auto flex items-center gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${activeTab === tab.id ? 'text-primary-300 bg-primary-500/10' : 'text-text-dim hover:text-text-muted'}`}
              onClick={() => useUIStore.getState().setActiveTab(tab.id)}
            >{tab.label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0" style={{ display: activeTab === 'terminal' ? 'flex' : 'none', flexDirection: 'column' }}>
            <Terminal />
          </div>
          <div className="absolute inset-0" style={{ display: activeTab === 'vnc' ? 'flex' : 'none', flexDirection: 'column' }}>
            <VncViewer />
          </div>
          <div className="absolute inset-0" style={{ display: activeTab === 'file' ? 'flex' : 'none', flexDirection: 'column' }}>
            <FileManager />
          </div>
          <div className="absolute inset-0" style={{ display: activeTab === 'monitor' ? 'flex' : 'none', flexDirection: 'column' }}>
            <MonitorPanel />
          </div>
          <div className="absolute inset-0" style={{ display: activeTab === 'network' ? 'flex' : 'none', flexDirection: 'column' }}>
            <NetworkMonitor />
          </div>
          <div className="absolute inset-0" style={{ display: activeTab === 'docker' ? 'flex' : 'none', flexDirection: 'column' }}>
            <DockerManager />
          </div>
          <div className="absolute inset-0" style={{ display: activeTab === 'tools' ? 'flex' : 'none', flexDirection: 'column' }}>
            <NetworkTools />
          </div>
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
