import React from 'react'
import { useUIStore, useConnectionStore } from '../stores/ui'

const StatusBar: React.FC = () => {
  const { activeServerId, statusMessage, latency, transferRate } = useUIStore()
  const { connections } = useConnectionStore()

  const conn = activeServerId ? connections.get(activeServerId) : null

  return (
    <div className="h-7 glass-panel rounded-none border-x-0 border-b-0 flex items-center px-4 text-xs text-text-dim flex-shrink-0">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className={`status-dot ${conn ? 'status-dot-connected' : 'status-dot-disconnected'}`} />
          {statusMessage}
        </span>
        {conn && (
          <>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              SSH-2.0
            </span>
            {latency > 0 && (
              <span className={`flex items-center gap-1 ${latency > 200 ? 'text-accent-yellow' : latency > 500 ? 'text-danger' : 'text-accent-green'}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {latency}ms
              </span>
            )}
          </>
        )}
        {transferRate !== '0 KB/s' && (
          <span className="flex items-center gap-1 text-accent-blue">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            {transferRate}
          </span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-text-dim/50">wsShell v0.1.0</span>
      </div>
    </div>
  )
}

export default StatusBar
