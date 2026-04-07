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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-tertiary rounded-lg shadow-xl w-[520px] max-h-[90vh] overflow-y-auto border border-secondary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          <h2 className="text-lg font-medium text-white">
            {editingServer ? '编辑服务器' : '添加服务器'}
          </h2>
          <button className="text-gray-400 hover:text-white text-xl" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="flex border-b border-secondary">
          <button
            className={`flex-1 py-2 text-sm ${tab === 'basic' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
            onClick={() => setTab('basic')}
          >
            基本设置
          </button>
          <button
            className={`flex-1 py-2 text-sm ${tab === 'vnc' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
            onClick={() => setTab('vnc')}
          >
            VNC 设置
          </button>
        </div>

        <div className="p-4 space-y-4">
          {tab === 'basic' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">服务器名称 *</label>
                  <input
                    className="w-full bg-surface border border-secondary rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="如: 生产服务器-1"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">分组</label>
                  <input
                    className="w-full bg-surface border border-secondary rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    value={form.group}
                    onChange={(e) => updateField('group', e.target.value)}
                    placeholder="如: 生产环境"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">主机地址 *</label>
                  <input
                    className="w-full bg-surface border border-secondary rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    value={form.host}
                    onChange={(e) => updateField('host', e.target.value)}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">端口</label>
                  <input
                    type="number"
                    className="w-full bg-surface border border-secondary rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    value={form.port}
                    onChange={(e) => updateField('port', parseInt(e.target.value) || 22)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">用户名</label>
                <input
                  className="w-full bg-surface border border-secondary rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  value={form.username}
                  onChange={(e) => updateField('username', e.target.value)}
                  placeholder="root"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">认证方式</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <input
                      type="radio"
                      name="authType"
                      checked={form.authType === 'password'}
                      onChange={() => updateField('authType', 'password')}
                      className="accent-primary"
                    />
                    密码
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <input
                      type="radio"
                      name="authType"
                      checked={form.authType === 'key'}
                      onChange={() => updateField('authType', 'key')}
                      className="accent-primary"
                    />
                    密钥
                  </label>
                </div>
              </div>

              {form.authType === 'password' ? (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">密码</label>
                  <input
                    type="password"
                    className="w-full bg-surface border border-secondary rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="SSH 密码"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">私钥</label>
                  <textarea
                    className="w-full bg-surface border border-secondary rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary h-32 font-mono"
                    value={form.privateKey}
                    onChange={(e) => updateField('privateKey', e.target.value)}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.favorite}
                  onChange={(e) => updateField('favorite', e.target.checked)}
                  className="accent-primary"
                />
                添加到收藏
              </label>
            </>
          )}

          {tab === 'vnc' && (
            <>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.vncEnabled}
                  onChange={(e) => updateField('vncEnabled', e.target.checked)}
                  className="accent-primary"
                />
                启用 VNC
              </label>

              {form.vncEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">VNC 端口</label>
                      <input
                        type="number"
                        className="w-full bg-surface border border-secondary rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                        value={form.vncPort}
                        onChange={(e) => updateField('vncPort', parseInt(e.target.value) || 5900)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">VNC 密码</label>
                      <input
                        type="password"
                        className="w-full bg-surface border border-secondary rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                        value={form.vncPassword}
                        onChange={(e) => updateField('vncPassword', e.target.value)}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.vncTunnel}
                      onChange={(e) => updateField('vncTunnel', e.target.checked)}
                      className="accent-primary"
                    />
                    通过 SSH 隧道连接
                  </label>
                </>
              )}
            </>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-secondary">
          <button
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            onClick={handleClose}
          >
            取消
          </button>
          <button
            className="px-4 py-2 text-sm bg-primary text-background rounded hover:brightness-110 transition-all disabled:opacity-50"
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
