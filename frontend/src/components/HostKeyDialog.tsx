import React from 'react'

interface HostKeyDialogProps {
  open: boolean
  isMismatch: boolean
  host: string
  keyType: string
  fingerprint: string
  expectedFingerprint?: string
  onTrust: () => void
  onReject: () => void
}

const HostKeyDialog: React.FC<HostKeyDialogProps> = ({
  open, isMismatch, host, keyType, fingerprint, expectedFingerprint, onTrust, onReject,
}) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onReject}>
      <div
        className="bg-surface-300 rounded-lg shadow-glass w-full max-w-[420px] mx-4 border border-border/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border/40">
          <span className="text-sm font-medium text-text">
            {isMismatch ? '⚠ 主机密钥不匹配' : '新的主机密钥'}
          </span>
        </div>

        <div className="p-4 space-y-3">
          {isMismatch ? (
            <div className="text-xs text-danger space-y-2">
              <div>服务器 <span className="font-mono text-text">{host}</span> 的主机密钥与之前记录的不一致！</div>
              <div>这可能是中间人攻击，也可能是服务器重装了系统。</div>
              <div className="space-y-1">
                <div>之前记录的指纹 ({keyType}):</div>
                <div className="font-mono bg-surface-500 px-2 py-1 rounded text-text-muted break-all">{expectedFingerprint}</div>
              </div>
              <div className="space-y-1">
                <div>当前的指纹 ({keyType}):</div>
                <div className="font-mono bg-surface-500 px-2 py-1 rounded text-text-muted break-all">{fingerprint}</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-text-muted space-y-2">
              <div>首次连接到服务器 <span className="font-mono text-text">{host}</span></div>
              <div>主机密钥指纹 ({keyType}):</div>
              <div className="font-mono bg-surface-500 px-2 py-1.5 rounded text-text-muted break-all">{fingerprint}</div>
              <div className="text-text-dim">请确认此指纹与服务器实际密钥一致后信任。</div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border/40">
          <button className="btn-ghost text-xs" onClick={onReject}>取消</button>
          {isMismatch ? (
            <button className="btn-danger text-xs" onClick={onTrust}>仍然信任并更新密钥</button>
          ) : (
            <button className="btn-primary text-xs" onClick={onTrust}>信任此主机</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default HostKeyDialog
