import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useUIStore, useConnectionStore } from '../stores/ui'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import { GetSystemInfo, GetResourceUsage, StartMonitor, StopMonitor } from '../../wailsjs/go/monitor/MonitorService'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

interface SystemInfo {
  hostname: string
  os: string
  kernel: string
  arch: string
  uptime: string
  users: number
  cpuCores: number
  cpuModel: string
  totalMemMB: number
}

interface ResourceUsage {
  cpuPercent: number
  memPercent: number
  memUsedMB: number
  memTotalMB: number
  diskPercent: number
  diskUsedGB: number
  diskTotalGB: number
  load1: number
  load5: number
  load15: number
}

const MAX_POINTS = 60

const ProgressBar: React.FC<{ value: number; color: string; label: string; detail: string }> = ({ value, color, label, detail }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-dim font-mono">{detail}</span>
    </div>
    <div className="h-2 bg-surface-500 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
      />
    </div>
    <div className="text-right text-[10px] font-mono" style={{ color }}>{value.toFixed(1)}%</div>
  </div>
)

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-0.5">
    <span className="text-[10px] text-text-dim">{label}</span>
    <span className="text-[11px] text-text-muted font-mono truncate max-w-[60%] text-right">{value}</span>
  </div>
)

const MonitorPanel: React.FC = () => {
  const activeServerId = useUIStore((s) => s.activeServerId)
  const { connections } = useConnectionStore()

  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
  const [usage, setUsage] = useState<ResourceUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cpuHistoryRef = useRef<number[]>([])
  const memHistoryRef = useRef<number[]>([])
  const labelsRef = useRef<string[]>([])
  const tickRef = useRef(0)
  const monitorSessionRef = useRef<string | null>(null)

  const connection = activeServerId ? connections[activeServerId] : undefined
  const isConnected = !!connection

  const resetData = useCallback(() => {
    setSysInfo(null)
    setUsage(null)
    setError('')
    cpuHistoryRef.current = []
    memHistoryRef.current = []
    labelsRef.current = []
    tickRef.current = 0
  }, [])

  const fetchSystemInfo = useCallback(async (sessionId: string) => {
    try {
      const info = await GetSystemInfo(sessionId)
      setSysInfo(info as unknown as SystemInfo)
    } catch (e: any) {
      setError(e?.toString() || '获取系统信息失败')
    }
  }, [])

  const fetchResourceUsage = useCallback(async (sessionId: string) => {
    try {
      const u = await GetResourceUsage(sessionId)
      setUsage(u as ResourceUsage)
    } catch (e: any) {
      console.error('fetch usage failed:', e)
    }
  }, [])

  useEffect(() => {
    if (!connection?.sessionId) {
      resetData()
      return
    }

    const sessionId = connection.sessionId
    if (monitorSessionRef.current === sessionId) return

    resetData()
    monitorSessionRef.current = sessionId
    setLoading(true)

    fetchSystemInfo(sessionId).finally(() => setLoading(false))
    fetchResourceUsage(sessionId)

    StartMonitor({ sessionId, interval: 2 }).catch((e: any) => {
      setError(e?.toString() || '启动监控失败')
    })

    const handleUsage = (data: any) => {
      const u = data as ResourceUsage
      setUsage(u)

      tickRef.current += 1
      const now = new Date()
      const label = `${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

      cpuHistoryRef.current = [...cpuHistoryRef.current, u.cpuPercent].slice(-MAX_POINTS)
      memHistoryRef.current = [...memHistoryRef.current, u.memPercent].slice(-MAX_POINTS)
      labelsRef.current = [...labelsRef.current, label].slice(-MAX_POINTS)
    }

    const handleError = (data: any) => {
      setError(data?.error || '监控出错')
    }

    EventsOn(`monitor:${sessionId}:usage`, handleUsage)
    EventsOn(`monitor:${sessionId}:error`, handleError)

    return () => {
      EventsOff(`monitor:${sessionId}:usage`)
      EventsOff(`monitor:${sessionId}:error`)
      StopMonitor({ sessionId }).catch(() => {})
      monitorSessionRef.current = null
    }
  }, [connection?.sessionId])

  const getCpuColor = (v: number) => {
    if (v >= 90) return '#f38ba8'
    if (v >= 70) return '#f9e2af'
    return '#a6e3a1'
  }

  const getMemColor = (v: number) => {
    if (v >= 90) return '#f38ba8'
    if (v >= 70) return '#f9e2af'
    return '#89b4fa'
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    scales: {
      x: {
        display: true,
        grid: { color: 'rgba(49, 50, 68, 0.5)', drawBorder: false },
        ticks: { color: '#585b70', font: { size: 9 }, maxTicksLimit: 8 },
      },
      y: {
        display: true,
        min: 0,
        max: 100,
        grid: { color: 'rgba(49, 50, 68, 0.5)', drawBorder: false },
        ticks: { color: '#585b70', font: { size: 9 }, stepSize: 25, callback: (v: any) => `${v}%` },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e1e2e',
        titleColor: '#cdd6f4',
        bodyColor: '#a6adc8',
        borderColor: '#313244',
        borderWidth: 1,
        callbacks: { label: (ctx: any) => `${ctx.parsed.y.toFixed(1)}%` },
      },
    },
    elements: { point: { radius: 0, hitRadius: 8 }, line: { tension: 0.3, borderWidth: 1.5 } },
  }

  const cpuChartData = {
    labels: labelsRef.current,
    datasets: [{
      data: cpuHistoryRef.current,
      borderColor: '#a6e3a1',
      backgroundColor: 'rgba(166, 227, 161, 0.08)',
      fill: true,
    }],
  }

  const memChartData = {
    labels: labelsRef.current,
    datasets: [{
      data: memHistoryRef.current,
      borderColor: '#89b4fa',
      backgroundColor: 'rgba(137, 180, 250, 0.08)',
      fill: true,
    }],
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <svg className="w-10 h-10 mx-auto text-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
          </svg>
          <div className="text-xs text-text-dim">未连接到服务器</div>
          <div className="text-[10px] text-text-dim/50">选择并连接服务器后查看系统监控</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
        </svg>
        <span className="text-xs text-text-muted font-medium">系统监控</span>
        {connection && <span className="text-[10px] text-text-dim font-mono">{connection.host}</span>}
        {loading && <span className="text-[10px] text-accent-yellow animate-pulse">加载中...</span>}
      </div>

      {error && (
        <div className="mx-3 mt-2 px-2 py-1 bg-danger/10 border border-danger/20 rounded text-[10px] text-danger">{error}</div>
      )}

      <div className="flex-1 p-3 space-y-3">
        {sysInfo && (
          <div className="bg-surface-300/50 rounded-lg border border-border/30 p-3">
            <div className="text-[10px] text-text-dim font-medium mb-2 uppercase tracking-wider">系统信息</div>
            <div className="space-y-0.5">
              <InfoRow label="主机名" value={sysInfo.hostname} />
              <InfoRow label="操作系统" value={sysInfo.os} />
              <InfoRow label="内核" value={sysInfo.kernel} />
              <InfoRow label="架构" value={sysInfo.arch} />
              <InfoRow label="CPU" value={`${sysInfo.cpuModel} (${sysInfo.cpuCores} 核)`} />
              <InfoRow label="内存" value={`${sysInfo.totalMemMB} MB`} />
              <InfoRow label="运行时间" value={sysInfo.uptime} />
              <InfoRow label="在线用户" value={`${sysInfo.users}`} />
            </div>
          </div>
        )}

        {usage && (
          <>
            <div className="bg-surface-300/50 rounded-lg border border-border/30 p-3 space-y-3">
              <div className="text-[10px] text-text-dim font-medium uppercase tracking-wider">资源使用</div>
              <ProgressBar
                value={usage.cpuPercent}
                color={getCpuColor(usage.cpuPercent)}
                label="CPU"
                detail={`${usage.cpuPercent.toFixed(1)}%`}
              />
              <ProgressBar
                value={usage.memPercent}
                color={getMemColor(usage.memPercent)}
                label="内存"
                detail={`${usage.memUsedMB.toFixed(0)} / ${usage.memTotalMB.toFixed(0)} MB`}
              />
              <ProgressBar
                value={usage.diskPercent}
                color={usage.diskPercent >= 90 ? '#f38ba8' : usage.diskPercent >= 70 ? '#f9e2af' : '#a6e3a1'}
                label="磁盘"
                detail={`${usage.diskUsedGB.toFixed(1)} / ${usage.diskTotalGB.toFixed(1)} GB`}
              />
            </div>

            <div className="bg-surface-300/50 rounded-lg border border-border/30 p-3">
              <div className="text-[10px] text-text-dim font-medium mb-2 uppercase tracking-wider">负载均值</div>
              <div className="flex items-center gap-4">
                <div className="flex-1 text-center">
                  <div className="text-sm font-mono" style={{ color: usage.load1 > (sysInfo?.cpuCores ?? 1) ? '#f38ba8' : '#a6e3a1' }}>
                    {usage.load1.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-text-dim mt-0.5">1 min</div>
                </div>
                <div className="w-px h-6 bg-border/40" />
                <div className="flex-1 text-center">
                  <div className="text-sm font-mono text-text-muted">{usage.load5.toFixed(2)}</div>
                  <div className="text-[9px] text-text-dim mt-0.5">5 min</div>
                </div>
                <div className="w-px h-6 bg-border/40" />
                <div className="flex-1 text-center">
                  <div className="text-sm font-mono text-text-muted">{usage.load15.toFixed(2)}</div>
                  <div className="text-[9px] text-text-dim mt-0.5">15 min</div>
                </div>
              </div>
            </div>

            <div className="bg-surface-300/50 rounded-lg border border-border/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-text-dim font-medium uppercase tracking-wider">CPU 趋势</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-0.5 rounded-full bg-accent-green" />
                  <span className="text-[9px] text-text-dim">CPU</span>
                </div>
              </div>
              <div className="h-32">
                <Line data={cpuChartData} options={chartOptions} />
              </div>
            </div>

            <div className="bg-surface-300/50 rounded-lg border border-border/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-text-dim font-medium uppercase tracking-wider">内存趋势</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-0.5 rounded-full bg-accent-blue" />
                  <span className="text-[9px] text-text-dim">MEM</span>
                </div>
              </div>
              <div className="h-32">
                <Line data={memChartData} options={chartOptions} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default MonitorPanel
