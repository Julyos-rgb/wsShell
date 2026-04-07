import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useConnectionStore, useUIStore, useTransferStore } from '../stores/ui'
import { FileEntry } from '../types'
import {
  ListFiles,
  ListLocalFiles,
  UploadFile,
  DownloadFile,
  DeleteFile,
  Mkdir,
} from '../../wailsjs/go/sftp/SFTPManager'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'

const formatSize = (bytes: number): string => {
    if (bytes === 0) return '-'
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}M`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}G`
}

interface FileItemProps {
    file: FileEntry
    isSelected: boolean
    onSelect: (path: string) => void
    onNavigate: (path: string) => void
}

const FileItem: React.FC<FileItemProps> = ({ file, isSelected, onSelect, onNavigate }) => {
    return (
        <div
            className={`flex justify-between items-center px-3 py-1 cursor-pointer transition-colors ${
                isSelected
                    ? 'bg-secondary/50 text-primary'
                    : 'hover:bg-surface text-gray-300'
            }`}
            onClick={() => onSelect(file.path)}
            onDoubleClick={() => file.type === 'directory' ? onNavigate(file.path) : undefined}
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
    )
}

const FileManager: React.FC = () => {
    const { sftpSessions } = useConnectionStore()
    const activeServerId = useUIStore((s) => s.activeServerId)
    const { transfers, addTransfer, updateTransfer } = useTransferStore()
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
    const [isDragging, setIsDragging] = useState(false)
    const dropZoneRef = useRef<HTMLDivElement>(null)

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
                setRemoteFiles((resp.files || []) as FileEntry[])
                setRemotePath(resp.path || '/')
            }
        } catch (e) {
            console.error('load remote files error:', e)
        }
        setRemoteLoading(false)
    }, [getSftpSessionId, remotePath])

    useEffect(() => {
        loadLocalFiles('')
    }, [])

    useEffect(() => {
        const sessionId = getSftpSessionId()
        if (sessionId) {
            loadRemoteFiles('/')
        }
    }, [activeServerId, sftpSessions])

    useEffect(() => {
        const handleUploadProgress = (data: any) => {
            const taskId = `upload-${data.localPath}-${data.remotePath}`
            const existing = transfers.find(t => t.id === taskId)
            if (!existing) return
            updateTransfer(taskId, {
                progress: data.progress,
                written: data.written,
                total: data.total,
                status: data.progress >= 100 ? 'completed' : existing.status,
            })
        }
        EventsOn('sftp:upload:progress', handleUploadProgress)
        return () => {
            EventsOff('sftp:upload:progress')
        }
    }, [transfers, updateTransfer])

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
            } as any)
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
            } as any)
            loadRemoteFiles()
        } catch (e) {
            console.error('mkdir error:', e)
        }
    }

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        const sessionId = getSftpSessionId()
        if (!sessionId) return
        const files = e.dataTransfer?.files
        if (!files || files.length === 0) return
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            if (!file.name) continue
            const taskId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            addTransfer({
                id: taskId,
                type: 'upload',
                localPath: (file as any).path,
                remotePath: remotePath + '/' + file.name,
                progress: 0,
                total: file.size,
                written: 0,
                status: 'pending',
            })
            try {
                await UploadFile({
                    sessionId,
                    localPath: (file as any).path,
                    remotePath: remotePath + '/' + file.name,
                })
                updateTransfer(taskId, { status: 'completed', progress: 100 })
            } catch (err: any) {
                updateTransfer(taskId, { status: 'error', error: String(err) })
            }
        }
        loadRemoteFiles()
    }, [getSftpSessionId, remotePath, addTransfer, updateTransfer, loadRemoteFiles])

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
                                <FileItem
                                    key={i}
                                    file={file}
                                    isSelected={selectedLocal === file.path}
                                    onSelect={setSelectedLocal}
                                    onNavigate={navigateLocal}
                                />
                            ))
                        )}
                    </div>
                </div>
                {/* Remote files */}
                <div
                    ref={dropZoneRef}
                    className={`w-1/2 flex flex-col ${isDragging ? 'bg-blue-500/10' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
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
                    <div className="flex-1 overflow-y-auto relative">
                        {!hasConnection ? (
                            <div className="text-center text-gray-600 text-sm py-8">
                                请先连接服务器
                            </div>
                        ) : isDragging ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 pointer-events-none z-10">
                                <div className="text-blue-400 text-lg font-medium">
                                    释放文件到此处上传
                                </div>
                            </div>
                        ) : remoteLoading ? (
                            <div className="text-center text-gray-500 text-sm py-4">加载中...</div>
                        ) : (
                            remoteFiles.map((file, i) => (
                                <FileItem
                                    key={i}
                                    file={file}
                                    isSelected={selectedRemote === file.path}
                                    onSelect={setSelectedRemote}
                                    onNavigate={navigateRemote}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
            {/* Transfer Progress */}
            {transfers.filter(t => t.status === 'pending' || t.status === 'completed').length > 0 && (
                <div className="h-20 bg-tertiary border-t border-secondary px-3">
                    <div className="text-xs text-gray-400 mb-2">传输进度</div>
                    <div className="space-y-1">
                        {transfers.filter(t => t.status !== 'error').map((task) => {
                            const fileName = task.localPath.split(/[/\\]/).pop()
                            const icon = task.type === 'upload' ? 'up' : 'down'
                            const statusText = task.status === 'completed' ? '完成' : `${task.progress.toFixed(0)}%`
                            return (
                                <div key={task.id} className="flex items-center gap-2 text-xs">
                                    <span>{icon}</span>
                                    <span className="truncate flex-1 text-gray-300">{fileName}</span>
                                    <span className="text-gray-500">-&gt;</span>
                                    <span className="text-gray-300">{statusText}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
            {/* Toolbar */}
            {hasConnection && (
                <div className="h-8 bg-tertiary border-t border-secondary flex items-center px-3 gap-2">
                    <button
                        className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 disabled:opacity-40"
                        onClick={handleUpload}
                        disabled={!selectedLocal}
                    >
                        上传
                    </button>
                    <button
                        className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 disabled:opacity-40"
                        onClick={handleDownload}
                        disabled={!selectedRemote}
                    >
                        下载
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
