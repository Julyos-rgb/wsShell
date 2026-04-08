import React, { useState, useRef, useCallback } from 'react'
import { useUIStore, useConnectionStore } from '../stores/ui'
import { Ping, Traceroute } from '../../wailsjs/go/monitor/NetworkService'

interface PingStats {
  min: number
  avg: number
  max: number
  lost: number
  count: number
}

interface PingResponse {
  success: boolean
  output: string
  stats?: PingStats
  error?: string
}

interface TracerouteResponse {
  success: boolean
  output: string
  error?: string
}

type ToolTab = 'ping' | 'traceroute'

const NetworkTools: React.FC = () => {
  const { activeServerId } = useUIStore()
  const { connections } = useConnectionStore()

  const [tab, setTab] = useState<ToolTab>('ping')
  const [host, setHost] = useState('')
  const [count, setCount] = useState(4)
  const [loading, setLoading] = useState(false)
  const [pingResult, setPingResult] = useState<PingResponse | null>(null)
  const [tracerouteResult, setTracerouteResult] = useState<TracerouteResponse | null>(null)

  const outputRef = useRef<HTMLPreElement>(null)

  const conn = activeServerId ? connections[activeServerId] : null
  const sessionId = conn?.sessionId ?? null

  const handlePing = useCallback(async () => {
    if (!sessionId || !host.trim()) return
    setLoading(true)
    setPingResult(null)
    try {
      const resp = await Ping({ sessionId, host: host.trim(), count })
      setPingResult(resp as unknown as PingResponse)
    } catch (e: any) {
      setPingResult({ success: false, output: '', error: e?.message || String(e) })
    }
    setLoading(false)
  }, [sessionId, host, count])

  const handleTraceroute = useCallback(async () => {
    if (!sessionId || !host.trim()) return
    setLoading(true)
    setTracerouteResult(null)
    try {
      const resp = await Traceroute({ sessionId, host: host.trim() })
      setTracerouteResult(resp as unknown as TracerouteResponse)
    } catch (e: any) {
      setTracerouteResult({ success: false, output: '', error: e?.message || String(e) })
    }
    setLoading(false)
  }, [sessionId, host])

  const handleExecute = () => {
    if (tab === 'ping') handlePing()
    else handleTraceroute()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleExecute()
  }

  const renderOutput = (text: string, showLineNumbers: boolean) => {
    if (!text) return null
    const lines = text.split('\n')
    return lines.map((line, i) => (
      <div key={i} className="flex">
        {showLineNumbers && (
          <span className="inline-block w-8 flex-shrink-0 text-right pr-3 text-text-dim/40 select-none text-xs">
            {i + 1}
          </span>
        )}
        <span className="flex-1 whitespace-pre-wrap break-all">{line}</span>
      </div>
    ))
  }

  if (!conn || !sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
          <div className="text-sm">未连接到服务器</div>
          <div className="text-xs text-text-dim/50 mt-1">连接服务器后使用网络诊断工具</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-3 py-2 border-b border-border/40 flex items-center gap-2">
        <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
        <span className="text-sm font-medium text-text">网络诊断</span>
        <span className="text-xs text-text-dim ml-1">{conn.serverName || conn.host}</span>
      </div>

      <div className="flex-shrink-0 px-3 pt-3 space-y-2">
        <div className="flex gap-1 bg-surface-500/50 rounded-lg p-0.5 border border-border/30">
          <button
            onClick={() => { setTab('ping'); setPingResult(null); setTracerouteResult(null) }}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === 'ping'
                ? 'bg-primary-500/20 text-primary-300'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Ping
          </button>
          <button
            onClick={() => { setTab('traceroute'); setPingResult(null); setTracerouteResult(null) }}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === 'traceroute'
                ? 'bg-primary-500/20 text-primary-300'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Traceroute
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tab === 'ping' ? '输入目标主机或 IP' : '输入目标主机或 IP'}
            className="flex-1 bg-surface-500/50 border border-border/30 rounded-lg px-3 py-1.5 text-xs text-text placeholder:text-text-dim/40 focus:outline-none focus:border-primary-500/50 transition-colors font-mono"
          />
          {tab === 'ping' && (
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="bg-surface-500/50 border border-border/30 rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none focus:border-primary-500/50 transition-colors appearance-none cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((n) => (
                <option key={n} value={n}>{n}次</option>
              ))}
            </select>
          )}
          <button
            onClick={handleExecute}
            disabled={loading || !host.trim()}
            className="px-4 py-1.5 bg-primary-500/20 hover:bg-primary-500/30 disabled:opacity-30 disabled:cursor-not-allowed text-primary-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            {loading && (
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? '执行中' : '执行'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tab === 'ping' && pingResult && (
          <>
            {pingResult.stats && pingResult.success && (
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-surface-500/50 rounded-lg px-3 py-2 border border-border/30 text-center">
                  <div className="text-[10px] text-text-dim mb-0.5">Min</div>
                  <div className="text-sm font-mono text-accent-blue">{pingResult.stats.min.toFixed(1)} ms</div>
                </div>
                <div className="bg-surface-500/50 rounded-lg px-3 py-2 border border-border/30 text-center">
                  <div className="text-[10px] text-text-dim mb-0.5">Avg</div>
                  <div className="text-sm font-mono text-accent-green">{pingResult.stats.avg.toFixed(1)} ms</div>
                </div>
                <div className="bg-surface-500/50 rounded-lg px-3 py-2 border border-border/30 text-center">
                  <div className="text-[10px] text-text-dim mb-0.5">Max</div>
                  <div className="text-sm font-mono text-accent-yellow">{pingResult.stats.max.toFixed(1)} ms</div>
                </div>
                <div className="bg-surface-500/50 rounded-lg px-3 py-2 border border-border/30 text-center">
                  <div className="text-[10px] text-text-dim mb-0.5">丢包</div>
                  <div className="text-sm font-mono text-accent-red">{pingResult.stats.lost}%</div>
                </div>
              </div>
            )}
            {pingResult.error && (
              <div className="bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2 text-xs text-accent-red">
                {pingResult.error}
              </div>
            )}
            {pingResult.output && (
              <pre
                ref={outputRef}
                className="bg-surface-500/50 border border-border/30 rounded-lg p-3 text-xs font-mono text-text leading-relaxed overflow-x-auto"
              >
                {renderOutput(pingResult.output, false)}
              </pre>
            )}
          </>
        )}

        {tab === 'traceroute' && tracerouteResult && (
          <>
            {tracerouteResult.error && (
              <div className="bg-accent-red/10 border border-accent-red/20 rounded-lg px-3 py-2 text-xs text-accent-red">
                {tracerouteResult.error}
              </div>
            )}
            {tracerouteResult.output && (
              <pre className="bg-surface-500/50 border border-border/30 rounded-lg p-3 text-xs font-mono text-text leading-relaxed overflow-x-auto">
                {renderOutput(tracerouteResult.output, true)}
              </pre>
            )}
          </>
        )}

        {!pingResult && !tracerouteResult && !loading && (
          <div className="flex items-center justify-center py-12 text-text-dim/30">
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <div className="text-xs">输入目标地址并点击执行</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NetworkTools
