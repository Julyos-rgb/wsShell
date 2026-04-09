import React from 'react'
import { useUIStore, useConnectionStore } from '../stores/ui'

const StatusBar: React.FC = () => {
  const { activeServerId, statusMessage, latency, transferRate } = useUIStore()
  const { connections } = useConnectionStore()

  const conn = activeServerId ? connections[activeServerId] : null

  return (
    <>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ml-2 ${conn ? 'bg-accent-green' : 'bg-text-dim'}`} />
      <span className="ml-1.5 truncate text-[10px] text-text-dim">{statusMessage}</span>
      {conn && latency > 0 && (
        <span className={`ml-3 text-[10px] ${latency > 200 ? 'text-accent-yellow' : latency > 500 ? 'text-danger' : 'text-accent-green'}`}>
          {latency}ms
        </span>
      )}
      {transferRate !== '0 KB/s' && (
        <span className="ml-3 text-[10px] text-accent-blue">{transferRate}</span>
      )}
    </>
  )
}

export default StatusBar
