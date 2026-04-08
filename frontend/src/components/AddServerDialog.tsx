import React, { useState, useEffect } from 'react'
import { useUIStore, useConnectionStore } from '../stores/ui'
import { ServerConfig } from '../types'
import { AddServer, UpdateServer, GetServers } from '../../wailsjs/go/config/ConfigManager'

const emptyServer: ServerConfig = {
  id: '', name: '', group: '', host: '', port: 22, username: 'root',
  authType: 'password', password: '', privateKey: '',
  vncEnabled: false, vncPort: 5900, vncPassword: '', vncTunnel: false,
  favorite: false, tags: [],
}

const AddServerDialog: React.FC = () => {
  const { showAddServerDialog, setShowAddServerDialog, editingServer, setEditingServer } = useUIStore()
  const { setServers } = useConnectionStore()
  const [form, setForm] = useState<ServerConfig>(emptyServer)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showVnc, setShowVnc] = useState(false)

  useEffect(() => {
    if (editingServer) {
      setForm({ ...editingServer })
      setShowVnc(editingServer.vncEnabled || false)
    } else {
      setForm({ ...emptyServer })
      setShowVnc(false)
    }
    setError('')
  }, [editingServer, showAddServerDialog])

  if (!showAddServerDialog) return null

  const handleClose = () => {
    setShowAddServerDialog(false)
    setEditingServer(null)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.host.trim()) {
      setError('名称和主机地址不能为空')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editingServer) {
        const resp = await UpdateServer({ server: form } as any)
        if (!resp.success) { setError(resp.error || '保存失败'); setSaving(false); return }
      } else {
        const resp = await AddServer({ server: form } as any)
        if (!resp.success) { setError(resp.error || '添加失败'); setSaving(false); return }
      }
      const result = await GetServers()
      setServers((result.servers || []))
      handleClose()
    } catch (e: any) {
      setError(e.toString())
    }
    setSaving(false)
  }

  const updateField = <K extends keyof ServerConfig>(key: K, value: ServerConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-surface-300 rounded-lg shadow-glass w-[400px] border border-border/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <span className="text-sm font-medium text-text">{editingServer ? '编辑服务器' : '添加服务器'}</span>
          <button className="p-0.5 rounded text-text-dim hover:text-text transition-colors" onClick={handleClose}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <input className="input-field text-xs" value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="名称" />
            </div>
            <div>
              <input type="number" className="input-field text-xs font-mono" value={form.port} onChange={(e) => updateField('port', parseInt(e.target.value) || 22)} placeholder="端口" />
            </div>
          </div>

          <input className="input-field text-xs font-mono" value={form.host} onChange={(e) => updateField('host', e.target.value)} placeholder="主机地址 (如 192.168.1.100)" />

          <input className="input-field text-xs" value={form.username} onChange={(e) => updateField('username', e.target.value)} placeholder="用户名" />

          <div className="flex gap-2">
            <button
              className={`flex-1 py-1.5 text-xs rounded border transition-colors ${form.authType === 'password' ? 'border-primary-400 bg-primary-500/10 text-primary-300' : 'border-border text-text-dim hover:border-border-hover'}`}
              onClick={() => updateField('authType', 'password')}
            >密码认证</button>
            <button
              className={`flex-1 py-1.5 text-xs rounded border transition-colors ${form.authType === 'key' ? 'border-primary-400 bg-primary-500/10 text-primary-300' : 'border-border text-text-dim hover:border-border-hover'}`}
              onClick={() => updateField('authType', 'key')}
            >密钥认证</button>
          </div>

          {form.authType === 'password' ? (
            <input type="password" className="input-field text-xs" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="密码" />
          ) : (
            <textarea className="input-field text-xs font-mono h-20 resize-none" value={form.privateKey} onChange={(e) => updateField('privateKey', e.target.value)} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----" />
          )}

          <button
            className="w-full text-left text-xs text-text-dim hover:text-text-muted py-1 flex items-center gap-1 transition-colors"
            onClick={() => setShowVnc(!showVnc)}
          >
            <svg className={`w-3 h-3 transition-transform ${showVnc ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
            </svg>
            VNC 设置
          </button>

          {showVnc && (
            <div className="space-y-2 pl-2 border-l-2 border-border/40">
              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                <input type="checkbox" checked={form.vncEnabled} onChange={(e) => updateField('vncEnabled', e.target.checked)} className="rounded" />
                启用 VNC
              </label>
              {form.vncEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" className="input-field text-xs font-mono" value={form.vncPort} onChange={(e) => updateField('vncPort', parseInt(e.target.value) || 5900)} placeholder="VNC 端口" />
                  <input type="password" className="input-field text-xs" value={form.vncPassword} onChange={(e) => updateField('vncPassword', e.target.value)} placeholder="VNC 密码" />
                </div>
              )}
            </div>
          )}

          {error && <div className="text-xs text-danger">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border/40">
          <button className="btn-ghost text-xs" onClick={handleClose}>取消</button>
          <button className="btn-primary text-xs" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : editingServer ? '更新' : '添加'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddServerDialog
