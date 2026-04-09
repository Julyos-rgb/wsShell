import React from 'react'
import { useUIStore, useConnectionStore } from '../stores/ui'

const StatusBar: React.FC = () => {
  const { activeServerId, statusMessage, latency, transferRate } = useUIStore()
  const { connections } = useConnectionStore()

  const conn = activeServerId ? connections[activeServerId] : null

  return (
    <>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${conn ? 'bg-accent-green' : 'bg-text-dim/40'}`} />
      <span className="ml-2 text-xs text-text-dim truncate">{statusMessage}</span>
      {conn && latency > 0 && (
        <span className={`ml-3 text-xs ${latency > 500 ? 'text-danger' : latency > 200 ? 'text-accent-yellow' : 'text-accent-green'}`}>
          {latency}ms
        </span>
      )}
      {transferRate !== '0 KB/s' && (
        <span className="ml-3 text-xs text-accent-blue">{transferRate}</span>
      )}
    </>
  )
}

export default StatusBar
