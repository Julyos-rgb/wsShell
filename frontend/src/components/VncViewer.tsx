import React, { useEffect, useRef, useState, useCallback } from 'react'
import RFB from '@novnc/novnc/lib/rfb'
import { useConnectionStore, useUIStore } from '../stores/ui'
import {
  StartProxy,
  StopProxy,
} from '../../wailsjs/go/vnc/Proxy'
import { vnc } from '../../wailsjs/go/models'

const VncViewer: React.FC = () => {
  const { connections, servers } = useConnectionStore()
  const activeServerId = useUIStore((s) => s.activeServerId)
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<RFB | null>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const [vncPassword, setVncPassword] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectCountRef = useRef(0)

  const activeServer = servers.find((s) => s.id === activeServerId)
  const connection = connections.get(activeServerId || '')
  const isConnected = !!connection

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    reconnectCountRef.current = 0
  }, [])

  const disconnect = useCallback(() => {
    cleanup()
    if (rfbRef.current) {
      rfbRef.current.disconnect()
      rfbRef.current = null
    }
    if (proxyUrl && activeServer) {
      const sessionId = `${activeServer.host}:${activeServer.vncPort || 5900}`
      StopProxy({ sessionId } as vnc.StopProxyRequest).catch(() => {})
    }
    setStatus('idle')
    setProxyUrl('')
  }, [proxyUrl, activeServer, cleanup])

  const handleConnect = useCallback(async () => {
    if (!activeServer) return

    cleanup()
    setStatus('connecting')
    setErrorMsg('')
    reconnectCountRef.current = 0

    try {
      const vncHost = activeServer.vncTunnel ? '127.0.0.1' : activeServer.host
      const sshSessionId = connection?.sessionId || ''
      const resp = await StartProxy({
        host: vncHost,
        port: activeServer.vncPort || 5900,
        password: vncPassword || activeServer.vncPassword || '',
        tunnel: activeServer.vncTunnel || false,
        sshSessionId,
      } as vnc.StartProxyRequest)

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
          reconnectCountRef.current = 0
        })
        rfb.addEventListener('disconnect', (ev: any) => {
          const clean = ev.detail?.clean
          rfbRef.current = null
          if (clean) {
            setStatus('idle')
          } else {
            setStatus('error')
            setErrorMsg('VNC 连接已断开')
          }
        })
        rfb.addEventListener('credentialsrequired', () => {
          const pwd = prompt('VNC 服务器要求输入密码:')
          if (pwd) {
            rfb.sendCredentials({ password: pwd })
          } else {
            rfb.disconnect()
          }
        })
        rfb.addEventListener('desktopname', (ev: any) => {
          console.log('VNC desktop:', ev.detail?.name)
        })
        rfbRef.current = rfb
      }
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e.toString())
    }
  }, [activeServer, vncPassword, connection, cleanup])

  const handleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev)
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
      if (rfbRef.current) {
        rfbRef.current.disconnect()
        rfbRef.current = null
      }
    }
  }, [cleanup])

  useEffect(() => {
    if (!activeServerId) {
      disconnect()
    }
  }, [activeServerId, disconnect])

  const showPasswordInput = activeServer?.vncEnabled && status === 'idle'
  const vncPort = activeServer?.vncPort || 5900

  return (
    <div className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
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
          <>
            <button
              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              onClick={disconnect}
            >
              断开 VNC
            </button>
            <button
              className="px-3 py-1 text-xs bg-surface text-gray-300 rounded hover:bg-surface/80 transition-colors border border-secondary"
              onClick={handleFullscreen}
            >
              {fullscreen ? '退出全屏' : '全屏'}
            </button>
          </>
        )}
        {status === 'connecting' && (
          <span className="text-xs text-yellow-400">正在建立连接...</span>
        )}
        <span className="text-xs text-gray-500">
          :{vncPort}
        </span>
        {status === 'error' && (
          <>
            <span className="text-xs text-red-400">{errorMsg}</span>
            <button
              className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/80 transition-colors"
              onClick={handleConnect}
            >
              重试
            </button>
          </>
        )}
        <div className="flex-1" />
        {showPasswordInput && (
          <input
            type="password"
            placeholder="VNC 密码（可选）"
            value={vncPassword}
            onChange={(e) => setVncPassword(e.target.value)}
            className="px-2 py-1 text-xs bg-surface border border-secondary rounded text-gray-300 w-36"
          />
        )}
      </div>

      <div className="flex-1 relative bg-black">
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <div className="text-4xl mb-3">🖥</div>
              <div>点击"连接 VNC"开始远程桌面</div>
              {!isConnected && (
                <div className="text-sm mt-1 text-yellow-500">请先通过 SSH 连接服务器</div>
              )}
              {!activeServer?.vncEnabled && isConnected && (
                <div className="text-sm mt-1 text-gray-500">
                  VNC 未启用，请在服务器设置中启用 VNC
                </div>
              )}
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <div className="text-red-400 mb-2">{errorMsg}</div>
              <div className="text-sm text-gray-500">
                请检查：
                <br />
                1. 远程服务器已安装并启动 VNC 服务
                <br />
                2. VNC 端口号配置正确（默认 5900）
                <br />
                3. SSH 隧道模式已正确启用
              </div>
              <button
                className="mt-4 px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary/80"
                onClick={handleConnect}
              >
                重新连接
              </button>
            </div>
          </div>
        )}
        {status === 'connecting' && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-3">⏳</div>
              <div className="text-yellow-400">正在连接 VNC 服务器...</div>
              <div className="text-sm text-gray-500 mt-1">
                {activeServer?.vncTunnel ? '通过 SSH 隧道' : '直接连接'} → {activeServer?.host}:{vncPort}
              </div>
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  )
}

export default VncViewer
