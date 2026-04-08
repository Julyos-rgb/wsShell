import React, { useState, useEffect, useMemo } from 'react'
import { useUIStore, useConnectionStore, useTerminalTabStore } from '../stores/ui'
import { ServerConfig } from '../types'
import { GetServers } from '../../wailsjs/go/config/ConfigManager'
import { Connect as SSHConnect } from '../../wailsjs/go/ssh/SSHService'
import { ConnectFromSSH as SFTPConnectFromSSH, Disconnect as SFTPDisconnect } from '../../wailsjs/go/sftp/SFTPManager'
import { Disconnect as SSHDisconnect } from '../../wailsjs/go/ssh/SSHService'

const Sidebar: React.FC = () => {
  const {
    activeServerId, setActiveServerId,
    sidebarCollapsed, toggleSidebar,
    setShowAddServerDialog, setEditingServer,
    setStatusMessage, setActiveTab,
  } = useUIStore()
  const {
    servers, setServers,
    connections, addConnection, removeConnection,
    addSftpSession, removeSftpSession,
  } = useConnectionStore()
  const { addTerminalTab } = useTerminalTabStore()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [connecting, setConnecting] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ server: ServerConfig; x: number; y: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadServers()
  }, [])

  const loadServers = async () => {
    try {
      const resp = await GetServers()
      setServers(resp.servers || [])
    } catch (e) {
      console.error('Failed to load servers:', e)
    }
  }

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  const connectToServer = async (server: ServerConfig) => {
    if (connections.has(server.id)) {
      setActiveServerId(server.id)
      return
    }

    setConnecting(server.id)
    setStatusMessage(`正在连接 ${server.name}...`)

    try {
      const sshResp = await SSHConnect({
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password || '',
        privateKey: server.privateKey || '',
        authType: server.authType || 'password',
      })

      if (sshResp.success) {
        addConnection(server.id, {
          sessionId: sshResp.sessionId || '',
          serverId: server.id,
          serverName: server.name,
          host: server.host,
          port: server.port,
          username: server.username,
          connected: true,
          connectedAt: Date.now(),
        })

        addTerminalTab({
          id: `${server.id}-main`,
          serverId: server.id,
          sessionId: sshResp.sessionId || '',
          label: server.name,
          serverName: server.name,
          connected: true,
        })

        try {
          const sftpResp = await SFTPConnectFromSSH({
            sshSessionId: sshResp.sessionId || '',
          })
          if (sftpResp.success && sftpResp.sessionId) {
            addSftpSession(server.id, sftpResp.sessionId)
          }
        } catch (e) {
          console.warn('SFTP connect failed:', e)
        }

        setActiveServerId(server.id)
        setActiveTab('terminal')
        setStatusMessage(`已连接 ${server.name}`)
      } else {
        setStatusMessage(`连接失败: ${sshResp.error}`)
      }
    } catch (e: any) {
      setStatusMessage(`连接错误: ${e.toString()}`)
    }

    setConnecting(null)
  }

  const disconnectServer = async (server: ServerConfig) => {
    const conn = connections.get(server.id)
    if (conn) {
      try {
        await SSHDisconnect(conn.sessionId)
      } catch (e) {
        console.error('SSH disconnect error:', e)
      }
      const sftpSessionId = useConnectionStore.getState().sftpSessions.get(server.id)
      if (sftpSessionId) {
        try {
          await SFTPDisconnect(sftpSessionId)
        } catch (e) {
          console.error('SFTP disconnect error:', e)
        }
        removeSftpSession(server.id)
      }
      removeConnection(server.id)

      const { terminalTabs, removeTerminalTab } = useTerminalTabStore.getState()
      terminalTabs
        .filter(t => t.serverId === server.id)
        .forEach(t => removeTerminalTab(t.id))
    }
    if (activeServerId === server.id) {
      setActiveServerId(null)
    }
    setStatusMessage('未连接')
  }

  const handleContextMenu = (e: React.MouseEvent, server: ServerConfig) => {
    e.preventDefault()
    setContextMenu({ server, x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    const close = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', close)
      return () => document.removeEventListener('click', close)
    }
  }, [contextMenu])

  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return servers
    const q = searchQuery.toLowerCase()
    return servers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.host.toLowerCase().includes(q) ||
      s.username.toLowerCase().includes(q) ||
      (s.group && s.group.toLowerCase().includes(q))
    )
  }, [servers, searchQuery])

  const groupedServers = useMemo(() => {
    return filteredServers.reduce((acc, server) => {
      if (server.favorite) {
        const key = 'favorites'
        if (!acc[key]) acc[key] = []
        acc[key].push(server)
      }
      const groupKey = server.group ? server.group : 'ungrouped'
      if (!acc[groupKey]) acc[groupKey] = []
      acc[groupKey].push(server)
      return acc
    }, {} as Record<string, ServerConfig[]>)
  }, [filteredServers])

  const groupLabels: Record<string, { icon: React.ReactNode; label: string }> = {
    favorites: {
      icon: <svg className="w-3.5 h-3.5 text-accent-yellow" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
      label: '收藏',
    },
    ungrouped: {
      icon: <svg className="w-3.5 h-3.5 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>,
      label: '未分组',
    },
  }

  return (
    <div
      className={`${sidebarCollapsed ? 'w-14' : 'w-64'} glass-panel rounded-none border-t-0 border-b-0 border-l-0 flex flex-col transition-all duration-300 flex-shrink-0`}
    >
      <div className="p-2 flex items-center justify-between border-b border-border/40">
        <button
          className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-surface-50/50 transition-all"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
        >
          {sidebarCollapsed ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            </svg>
          )}
        </button>
        {!sidebarCollapsed && (
          <span className="text-xs text-text-dim font-medium tracking-wide">服务器</span>
        )}
      </div>

      {!sidebarCollapsed && (
        <div className="px-2 py-1.5">
          <div className="relative">
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="input-field pl-8 py-1.5 text-xs"
              placeholder="搜索服务器..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5">
        {Object.entries(groupedServers).map(([groupName, groupServers]) => {
          const meta = groupLabels[groupName] || {
            icon: <svg className="w-3.5 h-3.5 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
            label: groupName,
          }

          return (
            <div key={groupName} className="space-y-0.5">
              {!sidebarCollapsed && (
                <div
                  className="flex items-center px-2 py-1.5 text-xs font-medium text-text-subtext cursor-pointer hover:text-text-muted transition-colors rounded-md hover:bg-surface-50/30"
                  onClick={() => toggleGroup(groupName)}
                >
                  <svg className={`w-3 h-3 transition-transform duration-150 ${expandedGroups[groupName] !== false ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                  </svg>
                  <span className="ml-1.5 flex items-center gap-1.5">
                    {meta.icon}
                    {meta.label}
                  </span>
                  <span className="ml-auto text-text-dim text-[10px]">{groupServers.length}</span>
                </div>
              )}
              {(expandedGroups[groupName] !== false || sidebarCollapsed) &&
                groupServers.map((server) => {
                  const isConnected = connections.has(server.id)
                  const isActive = activeServerId === server.id
                  const isConnecting = connecting === server.id

                  return (
                    <div
                      key={server.id}
                      className={`sidebar-item group ${isActive ? 'sidebar-item-active' : ''}`}
                      onClick={() => connectToServer(server)}
                      onContextMenu={(e) => handleContextMenu(e, server)}
                      title={sidebarCollapsed ? server.name : undefined}
                    >
                      <span className={`status-dot flex-shrink-0 ${
                        isConnecting ? 'status-dot-connecting' :
                        isConnected ? 'status-dot-connected' :
                        'status-dot-disconnected'
                      }`} />
                      <span className={`truncate text-sm ml-2.5 ${sidebarCollapsed ? 'hidden' : ''}`}>
                        {server.name}
                      </span>
                      {!sidebarCollapsed && !isConnecting && !isConnected && (
                        <span className="ml-auto text-[10px] text-text-dim opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                          {server.host}
                        </span>
                      )}
                      {isConnecting && !sidebarCollapsed && (
                        <span className="ml-auto text-[10px] text-accent-yellow">连接中...</span>
                      )}
                    </div>
                  )
                })}
            </div>
          )
        })}

        {servers.length === 0 && !sidebarCollapsed && (
          <div className="text-center text-text-dim text-sm py-8 animate-fade-in">
            <svg className="w-10 h-10 mx-auto mb-3 text-text-dim/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <div>暂无服务器</div>
            <div className="text-xs mt-1">点击下方按钮添加</div>
          </div>
        )}
      </div>

      <button
        className="p-2.5 border-t border-border/40 text-primary-300 hover:bg-primary-500/10 transition-all group"
        onClick={() => {
          setEditingServer(null)
          setShowAddServerDialog(true)
        }}
      >
        <div className="flex items-center justify-center">
          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className={`ml-2 text-sm font-medium ${sidebarCollapsed ? 'hidden' : ''}`}>添加服务器</span>
        </div>
      </button>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {connections.has(contextMenu.server.id) && (
            <button
              className="context-menu-item flex items-center gap-2"
              onClick={() => disconnectServer(contextMenu.server)}
            >
              <svg className="w-3.5 h-3.5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              断开连接
            </button>
          )}
          <button
            className="context-menu-item flex items-center gap-2"
            onClick={() => {
              setEditingServer(contextMenu.server)
              setShowAddServerDialog(true)
              setContextMenu(null)
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            编辑
          </button>
          <div className="my-1 border-t border-border/40" />
          <button
            className="context-menu-item flex items-center gap-2 text-danger hover:bg-danger-dark/30"
            onClick={async () => {
              await disconnectServer(contextMenu.server)
              const { DeleteServer } = await import('../../wailsjs/go/config/ConfigManager')
              await DeleteServer({ id: contextMenu.server.id } as any)
              loadServers()
              setContextMenu(null)
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            删除
          </button>
        </div>
      )}
    </div>
  )
}

export default Sidebar
