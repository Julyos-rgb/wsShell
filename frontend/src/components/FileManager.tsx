import React, { useState, useEffect, useCallback } from 'react'
import { useConnectionStore } from '../stores/ui'
import { FileEntry } from '../types'
import {
  ListFiles,
  ListLocalFiles,
  UploadFile,
  DownloadFile,
  DeleteFile,
  Mkdir,
  Rename,
} from '../../wailsjs/go/sftp/SFTPManager'

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '-'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}M`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}G`
}

const FileManager: React.FC = () => {
  const { activeServerId, connections, sftpSessions } = useConnectionStore()
  const [localFiles, setLocalFiles] = useState<FileEntry[]>([])
  const [remoteFiles, setRemoteFiles] = useState<FileEntry[]>([])
  const [localPath, setLocalPath] = useState('')
  const [remotePath, setRemotePath] = useState('/')
  const [localLoading, setLocalLoading] = useState(false)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [selectedLocal, setSelectedLocal] = useState<string | null>(null)
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null)
  const [localHistory, setLocalHistory] = useState<string[]>([])
  const [remoteHistory, setRemoteHistory] = useState<string[]>([])

  const getSftpSessionId = useCallback(() => {
    if (!activeServerId) return null
    return sftpSessions.get(activeServerId) || null
  }, [activeServerId, sftpSessions])

  const loadLocalFiles = useCallback(async (path?: string) => {
    setLocalLoading(true)
    try {
      const resp = await ListLocalFiles({ path: path || localPath })
      if (resp.success) {
        setLocalFiles(resp.files || [])
        setLocalPath(resp.path || '')
      }
    } catch (e) {
      console.error('load local files error:', e)
    }
    setLocalLoading(false)
  }, [localPath])

  const loadRemoteFiles = useCallback(async (path?: string) => {
    const sessionId = getSftpSessionId()
    if (!sessionId) return
    setRemoteLoading(true)
    try {
      const resp = await ListFiles({ sessionId, path: path || remotePath })
      if (resp.success) {
        setRemoteFiles(resp.files || [])
        setRemotePath(resp.path || '/')
      }
    } catch (e) {
      console.error('load remote files error:', e)
    }
    setRemoteLoading(false)
  }, [getSftpSessionId, remotePath])

  useEffect(() => {
    const homePath = ''
    loadLocalFiles(homePath)
  }, [])

  useEffect(() => {
    const sessionId = getSftpSessionId()
    if (sessionId) {
      loadRemoteFiles('/')
    }
  }, [activeServerId, sftpSessions])

  const navigateLocal = (path: string) => {
    setLocalHistory((prev) => [...prev, localPath])
    loadLocalFiles(path)
  }

  const navigateRemote = (path: string) => {
    setRemoteHistory((prev) => [...prev, remotePath])
    loadRemoteFiles(path)
  }

  const goBackLocal = () => {
    if (localHistory.length > 0) {
      const prev = localHistory[localHistory.length - 1]
      setLocalHistory((h) => h.slice(0, -1))
      loadLocalFiles(prev)
    } else if (localPath.includes('/') || localPath.includes('\\')) {
      const parent = localPath.split(/[/\\]/).slice(0, -1).join('/') || '/'
      loadLocalFiles(parent)
    }
  }

  const goBackRemote = () => {
    if (remoteHistory.length > 0) {
      const prev = remoteHistory[remoteHistory.length - 1]
      setRemoteHistory((h) => h.slice(0, -1))
      loadRemoteFiles(prev)
    } else if (remotePath !== '/') {
      const parts = remotePath.split('/').filter(Boolean)
      parts.pop()
      const parent = '/' + parts.join('/')
      loadRemoteFiles(parent || '/')
    }
  }

  const handleUpload = async () => {
    if (!selectedLocal || !getSftpSessionId()) return
    const file = localFiles.find((f) => f.path === selectedLocal)
    if (!file || file.type === 'directory') return
    try {
      await UploadFile({
        sessionId: getSftpSessionId()!,
        localPath: file.path,
        remotePath: remotePath + '/' + file.name,
      })
      loadRemoteFiles()
    } catch (e) {
      console.error('upload error:', e)
    }
  }

  const handleDownload = async () => {
    if (!selectedRemote || !getSftpSessionId()) return
    const file = remoteFiles.find((f) => f.path === selectedRemote)
    if (!file || file.type === 'directory') return
    try {
      await DownloadFile({
        sessionId: getSftpSessionId()!,
        remotePath: file.path,
        localPath: localPath + '\\' + file.name,
      })
      loadLocalFiles()
    } catch (e) {
      console.error('download error:', e)
    }
  }

  const handleDeleteRemote = async () => {
    if (!selectedRemote || !getSftpSessionId()) return
    try {
      await DeleteFile({ sessionId: getSftpSessionId()!, path: selectedRemote })
      loadRemoteFiles()
      setSelectedRemote(null)
    } catch (e) {
      console.error('delete error:', e)
    }
  }

  const handleMkdirRemote = async () => {
    const name = prompt('目录名称:')
    if (!name || !getSftpSessionId()) return
    try {
      await Mkdir({
        sessionId: getSftpSessionId()!,
        path: remotePath === '/' ? '/' + name : remotePath + '/' + name,
      })
      loadRemoteFiles()
    } catch (e) {
      console.error('mkdir error:', e)
    }
  }

  const hasConnection = !!getSftpSessionId()

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Local files */}
        <div className="w-1/2 border-r border-secondary flex flex-col">
          <div className="p-2 bg-tertiary border-b border-secondary">
            <div className="flex items-center gap-2">
              <button
                className="text-gray-400 hover:text-primary px-1"
                onClick={goBackLocal}
              >
                ↑
              </button>
              <span className="flex-1 text-xs bg-surface px-2 py-1 rounded truncate text-gray-300">
                {localPath}
              </span>
              <button
                className="text-gray-400 hover:text-primary px-1 text-xs"
                onClick={() => loadLocalFiles()}
                title="刷新"
              >
                ⟳
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {localLoading ? (
              <div className="text-center text-gray-500 text-sm py-4">加载中...</div>
            ) : (
              localFiles.map((file, i) => (
                <div
                  key={i}
                  className={`flex justify-between items-center px-3 py-1 cursor-pointer transition-colors ${
                    selectedLocal === file.path
                      ? 'bg-secondary/50 text-primary'
                      : 'hover:bg-surface text-gray-300'
                  }`}
                  onClick={() => setSelectedLocal(file.path)}
                  onDoubleClick={() =>
                    file.type === 'directory' ? navigateLocal(file.path) : undefined
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm flex-shrink-0">
                      {file.type === 'directory' ? '📁' : '📄'}
                    </span>
                    <span className="truncate text-sm">{file.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {file.type === 'file' ? formatSize(file.size) : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Remote files */}
        <div className="w-1/2 flex flex-col">
          <div className="p-2 bg-tertiary border-b border-secondary">
            <div className="flex items-center gap-2">
              <button
                className="text-gray-400 hover:text-primary px-1"
                onClick={goBackRemote}
              >
                ↑
              </button>
              <span className="flex-1 text-xs bg-surface px-2 py-1 rounded truncate text-gray-300">
                {hasConnection ? remotePath : '未连接'}
              </span>
              {hasConnection && (
                <button
                  className="text-gray-400 hover:text-primary px-1 text-xs"
                  onClick={() => loadRemoteFiles()}
                  title="刷新"
                >
                  ⟳
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!hasConnection ? (
              <div className="text-center text-gray-600 text-sm py-8">
                请先连接服务器
              </div>
            ) : remoteLoading ? (
              <div className="text-center text-gray-500 text-sm py-4">加载中...</div>
            ) : (
              remoteFiles.map((file, i) => (
                <div
                  key={i}
                  className={`flex justify-between items-center px-3 py-1 cursor-pointer transition-colors ${
                    selectedRemote === file.path
                      ? 'bg-secondary/50 text-primary'
                      : 'hover:bg-surface text-gray-300'
                  }`}
                  onClick={() => setSelectedRemote(file.path)}
                  onDoubleClick={() =>
                    file.type === 'directory' ? navigateRemote(file.path) : undefined
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm flex-shrink-0">
                      {file.type === 'directory' ? '📁' : '📄'}
                    </span>
                    <span className="truncate text-sm">{file.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {file.type === 'file' ? formatSize(file.size) : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {hasConnection && (
        <div className="h-8 bg-tertiary border-t border-secondary flex items-center px-3 gap-2">
          <button
            className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 disabled:opacity-40"
            onClick={handleUpload}
            disabled={!selectedLocal}
          >
            上传 →
          </button>
          <button
            className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 disabled:opacity-40"
            onClick={handleDownload}
            disabled={!selectedRemote}
          >
            ← 下载
          </button>
          <button
            className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30"
            onClick={handleMkdirRemote}
          >
            新建目录
          </button>
          <button
            className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 disabled:opacity-40"
            onClick={handleDeleteRemote}
            disabled={!selectedRemote}
          >
            删除
          </button>
        </div>
      )}
    </div>
  )
}

export default FileManager
