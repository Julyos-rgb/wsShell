import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useConnectionStore, useUIStore } from '../stores/ui'
import {
  GetDockerContainers,
  GetDockerStats,
  DockerAction,
  GetDockerLogs,
} from '../../wailsjs/go/monitor/MonitorService'
import { useDialog } from './Dialog'

interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  ports: string
  state: string
}

interface ContainerStats {
  id: string
  cpuPct: string
  memUsage: string
  memPct: string
  netIO: string
  blockIO: string
  name: string
}

const StateBadge: React.FC<{ state: string }> = ({ state }) => {
  const cfg: Record<string, string> = {
    running: 'bg-accent-green/15 text-accent-green',
    exited: 'bg-danger/15 text-danger',
    stopped: 'bg-danger/15 text-danger',
    paused: 'bg-accent-yellow/15 text-accent-yellow',
    created: 'bg-accent-blue/15 text-accent-blue',
    restarting: 'bg-accent-yellow/15 text-accent-yellow',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${cfg[state] || 'bg-surface-50/40 text-text-dim'}`}>
      {state}
    </span>
  )
}

const ActionIcon: React.FC<{ d: string; label: string }> = ({ d, label }) => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    <title>{label}</title>
  </svg>
)

const StartIcon = () => <ActionIcon d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" label="启动" />
const StopIcon = () => <ActionIcon d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M10 9h4v6h-4z" label="停止" />
const RestartIcon = () => <ActionIcon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" label="重启" />
const RemoveIcon = () => <ActionIcon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" label="删除" />

const DockerManager: React.FC = () => {
  const activeServerId = useUIStore((s) => s.activeServerId)
  const { connections } = useConnectionStore()
  const { confirm } = useDialog()

  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [stats, setStats] = useState<Record<string, ContainerStats>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dockerUnavailable, setDockerUnavailable] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null)
  const [logs, setLogs] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [showStats, setShowStats] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logsPanelRef = useRef<HTMLDivElement>(null)

  const connection = activeServerId ? connections[activeServerId] : undefined
  const sessionId = connection?.sessionId || ''

  const fetchData = useCallback(async () => {
    if (!sessionId) return
    try {
      const resp = await GetDockerContainers({ sessionId })
      if (resp.success) {
        setContainers(resp.containers || [])
        setDockerUnavailable(false)
        setError('')
      } else {
        if (resp.error?.toLowerCase().includes('docker') || resp.error?.includes('未安装')) {
          setDockerUnavailable(true)
          setContainers([])
        }
        setError(resp.error || '')
      }
    } catch {
      setError('无法获取容器列表')
    }
  }, [sessionId])

  const fetchStats = useCallback(async () => {
    if (!sessionId) return
    try {
      const resp = await GetDockerStats({ sessionId })
      if (resp.success && resp.containers) {
        const map: Record<string, ContainerStats> = {}
        resp.containers.forEach((s: any) => { map[s.id] = s })
        setStats(map)
      }
    } catch {}
  }, [sessionId])

  const fetchLogs = useCallback(async (container: string) => {
    if (!sessionId) return
    setLogsLoading(true)
    try {
      const resp = await GetDockerLogs({ sessionId, container, tail: 200 })
      if (resp.success) {
        setLogs(resp.logs || '')
      } else {
        setLogs(resp.error || '获取日志失败')
      }
    } catch {
      setLogs('获取日志失败')
    } finally {
      setLogsLoading(false)
    }
  }, [sessionId])

  const handleAction = useCallback(async (container: string, action: string) => {
    if (!sessionId) return
    setActingOn(container + action)
    try {
      const resp = await DockerAction({ sessionId, container, action })
      if (!resp.success) {
        setError(resp.error || `${action} 操作失败`)
      }
      setTimeout(fetchData, 800)
    } catch {
      setError(`${action} 操作异常`)
    } finally {
      setActingOn(null)
    }
  }, [sessionId, fetchData])

  useEffect(() => {
    if (!sessionId) {
      setContainers([])
      setStats({})
      setError('')
      setDockerUnavailable(false)
      setSelectedContainer(null)
      return
    }

    setLoading(true)
    fetchData().finally(() => setLoading(false))

    intervalRef.current = setInterval(() => {
      fetchData()
      fetchStats()
    }, 5000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sessionId, fetchData, fetchStats])

  useEffect(() => {
    if (selectedContainer) {
      fetchLogs(selectedContainer)
    }
  }, [selectedContainer, containers, fetchLogs])

  useEffect(() => {
    if (logsPanelRef.current) {
      logsPanelRef.current.scrollTop = logsPanelRef.current.scrollHeight
    }
  }, [logs])

  const handleSelectContainer = (id: string) => {
    setSelectedContainer((prev) => (prev === id ? null : id))
  }

  if (!connection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center space-y-2">
          <svg className="w-12 h-12 mx-auto text-text-dim/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <div className="text-sm text-text-dim">请先连接到服务器</div>
        </div>
      </div>
    )
  }

  if (dockerUnavailable) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center space-y-2">
          <svg className="w-12 h-12 mx-auto text-text-dim/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <div className="text-sm text-text-dim">Docker 不可用</div>
          <div className="text-xs text-text-dim/60">请确认服务器已安装并启动 Docker</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-sm font-medium text-text">Docker 容器</span>
          <span className="text-[10px] text-text-dim bg-surface-50 px-1.5 py-0.5 rounded">
            {containers.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              showStats ? 'text-primary-300 bg-primary-500/15' : 'text-text-dim hover:text-text-muted'
            }`}
            onClick={() => setShowStats((s) => !s)}
          >
            {showStats ? '隐藏统计' : '显示统计'}
          </button>
          <button
            className="px-2 py-0.5 text-[10px] rounded text-text-dim hover:text-text-muted transition-colors"
            onClick={() => { setLoading(true); fetchData().finally(() => setLoading(false)); fetchStats(); }}
          >
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-1.5 bg-danger/10 text-danger text-xs border-b border-danger/20">
          {error}
          <button className="ml-2 underline text-danger/70 hover:text-danger" onClick={() => setError('')}>
            关闭
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading && containers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-text-dim animate-pulse">加载中...</div>
          </div>
        ) : containers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-1">
              <div className="text-xs text-text-dim">暂无容器</div>
            </div>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-dim border-b border-border/30 text-left">
                <th className="px-3 py-1.5 font-medium">名称</th>
                <th className="px-3 py-1.5 font-medium">镜像</th>
                <th className="px-3 py-1.5 font-medium">状态</th>
                <th className="px-3 py-1.5 font-medium">端口</th>
                <th className="px-3 py-1.5 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => {
                const s = stats[c.id]
                const isSelected = selectedContainer === c.id
                const isActing = actingOn?.startsWith(c.id)

                return (
                  <React.Fragment key={c.id}>
                    <tr
                      className={`border-b border-border/20 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary-500/8' : 'hover:bg-surface-50/30'
                      }`}
                      onClick={() => handleSelectContainer(c.id)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              c.state === 'running'
                                ? 'bg-accent-green'
                                : c.state === 'paused'
                                ? 'bg-accent-yellow'
                                : 'bg-text-dim/50'
                            }`}
                          />
                          <span className="truncate max-w-[160px] text-text" title={c.name}>
                            {c.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-text-muted font-mono truncate max-w-[200px]" title={c.image}>
                        {c.image}
                      </td>
                      <td className="px-3 py-2">
                        <StateBadge state={c.state} />
                      </td>
                      <td className="px-3 py-2 text-text-dim font-mono truncate max-w-[160px]" title={c.ports}>
                        {c.ports || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {c.state !== 'running' && (
                            <button
                              className="p-1 rounded hover:bg-accent-green/15 text-text-dim hover:text-accent-green transition-colors disabled:opacity-30"
                              disabled={isActing}
                              onClick={() => handleAction(c.name, 'start')}
                            >
                              {isActing && actingOn === c.id + 'start' ? (
                                <span className="block w-3.5 h-3.5 border border-accent-green/40 border-t-accent-green rounded-full animate-spin" />
                              ) : (
                                <StartIcon />
                              )}
                            </button>
                          )}
                          {c.state === 'running' && (
                            <button
                              className="p-1 rounded hover:bg-accent-yellow/15 text-text-dim hover:text-accent-yellow transition-colors disabled:opacity-30"
                              disabled={isActing}
                              onClick={() => handleAction(c.name, 'stop')}
                            >
                              {isActing && actingOn === c.id + 'stop' ? (
                                <span className="block w-3.5 h-3.5 border border-accent-yellow/40 border-t-accent-yellow rounded-full animate-spin" />
                              ) : (
                                <StopIcon />
                              )}
                            </button>
                          )}
                          <button
                            className="p-1 rounded hover:bg-accent-blue/15 text-text-dim hover:text-accent-blue transition-colors disabled:opacity-30"
                            disabled={isActing}
                            onClick={() => handleAction(c.name, 'restart')}
                          >
                            {isActing && actingOn === c.id + 'restart' ? (
                              <span className="block w-3.5 h-3.5 border border-accent-blue/40 border-t-accent-blue rounded-full animate-spin" />
                            ) : (
                              <RestartIcon />
                            )}
                          </button>
                          <button
                            className="p-1 rounded hover:bg-danger/15 text-text-dim hover:text-danger transition-colors disabled:opacity-30"
                            disabled={isActing}
                            onClick={async () => {
                              const ok = await confirm({
                                title: '删除容器',
                                message: `确定删除容器 ${c.name} 吗？`,
                                confirmText: '删除',
                                danger: true,
                              })
                              if (ok) {
                                handleAction(c.name, 'remove')
                              }
                            }}
                          >
                            {isActing && actingOn === c.id + 'remove' ? (
                              <span className="block w-3.5 h-3.5 border border-danger/40 border-t-danger rounded-full animate-spin" />
                            ) : (
                              <RemoveIcon />
                            )}
                            </button>
                        </div>
                      </td>
                    </tr>

                    {showStats && s && c.state === 'running' && (
                      <tr className="bg-surface-50/20 border-b border-border/10">
                        <td colSpan={5} className="px-3 py-1.5">
                          <div className="flex items-center gap-4 text-[10px] text-text-dim">
                            <span>CPU: <span className="text-accent-blue font-mono">{s.cpuPct}%</span></span>
                            <span>内存: <span className="text-accent-green font-mono">{s.memUsage}</span> ({s.memPct}%)</span>
                            <span>网络: <span className="text-accent-yellow font-mono">{s.netIO}</span></span>
                            <span>磁盘: <span className="text-text-muted font-mono">{s.blockIO}</span></span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {isSelected && (
                      <tr className="bg-surface-100/50 border-b border-border/20">
                        <td colSpan={5} className="p-0">
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between px-3 py-1 border-b border-border/20">
                              <span className="text-[10px] text-text-dim">
                                日志 - {c.name}
                              </span>
                              <button
                                className="text-[10px] text-text-dim hover:text-text-muted transition-colors"
                                onClick={() => fetchLogs(c.name)}
                              >
                                刷新日志
                              </button>
                            </div>
                            <div
                              ref={logsPanelRef}
                              className="h-48 overflow-auto px-3 py-2 bg-surface-500/50 font-mono text-[11px] text-text-muted leading-relaxed"
                            >
                              {logsLoading ? (
                                <span className="animate-pulse">加载日志...</span>
                              ) : logs ? (
                                <pre className="whitespace-pre-wrap break-all">{logs}</pre>
                              ) : (
                                <span className="text-text-dim/50">无日志</span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default DockerManager
