import React from 'react'
import { useUIStore, useConnectionStore } from '../stores/ui'

const StatusBar: React.FC = () => {
  const { activeServerId, statusMessage, latency, transferRate } = useUIStore()
  const { connections } = useConnectionStore()

  const conn = activeServerId ? connections.get(activeServerId) : null

  return (
    <div className="h-6 bg-tertiary border-t border-secondary flex items-center px-4 text-xs text-gray-500 flex-shrink-0">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${conn ? 'bg-green-500' : 'bg-gray-600'}`} />
          {statusMessage}
        </span>
        {conn && (
          <>
            <span>SSH-2.0</span>
            {latency > 0 && <span>延迟: {latency}ms</span>}
          </>
        )}
        {transferRate !== '0 KB/s' && <span>速率: {transferRate}</span>}
      </div>
      <div className="ml-auto">
        <span>wsShell v0.1.0</span>
      </div>
    </div>
  )
}

export default StatusBar
