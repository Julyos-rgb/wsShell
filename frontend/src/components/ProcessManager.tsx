import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useUIStore, useConnectionStore } from '../stores/ui'
import { GetProcesses, KillProcess } from '../../wailsjs/go/monitor/MonitorService'

interface ProcessInfo {
  pid: number
  user: string
  cpu: number
  mem: number
  vsz: number
  rss: number
  command: string
}

type SortKey = 'cpu' | 'mem'

const formatMemory = (kb: number): string => {
  if (kb === 0) return '0'
  if (kb < 1024) return `${kb}K`
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)}M`
  return `${(kb / 1024 / 1024).toFixed(1)}G`
}

const cpuMemColor = (value: number): string => {
  if (value > 50) return 'text-accent-red'
  if (value > 20) return 'text-accent-yellow'
  return 'text-text'
}

const ProcessManager: React.FC = () => {
  const { activeServerId } = useUIStore()
  const { connections } = useConnectionStore()

  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [sort, setSort] = useState<SortKey>('cpu')
  const [search, setSearch] = useState('')
  const [selectedPid, setSelectedPid] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [killing, setKilling] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const sessionId = activeServerId ? connections[activeServerId]?.sessionId : null

  const fetchProcesses = useCallback(async () => {
    if (!sessionId) {
      setProcesses([])
      return
    }
    setLoading(true)
    try {
      const resp = await GetProcesses({ sessionId, sort })
      if (resp.success && resp.processes) {
        if (mountedRef.current) {
          setProcesses(resp.processes.slice(0, 50))
        }
      }
    } catch {
      if (mountedRef.current) {
        setProcesses([])
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [sessionId, sort])

  useEffect(() => {
    mountedRef.current = true
    fetchProcesses()
    timerRef.current = setInterval(fetchProcesses, 5000)
    return () => {
      mountedRef.current = false
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [fetchProcesses])

  useEffect(() => {
    setSelectedPid(null)
  }, [activeServerId])

  const filtered = processes.filter((p) =>
    p.command.toLowerCase().includes(search.toLowerCase())
  )

  const handleKill = async () => {
    if (selectedPid === null || !sessionId) return
    setKilling(true)
    try {
      const resp = await KillProcess({ sessionId, pid: selectedPid, signal: 'TERM' })
      if (resp.success) {
        setSelectedPid(null)
        setConfirmVisible(false)
        await fetchProcesses()
      }
    } catch {
    } finally {
      setKilling(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
          </svg>
          <div className="text-sm">未连接到服务器</div>
          <div className="text-xs text-text-dim/50 mt-1">请先连接服务器以查看进程</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-surface-400/50 flex-shrink-0">
        <div className="flex items-center bg-surface-500 rounded overflow-hidden">
          <button
            className={`px-2.5 py-1 text-[11px] transition-colors ${
              sort === 'cpu' ? 'bg-primary-500/20 text-primary-300' : 'text-text-dim hover:text-text-muted'
            }`}
            onClick={() => setSort('cpu')}
          >
            CPU
          </button>
          <button
            className={`px-2.5 py-1 text-[11px] transition-colors ${
              sort === 'mem' ? 'bg-primary-500/20 text-primary-300' : 'text-text-dim hover:text-text-muted'
            }`}
            onClick={() => setSort('mem')}
          >
            MEM
          </button>
        </div>

        <div className="flex-1 relative">
          <svg className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="过滤进程..."
            className="w-full bg-surface-500 text-text text-[11px] pl-7 pr-2 py-1 rounded border border-border/30 focus:border-primary-500/50 focus:outline-none placeholder:text-text-dim/50 transition-colors"
          />
        </div>

        <button
          className={`px-2.5 py-1 rounded text-[11px] transition-colors flex items-center gap-1 ${
            selectedPid !== null
              ? 'bg-danger/15 text-danger hover:bg-danger/25'
              : 'bg-surface-500 text-text-dim/40 cursor-not-allowed'
          }`}
          disabled={selectedPid === null}
          onClick={() => setConfirmVisible(true)}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Kill
        </button>

        <div className="flex items-center gap-1 text-text-dim">
          <button
            className="p-1 hover:text-primary-300 transition-colors"
            onClick={fetchProcesses}
            disabled={loading}
            title="刷新"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </button>
          <span className="text-[10px]">5s</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-surface-400 z-10">
            <tr className="text-text-dim text-[11px]">
              <th className="text-left px-3 py-1.5 font-medium w-14">PID</th>
              <th className="text-left px-2 py-1.5 font-medium w-16">USER</th>
              <th className="text-right px-2 py-1.5 font-medium w-14">CPU%</th>
              <th className="text-right px-2 py-1.5 font-medium w-14">MEM%</th>
              <th className="text-right px-2 py-1.5 font-medium w-16">VSZ</th>
              <th className="text-right px-2 py-1.5 font-medium w-16">RSS</th>
              <th className="text-left px-2 py-1.5 font-medium">COMMAND</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((proc) => (
              <tr
                key={proc.pid}
                className={`border-b border-border/20 cursor-pointer transition-colors ${
                  selectedPid === proc.pid
                    ? 'bg-primary-500/10'
                    : 'hover:bg-surface-50/30'
                }`}
                onClick={() => setSelectedPid(selectedPid === proc.pid ? null : proc.pid)}
              >
                <td className="px-3 py-1 font-mono text-text-muted">{proc.pid}</td>
                <td className="px-2 py-1 text-text-muted truncate max-w-[80px]">{proc.user}</td>
                <td className={`px-2 py-1 text-right font-mono ${cpuMemColor(proc.cpu)}`}>
                  {proc.cpu.toFixed(1)}
                </td>
                <td className={`px-2 py-1 text-right font-mono ${cpuMemColor(proc.mem)}`}>
                  {proc.mem.toFixed(1)}
                </td>
                <td className="px-2 py-1 text-right font-mono text-text-dim">{formatMemory(proc.vsz)}</td>
                <td className="px-2 py-1 text-right font-mono text-text-dim">{formatMemory(proc.rss)}</td>
                <td className="px-2 py-1 text-text truncate max-w-[300px]" title={proc.command}>
                  {proc.command}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-text-dim">
                  {loading ? '加载中...' : '无进程数据'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-3 py-1 border-t border-border/40 bg-surface-400/50 flex-shrink-0 text-[10px] text-text-dim">
        <span>进程: {filtered.length}</span>
        {selectedPid !== null && (
          <span className="text-primary-300">
            已选中 PID: {selectedPid}
          </span>
        )}
      </div>

      {confirmVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmVisible(false)}>
          <div
            className="bg-surface-50 rounded-lg shadow-xl border border-border/60 p-4 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-accent-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="text-text font-medium text-sm">终止进程</span>
            </div>
            <p className="text-text-muted text-xs mb-4">
              确定要终止进程 <span className="text-text font-mono">PID {selectedPid}</span> 吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded text-xs text-text-muted hover:bg-surface-100 transition-colors"
                onClick={() => setConfirmVisible(false)}
              >
                取消
              </button>
              <button
                className="px-3 py-1.5 rounded text-xs bg-danger/20 text-danger hover:bg-danger/30 transition-colors disabled:opacity-50"
                onClick={handleKill}
                disabled={killing}
              >
                {killing ? '终止中...' : '终止'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProcessManager
