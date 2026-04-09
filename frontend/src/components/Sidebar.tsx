import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useUIStore, useConnectionStore, useTerminalTabStore } from '../stores/ui'
import { ServerConfig } from '../types'
import { GetServers, DeleteServer } from '../../wailsjs/go/config/ConfigManager'
import { Connect as SSHConnect, Disconnect as SSHDisconnect, TrustHostKey } from '../../wailsjs/go/ssh/SSHService'
import { ConnectFromSSH as SFTPConnectFromSSH, Disconnect as SFTPDisconnect } from '../../wailsjs/go/sftp/SFTPManager'
import HostKeyDialog from './HostKeyDialog'
import { useContextMenu, ContextMenuItem } from './ContextMenu'
import { useDialog } from './Dialog'

interface HostKeyState {
  open: boolean
  isMismatch: boolean
  host: string
  keyType: string
  fingerprint: string
  expectedFingerprint: string
  pendingServer: ServerConfig | null
}

const defaultHostKeyState: HostKeyState = {
  open: false, isMismatch: false, host: '', keyType: '', fingerprint: '', expectedFingerprint: '', pendingServer: null,
}

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
  const { addTerminalTab, removeTerminalTab } = useTerminalTabStore()
  const { confirm } = useDialog()
  const [connecting, setConnecting] = useState<string | null>(null)
  const [hostKeyState, setHostKeyState] = useState<HostKeyState>(defaultHostKeyState)
  const [searchQuery, setSearchQuery] = useState('')
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { show: showContextMenu, ContextMenuOverlay } = useContextMenu()

  useEffect(() => { loadServers() }, [])

  const loadServers = async () => {
    try {
      const resp = await GetServers()
      setServers(resp.servers || [])
    } catch (e) {
      console.error('Failed to load servers:', e)
    }
  }

  const completeConnection = async (server: ServerConfig, sshResp: any) => {
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
      const sftpResp = await SFTPConnectFromSSH({ sshSessionId: sshResp.sessionId || '' })
      if (sftpResp.success && sftpResp.sessionId) {
        addSftpSession(server.id, sftpResp.sessionId)
      }
    } catch (e) {
      console.warn('SFTP connect failed:', e)
    }

    setActiveServerId(server.id)
    setActiveTab('terminal')
    setStatusMessage(`已连接 ${server.name}`)
  }

  const connectToServer = async (server: ServerConfig) => {
    if (server.id in connections) {
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
        await completeConnection(server, sshResp)
      } else if (sshResp.needsHostKeyTrust || sshResp.hostKeyMismatch) {
        setHostKeyState({
          open: true,
          isMismatch: sshResp.hostKeyMismatch || false,
          host: sshResp.hostKeyHost || server.host,
          keyType: sshResp.hostKeyType || '',
          fingerprint: sshResp.hostKeyFingerprint || '',
          expectedFingerprint: sshResp.expectedFingerprint || '',
          pendingServer: server,
        })
      } else {
        setStatusMessage(`连接失败: ${sshResp.error}`)
      }
    } catch (e: any) {
      setStatusMessage(`连接错误: ${e.toString()}`)
    }

    setConnecting(null)
  }

  const handleTrustHostKey = async () => {
    const { pendingServer, host, keyType, fingerprint } = hostKeyState
    if (!pendingServer) return

    setHostKeyState((prev) => ({ ...prev, open: false }))
    setConnecting(pendingServer.id)
    setStatusMessage(`信任主机密钥并重新连接...`)

    try {
      const trustResp = await TrustHostKey({ host, keyType, fingerprint })
      if (!trustResp.success) {
        setStatusMessage(`信任主机失败: ${trustResp.error}`)
        setConnecting(null)
        return
      }

      const sshResp = await SSHConnect({
        host: pendingServer.host,
        port: pendingServer.port,
        username: pendingServer.username,
        password: pendingServer.password || '',
        privateKey: pendingServer.privateKey || '',
        authType: pendingServer.authType || 'password',
      })

      if (sshResp.success) {
        await completeConnection(pendingServer, sshResp)
      } else {
        setStatusMessage(`连接失败: ${sshResp.error}`)
      }
    } catch (e: any) {
      setStatusMessage(`连接错误: ${e.toString()}`)
    }

    setConnecting(null)
    setHostKeyState(defaultHostKeyState)
  }

  const handleRejectHostKey = () => {
    setStatusMessage(hostKeyState.isMismatch ? '主机密钥不匹配，连接已拒绝' : '已取消连接')
    setHostKeyState(defaultHostKeyState)
  }

  const disconnectServer = async (server: ServerConfig) => {
    const conn = connections[server.id]
    if (conn) {
      try { await SSHDisconnect(conn.sessionId) } catch (e) { console.error(e) }
      const sftpSessionId = useConnectionStore.getState().sftpSessions[server.id]
      if (sftpSessionId) {
        try { await SFTPDisconnect(sftpSessionId) } catch (e) { console.error(e) }
        removeSftpSession(server.id)
      }
      removeConnection(server.id)
      useTerminalTabStore.getState().terminalTabs
        .filter(t => t.serverId === server.id)
        .forEach(t => removeTerminalTab(t.id))
    }
    if (activeServerId === server.id) setActiveServerId(null)
    setStatusMessage('未连接')
  }

  const handleDelete = useCallback(async (server: ServerConfig) => {
    const ok = await confirm({
      title: '删除服务器',
      message: `确定删除 "${server.name}" 吗？此操作不可撤销。`,
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    await disconnectServer(server)
    await DeleteServer({ id: server.id } as any)
    loadServers()
  }, [confirm, connections, activeServerId])

  const handleServerClick = useCallback((server: ServerConfig) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      connectToServer(server)
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null
        setActiveServerId(server.id)
      }, 250)
    }
  }, [connections, activeServerId])

  const handleServerContextMenu = useCallback((e: React.MouseEvent, server: ServerConfig) => {
    const isConnected = server.id in connections
    const items: ContextMenuItem[] = [
      {
        label: isConnected ? '切换到' : '连接',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
        onClick: () => connectToServer(server),
      },
    ]

    if (isConnected) {
      items.push({
        label: '断开连接',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        ),
        onClick: () => disconnectServer(server),
      })
    }

    items.push(
      { separator: true },
      {
        label: '编辑',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
        onClick: () => { setEditingServer(server); setShowAddServerDialog(true) },
      },
      {
        label: '删除',
        danger: true,
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
        onClick: () => handleDelete(server),
      },
    )

    setActiveServerId(server.id)
    showContextMenu(e, items)
  }, [connections, showContextMenu])

  const filteredServers = searchQuery.trim()
    ? servers.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : servers

  return (
    <>
      <div className={`${sidebarCollapsed ? 'w-10' : 'w-56'} bg-surface-400 border-r border-border/40 flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className="h-8 flex items-center justify-between px-2 border-b border-border/30 flex-shrink-0">
          {!sidebarCollapsed && <span className="text-[10px] text-text-dim font-medium">服务器</span>}
          <button
            className="p-1 rounded text-text-dim hover:text-text transition-colors"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? '展开' : '收起'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {sidebarCollapsed
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              }
            </svg>
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="px-2 py-1.5 border-b border-border/30 flex-shrink-0">
            <div className="flex items-center gap-1.5 bg-surface-500 rounded-md px-2 py-1 border border-border/30">
              <svg className="w-3 h-3 text-text-dim flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索..."
                className="flex-1 bg-transparent text-[11px] text-text placeholder:text-text-dim/50 outline-none"
              />
              {searchQuery && (
                <button className="text-text-dim hover:text-text transition-colors" onClick={() => setSearchQuery('')}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-1">
          {filteredServers.map((server) => {
            const isConnected = server.id in connections
            const isActive = activeServerId === server.id
            const isConnecting = connecting === server.id

            return (
              <div
                key={server.id}
                className={`group flex items-center gap-2 px-2 py-1.5 mx-1 rounded cursor-pointer transition-colors ${
                  isActive ? 'bg-primary-500/15 text-primary-300' : 'hover:bg-surface-50/40 text-text-muted'
                }`}
                onClick={() => handleServerClick(server)}
                onContextMenu={(e) => handleServerContextMenu(e, server)}
                title={sidebarCollapsed ? `${server.name}\n${server.host}:${server.port}\n\n单击选中 / 双击连接` : undefined}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isConnecting ? 'bg-accent-yellow animate-pulse-soft' :
                  isConnected ? 'bg-accent-green' : 'bg-text-dim'
                }`} />

                {!sidebarCollapsed && (
                  <>
                    <span className="truncate text-xs flex-1">{server.name}</span>
                    {isConnecting && <span className="text-[10px] text-accent-yellow">...</span>}
                    {!isConnecting && (
                      <span className="text-[10px] text-text-dim font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        {isConnected ? '●' : server.host}
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {filteredServers.length === 0 && !sidebarCollapsed && (
            <div className="text-center text-text-dim text-xs py-6">
              {searchQuery ? (
                <>
                  <div>未找到匹配服务器</div>
                  <div className="text-[10px] mt-1">尝试其他关键词</div>
                </>
              ) : (
                <>
                  <div>暂无服务器</div>
                  <div className="text-[10px] mt-1">点击下方 + 添加</div>
                </>
              )}
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="px-2 py-1 border-t border-border/30 flex-shrink-0">
            <div className="text-[10px] text-text-dim/40 text-center">
              单击选中 · 双击连接 · 右键更多
            </div>
          </div>
        )}

        <button
          className="h-8 border-t border-border/30 flex items-center justify-center text-primary-300 hover:bg-primary-500/10 transition-colors"
          onClick={() => { setEditingServer(null); setShowAddServerDialog(true) }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {!sidebarCollapsed && <span className="ml-1.5 text-xs">添加服务器</span>}
        </button>
      </div>

      <HostKeyDialog
        open={hostKeyState.open}
        isMismatch={hostKeyState.isMismatch}
        host={hostKeyState.host}
        keyType={hostKeyState.keyType}
        fingerprint={hostKeyState.fingerprint}
        expectedFingerprint={hostKeyState.expectedFingerprint}
        onTrust={handleTrustHostKey}
        onReject={handleRejectHostKey}
      />

      <ContextMenuOverlay />
    </>
  )
}

export default Sidebar
