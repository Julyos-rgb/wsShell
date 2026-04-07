import React, { useState, useEffect } from 'react'
import { useUIStore, useConnectionStore, useTerminalTabStore } from '../stores/ui'
import { ServerConfig } from '../types'
import { GetServers } from '../../wailsjs/go/config/ConfigManager'
import { Connect as SSHConnect } from '../../wailsjs/go/ssh/SSHService'
import { Connect as SFTPConnect, Disconnect as SFTPDisconnect } from '../../wailsjs/go/sftp/SFTPManager'
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
          const sftpResp = await SFTPConnect({
            host: server.host,
            port: server.port,
            username: server.username,
            password: server.password || '',
            privateKey: server.privateKey || '',
            authType: server.authType || 'password',
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

  const groupedServers = servers.reduce((acc, server) => {
    if (server.favorite) {
      const key = '⭐ 收藏'
      if (!acc[key]) acc[key] = []
      acc[key].push(server)
    }
    const groupKey = server.group ? `📁 ${server.group}` : '📄 未分组'
    if (!acc[groupKey]) acc[groupKey] = []
    acc[groupKey].push(server)
    return acc
  }, {} as Record<string, ServerConfig[]>)

  return (
    <div
      className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-tertiary border-r border-secondary flex flex-col transition-all duration-300 flex-shrink-0`}
    >
      <button
        className="p-2 text-gray-400 hover:text-primary transition-colors"
        onClick={toggleSidebar}
      >
        {sidebarCollapsed ? '▶' : '◀'}
      </button>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {Object.entries(groupedServers).map(([groupName, groupServers]) => (
          <div key={groupName} className="space-y-0.5">
            <div
              className="flex items-center px-2 py-1 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-300"
              onClick={() => toggleGroup(groupName)}
            >
              <span className="text-[10px]">{expandedGroups[groupName] ? '▼' : '▶'}</span>
              <span className={`ml-1.5 truncate ${sidebarCollapsed ? 'hidden' : ''}`}>
                {groupName}
              </span>
              {!sidebarCollapsed && (
                <span className="ml-auto text-gray-600">{groupServers.length}</span>
              )}
            </div>
            {(expandedGroups[groupName] !== false) &&
              groupServers.map((server) => {
                const isConnected = connections.has(server.id)
                const isActive = activeServerId === server.id
                const isConnecting = connecting === server.id

                return (
                  <div
                    key={server.id}
                    className={`flex items-center px-3 py-1.5 rounded cursor-pointer transition-colors group ${
                      isActive
                        ? 'bg-secondary/80 text-primary'
                        : 'hover:bg-surface text-gray-300'
                    }`}
                    onClick={() => connectToServer(server)}
                    onContextMenu={(e) => handleContextMenu(e, server)}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0 ${
                        isConnecting
                          ? 'bg-yellow-400 animate-pulse'
                          : isConnected
                          ? 'bg-green-500'
                          : 'bg-gray-600'
                      }`}
                    />
                    <span className={`truncate text-sm ${sidebarCollapsed ? 'hidden' : ''}`}>
                      {server.name}
                    </span>
                    {!sidebarCollapsed && !isConnecting && !isConnected && (
                      <span className="ml-auto text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {server.host}
                      </span>
                    )}
                    {isConnecting && !sidebarCollapsed && (
                      <span className="ml-auto text-[10px] text-yellow-400">连接中...</span>
                    )}
                  </div>
                )
              })}
          </div>
        ))}

        {servers.length === 0 && !sidebarCollapsed && (
          <div className="text-center text-gray-600 text-sm py-8">
            暂无服务器
            <br />
            点击下方按钮添加
          </div>
        )}
      </div>

      <button
        className="p-3 border-t border-secondary text-primary hover:bg-surface transition-colors"
        onClick={() => {
          setEditingServer(null)
          setShowAddServerDialog(true)
        }}
      >
        <div className="flex items-center justify-center">
          <span className="text-lg leading-none">+</span>
          <span className={`ml-2 text-sm ${sidebarCollapsed ? 'hidden' : ''}`}>添加服务器</span>
        </div>
      </button>

      {contextMenu && (
        <div
          className="fixed bg-tertiary border border-secondary rounded shadow-xl py-1 z-50 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {connections.has(contextMenu.server.id) && (
            <button
              className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-surface transition-colors"
              onClick={() => disconnectServer(contextMenu.server)}
            >
              断开连接
            </button>
          )}
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-surface transition-colors"
            onClick={() => {
              setEditingServer(contextMenu.server)
              setShowAddServerDialog(true)
              setContextMenu(null)
            }}
          >
            编辑
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-surface transition-colors"
            onClick={async () => {
              await disconnectServer(contextMenu.server)
              const { DeleteServer } = await import('../../wailsjs/go/config/ConfigManager')
              await DeleteServer({ id: contextMenu.server.id } as any)
              loadServers()
              setContextMenu(null)
            }}
          >
            删除
          </button>
        </div>
      )}
    </div>
  )
}

export default Sidebar
