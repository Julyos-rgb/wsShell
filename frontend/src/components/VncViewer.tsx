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
  const connection = activeServerId ? connections[activeServerId] : undefined
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
    <div className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50 bg-surface-400' : 'h-full'}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 glass-panel border-b border-border/40 flex-shrink-0 rounded-none">
        {status === 'idle' && (
          <button
            className="btn-primary text-xs"
            onClick={handleConnect}
            disabled={!activeServer?.vncEnabled || !isConnected}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              连接 VNC
            </span>
          </button>
        )}
        {status === 'connected' && (
          <>
            <button className="btn-danger text-xs" onClick={disconnect}>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                断开
              </span>
            </button>
            <button className="btn-ghost text-xs" onClick={handleFullscreen}>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                {fullscreen ? '退出全屏' : '全屏'}
              </span>
            </button>
          </>
        )}
        {status === 'connecting' && (
          <span className="text-xs text-accent-yellow flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            正在建立连接...
          </span>
        )}
        <span className="text-xs text-text-dim font-mono">:{vncPort}</span>
        {status === 'error' && (
          <>
            <span className="text-xs text-danger">{errorMsg}</span>
            <button className="btn-primary text-xs" onClick={handleConnect}>
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
            className="input-field w-36 text-xs py-1"
          />
        )}
      </div>

      <div className="flex-1 relative bg-surface-500">
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center text-text-dim animate-fade-in">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-text-dim/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="text-sm">点击"连接 VNC"开始远程桌面</div>
              {!isConnected && (
                <div className="text-xs mt-2 text-accent-yellow">请先通过 SSH 连接服务器</div>
              )}
              {!activeServer?.vncEnabled && isConnected && (
                <div className="text-xs mt-2 text-text-dim">
                  VNC 未启用，请在服务器设置中启用 VNC
                </div>
              )}
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center text-text-dim animate-fade-in">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-danger/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-danger mb-2">{errorMsg}</div>
              <div className="text-xs text-text-dim space-y-1">
                <p>请检查：</p>
                <p>1. 远程服务器已安装并启动 VNC 服务</p>
                <p>2. VNC 端口号配置正确（默认 5900）</p>
                <p>3. SSH 隧道模式已正确启用</p>
              </div>
              <button className="btn-primary mt-4 text-xs" onClick={handleConnect}>
                重新连接
              </button>
            </div>
          </div>
        )}
        {status === 'connecting' && (
          <div className="absolute inset-0 flex items-center justify-center text-text-dim">
            <div className="text-center">
              <svg className="w-10 h-10 mx-auto mb-3 animate-spin text-accent-yellow" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <div className="text-accent-yellow text-sm">正在连接 VNC 服务器...</div>
              <div className="text-xs text-text-dim mt-1">
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
