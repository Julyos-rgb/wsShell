import React from 'react'
import { useUIStore, useConnectionStore } from '../stores/ui'

const StatusBar: React.FC = () => {
  const { activeServerId, statusMessage, latency, transferRate } = useUIStore()
  const { connections } = useConnectionStore()

  const conn = activeServerId ? connections.get(activeServerId) : null

  return (
    <div className="h-6 bg-surface-400 border-t border-border/40 flex items-center px-3 text-[10px] text-text-dim flex-shrink-0">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${conn ? 'bg-accent-green' : 'bg-text-dim'}`} />
      <span className="ml-1.5 truncate">{statusMessage}</span>
      {conn && latency > 0 && (
        <span className={`ml-3 ${latency > 200 ? 'text-accent-yellow' : latency > 500 ? 'text-danger' : 'text-accent-green'}`}>
          {latency}ms
        </span>
      )}
      {transferRate !== '0 KB/s' && (
        <span className="ml-3 text-accent-blue">{transferRate}</span>
      )}
      <span className="ml-auto text-text-dim/40">wsShell</span>
    </div>
  )
}

export default StatusBar
