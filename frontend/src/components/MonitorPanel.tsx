import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useUIStore, useConnectionStore } from '../stores/ui'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import { GetSystemInfo, GetResourceUsage, StartMonitor, StopMonitor } from '../../wailsjs/go/monitor/MonitorService'

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

const MetricBar: React.FC<{ value: number; color: string; label: string; detail: string }> = ({ value, color, label, detail }) => (
  <div className="flex items-center gap-2">
    <span className="text-[11px] text-text-dim w-8 flex-shrink-0">{label}</span>
    <div className="flex-1 h-1.5 bg-surface-500 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
      />
    </div>
    <span className="text-[11px] font-mono text-text-muted w-20 text-right flex-shrink-0">{detail}</span>
  </div>
)

const MonitorPanel: React.FC = () => {
  const activeServerId = useUIStore((s) => s.activeServerId)
  const { connections } = useConnectionStore()

  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
  const [usage, setUsage] = useState<ResourceUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const monitorSessionRef = useRef<string | null>(null)

  const connection = activeServerId ? connections[activeServerId] : undefined
  const isConnected = !!connection

  const resetData = useCallback(() => {
    setSysInfo(null)
    setUsage(null)
    setError('')
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

    GetSystemInfo(sessionId)
      .then((info) => setSysInfo(info as unknown as SystemInfo))
      .catch((e: any) => setError(e?.toString() || '获取系统信息失败'))
      .finally(() => setLoading(false))

    GetResourceUsage(sessionId)
      .then((u) => setUsage(u as ResourceUsage))
      .catch((e: any) => setError(e?.toString() || '获取资源使用率失败'))

    StartMonitor({ sessionId, interval: 2 }).catch((e: any) => {
      setError(e?.toString() || '启动监控失败')
    })

    const handleUsage = (data: any) => {
      setUsage(data as ResourceUsage)
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

  const getCpuColor = (v: number) => v >= 90 ? '#ef4444' : v >= 70 ? '#f59e0b' : '#22c55e'
  const getMemColor = (v: number) => v >= 90 ? '#ef4444' : v >= 70 ? '#f59e0b' : '#3b82f6'
  const getDiskColor = (v: number) => v >= 90 ? '#ef4444' : v >= 70 ? '#f59e0b' : '#22c55e'

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-1.5">
          <svg className="w-8 h-8 mx-auto text-text-dim/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
          </svg>
          <div className="text-xs text-text-dim">连接服务器后查看监控</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-2.5">
      {error && (
        <div className="px-2 py-1 bg-danger/10 border border-danger/20 rounded text-[11px] text-danger">{error}</div>
      )}

      {sysInfo && (
        <div className="flex items-center gap-3 text-[11px] text-text-dim flex-shrink-0">
          <span className="text-xs font-medium text-text-muted">{sysInfo.hostname}</span>
          <span className="w-px h-3 bg-border/40" />
          <span>运行 {sysInfo.uptime}</span>
          {loading && <span className="text-accent-yellow animate-pulse">加载中</span>}
        </div>
      )}

      {usage && (
        <div className="space-y-2">
          <MetricBar value={usage.cpuPercent} color={getCpuColor(usage.cpuPercent)} label="CPU" detail={`${usage.cpuPercent.toFixed(1)}%`} />
          <MetricBar value={usage.memPercent} color={getMemColor(usage.memPercent)} label="内存" detail={`${usage.memUsedMB.toFixed(0)}/${usage.memTotalMB.toFixed(0)}M`} />
          <MetricBar value={usage.diskPercent} color={getDiskColor(usage.diskPercent)} label="磁盘" detail={`${usage.diskUsedGB.toFixed(1)}/${usage.diskTotalGB.toFixed(1)}G`} />

          <div className="flex items-center gap-3 pt-1">
            <span className="text-[11px] text-text-dim">负载</span>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span style={{ color: usage.load1 > (sysInfo?.cpuCores ?? 1) ? '#ef4444' : '#22c55e' }}>{usage.load1.toFixed(2)}</span>
              <span className="text-text-dim/40">/</span>
              <span className="text-text-muted">{usage.load5.toFixed(2)}</span>
              <span className="text-text-dim/40">/</span>
              <span className="text-text-muted">{usage.load15.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {!usage && !error && (
        <div className="text-xs text-text-dim animate-pulse">正在获取系统信息...</div>
      )}
    </div>
  )
}

export default MonitorPanel
