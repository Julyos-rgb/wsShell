import React, { useState, useEffect } from 'react'
import { useUIStore, useConnectionStore } from '../stores/ui'
import { ServerConfig } from '../types'
import {
  AddServer,
  UpdateServer,
  GetServers,
} from '../../wailsjs/go/config/ConfigManager'

const emptyServer: ServerConfig = {
  id: '',
  name: '',
  group: '',
  host: '',
  port: 22,
  username: 'root',
  authType: 'password',
  password: '',
  privateKey: '',
  vncEnabled: false,
  vncPort: 5900,
  vncPassword: '',
  vncTunnel: false,
  favorite: false,
  tags: [],
}

const AddServerDialog: React.FC = () => {
  const { showAddServerDialog, setShowAddServerDialog, editingServer, setEditingServer } = useUIStore()
  const { setServers } = useConnectionStore()
  const [form, setForm] = useState<ServerConfig>(emptyServer)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'basic' | 'vnc'>('basic')

  useEffect(() => {
    if (editingServer) {
      setForm({ ...editingServer })
    } else {
      setForm({ ...emptyServer })
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
      setError('服务器名称和主机地址不能为空')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (editingServer) {
        const resp = await UpdateServer({ server: form } as any)
        if (!resp.success) {
          setError(resp.error || '保存失败')
          setSaving(false)
          return
        }
      } else {
        const resp = await AddServer({ server: form } as any)
        if (!resp.success) {
          setError(resp.error || '添加失败')
          setSaving(false)
          return
        }
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={handleClose}>
      <div
        className="glass-panel rounded-2xl shadow-glass w-[520px] max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <h2 className="text-base font-semibold text-text flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            {editingServer ? '编辑服务器' : '添加服务器'}
          </h2>
          <button className="p-1 rounded-lg text-text-dim hover:text-text hover:bg-surface-50/50 transition-all" onClick={handleClose}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-border/40">
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-all relative ${
              tab === 'basic' ? 'text-primary-300' : 'text-text-dim hover:text-text-muted'
            }`}
            onClick={() => setTab('basic')}
          >
            基本设置
            {tab === 'basic' && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary-400 rounded-full" />}
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-all relative ${
              tab === 'vnc' ? 'text-primary-300' : 'text-text-dim hover:text-text-muted'
            }`}
            onClick={() => setTab('vnc')}
          >
            VNC 设置
            {tab === 'vnc' && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary-400 rounded-full" />}
          </button>
        </div>

        <div className="p-5 space-y-4">
          {tab === 'basic' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-subtext mb-1.5 font-medium">服务器名称 *</label>
                  <input
                    className="input-field"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="如: 生产服务器-1"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-subtext mb-1.5 font-medium">分组</label>
                  <input
                    className="input-field"
                    value={form.group}
                    onChange={(e) => updateField('group', e.target.value)}
                    placeholder="如: 生产环境"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-text-subtext mb-1.5 font-medium">主机地址 *</label>
                  <input
                    className="input-field font-mono"
                    value={form.host}
                    onChange={(e) => updateField('host', e.target.value)}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-subtext mb-1.5 font-medium">端口</label>
                  <input
                    type="number"
                    className="input-field font-mono"
                    value={form.port}
                    onChange={(e) => updateField('port', parseInt(e.target.value) || 22)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-subtext mb-1.5 font-medium">用户名</label>
                <input
                  className="input-field"
                  value={form.username}
                  onChange={(e) => updateField('username', e.target.value)}
                  placeholder="root"
                />
              </div>

              <div>
                <label className="block text-xs text-text-subtext mb-1.5 font-medium">认证方式</label>
                <div className="flex gap-3">
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                    form.authType === 'password'
                      ? 'border-primary-400 bg-primary-500/10 text-primary-300'
                      : 'border-border text-text-muted hover:border-border-hover'
                  }`}>
                    <input
                      type="radio"
                      name="authType"
                      checked={form.authType === 'password'}
                      onChange={() => updateField('authType', 'password')}
                      className="sr-only"
                    />
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-sm">密码</span>
                  </label>
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                    form.authType === 'key'
                      ? 'border-primary-400 bg-primary-500/10 text-primary-300'
                      : 'border-border text-text-muted hover:border-border-hover'
                  }`}>
                    <input
                      type="radio"
                      name="authType"
                      checked={form.authType === 'key'}
                      onChange={() => updateField('authType', 'key')}
                      className="sr-only"
                    />
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <span className="text-sm">密钥</span>
                  </label>
                </div>
              </div>

              {form.authType === 'password' ? (
                <div>
                  <label className="block text-xs text-text-subtext mb-1.5 font-medium">密码</label>
                  <input
                    type="password"
                    className="input-field"
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="SSH 密码"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-text-subtext mb-1.5 font-medium">私钥</label>
                  <textarea
                    className="input-field h-28 font-mono text-xs resize-none"
                    value={form.privateKey}
                    onChange={(e) => updateField('privateKey', e.target.value)}
                    placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                  />
                </div>
              )}

              <label className="flex items-center gap-2.5 text-sm text-text-muted cursor-pointer hover:text-text transition-colors">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                  form.favorite ? 'border-accent-yellow bg-accent-yellow/20' : 'border-border hover:border-border-hover'
                }`}>
                  {form.favorite && (
                    <svg className="w-3 h-3 text-accent-yellow" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={form.favorite}
                  onChange={(e) => updateField('favorite', e.target.checked)}
                  className="sr-only"
                />
                添加到收藏
              </label>
            </>
          )}

          {tab === 'vnc' && (
            <>
              <label className="flex items-center gap-2.5 text-sm text-text-muted cursor-pointer hover:text-text transition-colors">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  form.vncEnabled ? 'border-primary-400 bg-primary-500/20' : 'border-border hover:border-border-hover'
                }`}>
                  {form.vncEnabled && (
                    <svg className="w-3.5 h-3.5 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={form.vncEnabled}
                  onChange={(e) => updateField('vncEnabled', e.target.checked)}
                  className="sr-only"
                />
                启用 VNC
              </label>

              {form.vncEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-text-subtext mb-1.5 font-medium">VNC 端口</label>
                      <input
                        type="number"
                        className="input-field font-mono"
                        value={form.vncPort}
                        onChange={(e) => updateField('vncPort', parseInt(e.target.value) || 5900)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-subtext mb-1.5 font-medium">VNC 密码</label>
                      <input
                        type="password"
                        className="input-field"
                        value={form.vncPassword}
                        onChange={(e) => updateField('vncPassword', e.target.value)}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 text-sm text-text-muted cursor-pointer hover:text-text transition-colors">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      form.vncTunnel ? 'border-primary-400 bg-primary-500/20' : 'border-border hover:border-border-hover'
                    }`}>
                      {form.vncTunnel && (
                        <svg className="w-3.5 h-3.5 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={form.vncTunnel}
                      onChange={(e) => updateField('vncTunnel', e.target.checked)}
                      className="sr-only"
                    />
                    通过 SSH 隧道连接
                  </label>
                </>
              )}
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-danger bg-danger-dark/30 border border-danger/30 rounded-lg px-3 py-2.5">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border/40">
          <button className="btn-ghost" onClick={handleClose}>
            取消
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : editingServer ? '更新' : '添加'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddServerDialog
