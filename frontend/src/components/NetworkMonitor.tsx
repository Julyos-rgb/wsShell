import { useState, useEffect, useRef, useCallback } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import { GetConnections, StartNetMonitor, StopNetMonitor } from '../../wailsjs/go/monitor/NetworkService'
import { useUIStore, useConnectionStore } from '../stores/ui'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const MAX_POINTS = 60

interface TrafficData {
  sessionId: string
  interface: string
  rxSpeed: number
  txSpeed: number
  rxBytes: number
  txBytes: number
}

interface ConnectionEntry {
  proto: string
  localAddr: string
  foreign: string
  state: string
  pid: number
}

interface ConnectionsResponse {
  success: boolean
  connections: ConnectionEntry[]
  error: string
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 B/s'
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes.toFixed(0)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatChartValue(value: number): string {
  if (value < 1024) return `${value.toFixed(0)} B/s`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB/s`
  return `${(value / (1024 * 1024)).toFixed(1)} MB/s`
}

function stateColor(state: string): string {
  const s = state.toUpperCase()
  if (s === 'LISTEN') return 'bg-accent-blue/20 text-accent-blue'
  if (s === 'ESTABLISHED') return 'bg-accent-green/20 text-accent-green'
  if (s === 'TIME_WAIT' || s === 'CLOSE_WAIT') return 'bg-accent-yellow/20 text-accent-yellow'
  if (s === 'SYN_SENT' || s === 'SYN_RECV') return 'bg-primary-400/20 text-primary-300'
  if (s === 'FIN_WAIT1' || s === 'FIN_WAIT2') return 'bg-accent-yellow/20 text-accent-yellow'
  if (s === 'CLOSED') return 'bg-accent-red/20 text-accent-red'
  return 'bg-surface-50/30 text-text-dim'
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        color: '#a6adc8',
        font: { size: 11, family: 'Inter' },
        boxWidth: 12,
        boxHeight: 2,
        padding: 12,
        usePointStyle: false,
      },
    },
    tooltip: {
      backgroundColor: '#313244',
      titleColor: '#cdd6f4',
      bodyColor: '#a6adc8',
      borderColor: '#45475a',
      borderWidth: 1,
      titleFont: { size: 11, family: 'Inter' },
      bodyFont: { size: 11, family: 'Inter' },
      padding: 8,
      cornerRadius: 6,
      callbacks: {
        label(ctx: any) {
          return `${ctx.dataset.label}: ${formatChartValue(ctx.parsed?.y ?? 0)}`
        },
      },
    },
  },
  scales: {
    x: {
      display: false,
    },
    y: {
      display: true,
      grid: {
        color: '#313244',
        lineWidth: 0.5,
      },
      ticks: {
        color: '#585b70',
        font: { size: 10, family: 'Inter' },
        maxTicksLimit: 5,
        callback(value: string | number) {
          return formatChartValue(Number(value))
        },
      },
      border: {
        display: false,
      },
    },
  },
  elements: {
    point: {
      radius: 0,
    },
  },
}

const NetworkMonitor: React.FC = () => {
  const { activeServerId } = useUIStore()
  const { connections } = useConnectionStore()

  const [rxHistory, setRxHistory] = useState<number[]>([])
  const [txHistory, setTxHistory] = useState<number[]>([])
  const [totalRx, setTotalRx] = useState(0)
  const [totalTx, setTotalTx] = useState(0)
  const [currentRx, setCurrentRx] = useState(0)
  const [currentTx, setCurrentTx] = useState(0)
  const [connList, setConnList] = useState<ConnectionEntry[]>([])
  const [loading, setLoading] = useState(false)

  const monitorRef = useRef(false)
  const unlistenRef = useRef<(() => void) | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const conn = activeServerId ? connections[activeServerId] : null
  const sessionId = conn?.sessionId ?? null

  const fetchConnections = useCallback(async (sid: string) => {
    try {
      const resp = (await GetConnections({ sessionId: sid })) as ConnectionsResponse
      if (resp.success) {
        setConnList(resp.connections ?? [])
      }
    } catch {
      setConnList([])
    }
  }, [])

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) {
      setRxHistory([])
      setTxHistory([])
      setTotalRx(0)
      setTotalTx(0)
      setCurrentRx(0)
      setCurrentTx(0)
      setConnList([])
      monitorRef.current = false
      return
    }

    let cancelled = false

    const start = async () => {
      setLoading(true)
      try {
        const resp = await StartNetMonitor({ sessionId, interval: 1000 })
        if (!resp.success || cancelled) {
          setLoading(false)
          return
        }
        monitorRef.current = true
        setLoading(false)

        const off = EventsOn(`network:${sessionId}:traffic`, (data: TrafficData) => {
          if (cancelled || sessionIdRef.current !== sessionId) return
          setCurrentRx(data.rxSpeed)
          setCurrentTx(data.txSpeed)
          setTotalRx(data.rxBytes)
          setTotalTx(data.txBytes)
          setRxHistory((prev) => {
            const next = [...prev, data.rxSpeed]
            return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next
          })
          setTxHistory((prev) => {
            const next = [...prev, data.txSpeed]
            return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next
          })
        })

        unlistenRef.current = off

        fetchConnections(sessionId)
        const connTimer = setInterval(() => {
          if (!cancelled && sessionIdRef.current === sessionId) {
            fetchConnections(sessionId)
          }
        }, 5000)

        return () => {
          clearInterval(connTimer)
        }
      } catch {
        setLoading(false)
      }
    }

    let cleanup: (() => void) | undefined
    start().then((fn) => {
      cleanup = fn
    })

    return () => {
      cancelled = true
      cleanup?.()
      unlistenRef.current?.()
      unlistenRef.current = null
      if (monitorRef.current && sessionIdRef.current === sessionId) {
        StopNetMonitor({ sessionId }).catch(() => {})
        monitorRef.current = false
      }
    }
  }, [sessionId, fetchConnections])

  const chartData = {
    labels: rxHistory.map((_, i) => i),
    datasets: [
      {
        label: 'RX',
        data: rxHistory,
        borderColor: '#89b4fa',
        backgroundColor: 'rgba(137, 180, 250, 0.08)',
        borderWidth: 1.5,
        fill: true,
        tension: 0.3,
      },
      {
        label: 'TX',
        data: txHistory,
        borderColor: '#a6e3a1',
        backgroundColor: 'rgba(166, 227, 161, 0.08)',
        borderWidth: 1.5,
        fill: true,
        tension: 0.3,
      },
    ],
  }

  if (!conn || !sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
          </svg>
          <div className="text-sm">未连接到服务器</div>
          <div className="text-xs text-text-dim/50 mt-1">连接服务器后查看网络监控</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-3 py-2 border-b border-border/20 flex items-center gap-2">
        <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-sm font-medium text-text">网络监控</span>
        <span className="text-xs text-text-dim ml-1">{conn.serverName || conn.host}</span>
        {loading && (
          <span className="text-xs text-primary-300 animate-pulse ml-auto">启动中...</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="h-44 rounded-xl bg-surface-50/50 border border-border/15 p-3">
          <Line data={chartData} options={chartOptions} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface-50/50 border border-border/15 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-accent-blue" />
              <span className="text-xs text-text-dim">下载 (RX)</span>
            </div>
            <div className="text-sm font-mono text-accent-blue">{formatSpeed(currentRx)}</div>
            <div className="text-xs text-text-dim mt-0.5">累计 {formatBytes(totalRx)}</div>
          </div>
          <div className="rounded-xl bg-surface-50/50 border border-border/15 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-accent-green" />
              <span className="text-xs text-text-dim">上传 (TX)</span>
            </div>
            <div className="text-sm font-mono text-accent-green">{formatSpeed(currentTx)}</div>
            <div className="text-xs text-text-dim mt-0.5">累计 {formatBytes(totalTx)}</div>
          </div>
        </div>

        <div className="rounded-xl bg-surface-50/50 border border-border/15 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border/15 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <span className="text-xs text-text-dim">活动连接</span>
            <span className="text-xs text-text-dim/60 ml-auto">{connList.length}</span>
          </div>
          <div className="overflow-x-auto max-h-52 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-dim border-b border-border/10 bg-surface-100/50">
                  <th className="text-left px-3 py-1.5 font-medium">Proto</th>
                  <th className="text-left px-3 py-1.5 font-medium">Local Address</th>
                  <th className="text-left px-3 py-1.5 font-medium">Foreign Address</th>
                  <th className="text-left px-3 py-1.5 font-medium">State</th>
                  <th className="text-right px-3 py-1.5 font-medium">PID</th>
                </tr>
              </thead>
              <tbody>
                {connList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-text-dim/50">
                      暂无连接数据
                    </td>
                  </tr>
                ) : (
                  connList.map((c, i) => (
                    <tr
                      key={`${c.localAddr}-${c.foreign}-${c.pid}-${i}`}
                      className="border-b border-border/10 hover:bg-surface-50/30 transition-colors"
                    >
                      <td className="px-3 py-1.5 font-mono text-text-muted">{c.proto}</td>
                      <td className="px-3 py-1.5 font-mono text-text">{c.localAddr}</td>
                      <td className="px-3 py-1.5 font-mono text-text">{c.foreign}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded-lg text-[10px] font-medium ${stateColor(c.state)}`}>
                          {c.state}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-text-muted text-right">{c.pid}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NetworkMonitor
