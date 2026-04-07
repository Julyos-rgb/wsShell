import React, { useEffect, useRef, useState, useCallback } from 'react'
import RFB from '@novnc/novnc/lib/rfb'
import { useConnectionStore, useUIStore } from '../stores/ui'
import {
  StartProxy,
  StopProxy,
} from '../../wailsjs/go/vnc/Proxy'

const VncViewer: React.FC = () => {
  const { connections, servers } = useConnectionStore()
  const activeServerId = useUIStore((s) => s.activeServerId)
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<RFB | null>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const [vncPassword, setVncPassword] = useState('')

  const activeServer = servers.find((s) => s.id === activeServerId)
  const connection = connections.get(activeServerId || '')
  const isConnected = !!connection

  const disconnect = useCallback(() => {
    if (rfbRef.current) {
      rfbRef.current.disconnect()
      rfbRef.current = null
    }
    if (proxyUrl && activeServer) {
      const sessionId = `${activeServer.host}:${activeServer.vncPort || 5900}`
      StopProxy({ sessionId } as any).catch(() => {})
    }
    setStatus('idle')
    setProxyUrl('')
  }, [proxyUrl, activeServer])

  const handleConnect = useCallback(async () => {
    if (!activeServer) return

    setStatus('connecting')
    setErrorMsg('')

    try {
      const vncHost = activeServer.vncTunnel ? '127.0.0.1' : activeServer.host
      const sshSessionId = connection?.sessionId || ''
      const resp = await StartProxy({
        host: vncHost,
        port: activeServer.vncPort || 5900,
        password: vncPassword || activeServer.vncPassword || '',
        tunnel: activeServer.vncTunnel || false,
        sshSessionId,
      } as any)

      if (!resp.success) {
        setStatus('error')
        setErrorMsg(resp.error || 'VNC proxy 启动失败')
        return
      }

      const wsUrl = resp.wsUrl || ''
      setProxyUrl(wsUrl)

      if (containerRef.current) {
        containerRef.current.innerHTML = ''
        const rfb = new RFB(containerRef.current, wsUrl, {
          credentials: vncPassword || activeServer.vncPassword ? {
            password: vncPassword || activeServer.vncPassword,
          } : undefined,
        })
        rfb.scaleViewport = true
        rfb.resizeSession = false
        rfb.addEventListener('connect', () => {
          setStatus('connected')
        })
        rfb.addEventListener('disconnect', () => {
          setStatus('idle')
          rfbRef.current = null
        })
        rfb.addEventListener('credentialsrequired', () => {
          const pwd = prompt('VNC 服务器要求输入密码:')
          if (pwd) {
            rfb.sendCredentials({ password: pwd })
          } else {
            rfb.disconnect()
          }
        })
        rfbRef.current = rfb
      }
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e.toString())
    }
  }, [activeServer, vncPassword, connection])

  useEffect(() => {
    return () => {
      if (rfbRef.current) {
        rfbRef.current.disconnect()
        rfbRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!activeServerId) {
      disconnect()
    }
  }, [activeServerId])

  const showPasswordInput = activeServer?.vncEnabled && status === 'idle'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-tertiary border-b border-secondary flex-shrink-0">
        {status === 'idle' && (
          <button
            className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/80 transition-colors disabled:opacity-50"
            onClick={handleConnect}
            disabled={!activeServer?.vncEnabled || !isConnected}
          >
            连接 VNC
          </button>
        )}
        {status === 'connected' && (
          <button
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            onClick={disconnect}
          >
            断开 VNC
          </button>
        )}
        {activeServer?.vncPort && (
          <span className="text-xs text-gray-500">
            :{activeServer.vncPort || 5900}
          </span>
        )}
        {status === 'error' && (
          <span className="text-xs text-red-400">{errorMsg}</span>
        )}
        {status === 'connecting' && (
          <span className="text-xs text-yellow-400">正在建立连接...</span>
        )}
        <div className="flex-1" />
        {showPasswordInput && (
          <input
            type="password"
            placeholder="VNC 密码"
            value={vncPassword}
            onChange={(e) => setVncPassword(e.target.value)}
            className="px-2 py-1 text-xs bg-surface border border-secondary rounded text-gray-300 w-32"
          />
        )}
      </div>

      <div className="flex-1 relative bg-black">
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <div className="text-4xl mb-3">🖥</div>
              <div>点击"连接 VNC"开始远程桌面</div>
              {!isConnected && <div className="text-sm mt-1 text-yellow-500">请先通过 SSH 连接服务器</div>}
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  )
}

export default VncViewer
