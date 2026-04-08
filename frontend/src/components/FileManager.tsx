import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    ListFiles,
    ListLocalFiles,
    UploadFile,
    DownloadFile,
    DeleteFile,
    Mkdir,
    Rename,
    GetTransferState,
    ResumeUpload,
    ResumeDownload,
} from '../../wailsjs/go/sftp/SFTPManager'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import { sftp } from '../../wailsjs/go/models'
import { FileEntry } from '../types'
import { useConnectionStore, useUIStore, useTransferStore } from '../stores/ui'
import {
    LocalDelete,
    LocalMkdir,
    LocalRename,
} from '../../wailsjs/go/sftp/SFTPManager'

const formatSize = (bytes: number): string => {
    if (bytes === 0) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
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
            className={`file-item ${isSelected ? 'file-item-selected' : ''}`}
            onClick={() => onSelect(file.path)}
            onDoubleClick={() => file.type === 'directory' ? onNavigate(file.path) : undefined}
        >
            <div className="flex items-center gap-2.5 min-w-0">
                {file.type === 'directory' ? (
                    <svg className="w-4 h-4 text-accent-yellow flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                ) : (
                    <svg className="w-4 h-4 text-accent-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                )}
                <span className="truncate text-sm">{file.name}</span>
            </div>
            <span className="text-xs text-text-dim flex-shrink-0 ml-2 font-mono">
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

    const handleUpload = async () => {
        if (!selectedLocal || !getSftpSessionId()) return
        const file = localFiles.find((f) => f.path === selectedLocal)
        if (!file || file.type === 'directory') return
        const sessionId = getSftpSessionId()!
        const remoteFilePath = remotePath + '/' + file.name

        try {
            const state = await GetTransferState({
                sessionId,
                localPath: file.path,
                remotePath: remoteFilePath,
                direction: 'upload',
            } as sftp.GetTransferStateRequest)
            if (state.canResume) {
                const confirmed = window.confirm(
                    `检测到已存在部分文件 (${formatSize(state.remoteSize || 0)} / ${formatSize(state.localSize || 0)})，是否断点续传？`
                )
                if (confirmed) {
                    await ResumeUpload({
                        sessionId,
                        localPath: file.path,
                        remotePath: remoteFilePath,
                        offset: -1,
                    } as sftp.ResumeUploadRequest)
                    loadRemoteFiles()
                    return
                }
            }
        } catch (e) {
            console.error('check transfer state error:', e)
        }

        const taskId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        addTransfer({
            id: taskId,
            type: 'upload',
            localPath: file.path,
            remotePath: remoteFilePath,
            progress: 0,
            total: file.size,
            written: 0,
            status: 'pending',
        })
        try {
            await UploadFile({
                sessionId,
                localPath: file.path,
                remotePath: remoteFilePath,
            } as sftp.UploadRequest)
            updateTransfer(taskId, { status: 'completed', progress: 100 })
            loadRemoteFiles()
        } catch (e) {
            console.error('upload error:', e)
            updateTransfer(taskId, { status: 'error', error: String(e) })
        }
    }

    const handleDownload = async () => {
        if (!selectedRemote || !getSftpSessionId()) return
        const file = remoteFiles.find((f) => f.path === selectedRemote)
        if (!file || file.type === 'directory') return
        const sessionId = getSftpSessionId()!
        const localFilePath = localPath + '\\' + file.name

        try {
            const state = await GetTransferState({
                sessionId,
                remotePath: file.path,
                localPath: localFilePath,
                direction: 'download',
            } as sftp.GetTransferStateRequest)
            if (state.canResume) {
                const confirmed = window.confirm(
                    `检测到已存在部分文件 (${formatSize(state.localSize || 0)} / ${formatSize(state.remoteSize || 0)})，是否断点续传？`
                )
                if (confirmed) {
                    await ResumeDownload({
                        sessionId,
                        remotePath: file.path,
                        localPath: localFilePath,
                        offset: -1,
                    } as sftp.ResumeDownloadRequest)
                    loadLocalFiles()
                    return
                }
            }
        } catch (e) {
            console.error('check transfer state error:', e)
        }

        const taskId = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        addTransfer({
            id: taskId,
            type: 'download',
            localPath: localFilePath,
            remotePath: file.path,
            progress: 0,
            total: file.size,
            written: 0,
            status: 'pending',
        })
        try {
            await DownloadFile({
                sessionId,
                remotePath: file.path,
                localPath: localFilePath,
            } as sftp.DownloadRequest)
            updateTransfer(taskId, { status: 'completed', progress: 100 })
            loadLocalFiles()
        } catch (e) {
            console.error('download error:', e)
            updateTransfer(taskId, { status: 'error', error: String(e) })
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

    const handleRenameRemote = async () => {
        if (!selectedRemote || !getSftpSessionId()) return
        const file = remoteFiles.find(f => f.path === selectedRemote)
        if (!file) return
        const newName = prompt('新名称:', file.name)
        if (!newName || newName === file.name) return
        const parentPath = selectedRemote.substring(0, selectedRemote.lastIndexOf('/'))
        const newPath = parentPath + '/' + newName
        try {
            await Rename({
                sessionId: getSftpSessionId()!,
                oldPath: selectedRemote,
                newPath,
            } as sftp.RenameRequest)
            loadRemoteFiles()
            setSelectedRemote(null)
        } catch (e) {
            console.error('rename error:', e)
        }
    }

    const handleDeleteLocal = async () => {
        if (!selectedLocal) return
        if (!confirm('确定要删除此文件/目录吗？')) return
        try {
            await LocalDelete({ path: selectedLocal })
            loadLocalFiles()
            setSelectedLocal(null)
        } catch (e) {
            console.error('local delete error:', e)
        }
    }

    const handleMkdirLocal = async () => {
        const name = prompt('目录名称:')
        if (!name) return
        const sep = localPath.includes('\\') ? '\\' : '/'
        const fullPath = localPath + sep + name
        try {
            await LocalMkdir({ path: fullPath })
            loadLocalFiles()
        } catch (e) {
            console.error('local mkdir error:', e)
        }
    }

    const handleRenameLocal = async () => {
        if (!selectedLocal) return
        const file = localFiles.find(f => f.path === selectedLocal)
        if (!file) return
        const newName = prompt('新名称:', file.name)
        if (!newName || newName === file.name) return
        const sep = selectedLocal.includes('\\') ? '\\' : '/'
        const parts = selectedLocal.split(sep)
        parts[parts.length - 1] = newName
        const newPath = parts.join(sep)
        try {
            await LocalRename({ oldPath: selectedLocal, newPath })
            loadLocalFiles()
            setSelectedLocal(null)
        } catch (e) {
            console.error('local rename error:', e)
        }
    }

    const handleMkdirRemote = async () => {
        const name = prompt('目录名称:')
        if (!name || !getSftpSessionId()) return
        try {
            await Mkdir({
                sessionId: getSftpSessionId()!,
                path: remotePath === '/' ? '/' + name : remotePath + '/' + name,
            } as sftp.MkdirRequest)
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
            const localPath = (file as any).path
            const remoteFilePath = remotePath + '/' + file.name

            try {
                const state = await GetTransferState({
                    sessionId,
                    localPath,
                    remotePath: remoteFilePath,
                    direction: 'upload',
                } as sftp.GetTransferStateRequest)
                if (state.canResume) {
                    const confirmed = window.confirm(
                        `检测到已存在部分文件，是否断点续传 ${file.name}？`
                    )
                    if (confirmed) {
                        await ResumeUpload({
                            sessionId,
                            localPath,
                            remotePath: remoteFilePath,
                            offset: -1,
                        } as sftp.ResumeUploadRequest)
                        continue
                    }
                }
            } catch (e) {
                console.error('check state error:', e)
            }

            const taskId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            addTransfer({
                id: taskId,
                type: 'upload',
                localPath,
                remotePath: remoteFilePath,
                progress: 0,
                total: file.size,
                written: 0,
                status: 'pending',
            })
            try {
                await UploadFile({
                    sessionId,
                    localPath,
                    remotePath: remoteFilePath,
                } as sftp.UploadRequest)
                updateTransfer(taskId, { status: 'completed', progress: 100 })
            } catch (err: any) {
                console.error('drag upload error:', err)
                updateTransfer(taskId, { status: 'error', error: String(err) })
            }
        }
        loadRemoteFiles()
    }, [getSftpSessionId, remotePath, addTransfer, updateTransfer, loadRemoteFiles])

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

    const hasConnection = !!getSftpSessionId()

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex flex-1 overflow-hidden">
                {/* Local files */}
                <div className="w-1/2 border-r border-border/40 flex flex-col">
                    <div className="px-3 py-2 border-b border-border/40 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <button
                                className="p-1 rounded text-text-dim hover:text-text hover:bg-surface-50/50 transition-all"
                                onClick={goBackLocal}
                                title="上级目录"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                </svg>
                            </button>
                            <span className="text-xs text-text-subtext flex-shrink-0">本地</span>
                            <div className="flex-1 text-xs bg-surface-500 px-2.5 py-1.5 rounded-lg text-text-muted font-mono truncate border border-border/40">
                                {localPath}
                            </div>
                            <button
                                className="p-1 rounded text-text-dim hover:text-accent-blue hover:bg-surface-50/50 transition-all"
                                onClick={() => loadLocalFiles()}
                                title="刷新"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {localLoading ? (
                            <div className="flex items-center justify-center py-8 text-text-dim text-sm">
                                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                                加载中...
                            </div>
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
                    className={`w-1/2 flex flex-col transition-colors ${isDragging ? 'bg-primary-500/5' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="px-3 py-2 border-b border-border/40 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <button
                                className="p-1 rounded text-text-dim hover:text-text hover:bg-surface-50/50 transition-all"
                                onClick={goBackRemote}
                                title="上级目录"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                </svg>
                            </button>
                            <span className="text-xs text-text-subtext flex-shrink-0">远程</span>
                            <div className="flex-1 text-xs bg-surface-500 px-2.5 py-1.5 rounded-lg font-mono truncate border border-border/40">
                                {hasConnection ? (
                                    <span className="text-text-muted">{remotePath}</span>
                                ) : (
                                    <span className="text-text-dim">未连接</span>
                                )}
                            </div>
                            {hasConnection && (
                                <button
                                    className="p-1 rounded text-text-dim hover:text-accent-blue hover:bg-surface-50/50 transition-all"
                                    onClick={() => loadRemoteFiles()}
                                    title="刷新"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto relative">
                        {!hasConnection ? (
                            <div className="flex items-center justify-center h-full text-text-dim animate-fade-in">
                                <div className="text-center">
                                    <svg className="w-12 h-12 mx-auto mb-3 text-text-dim/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                    <div className="text-sm">请先连接服务器</div>
                                </div>
                            </div>
                        ) : isDragging ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-primary-500/10 pointer-events-none z-10 rounded-lg border-2 border-dashed border-primary-400/50 m-1">
                                <div className="text-primary-300 text-sm font-medium flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                    </svg>
                                    释放文件到此处上传
                                </div>
                            </div>
                        ) : remoteLoading ? (
                            <div className="flex items-center justify-center py-8 text-text-dim text-sm">
                                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                                加载中...
                            </div>
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
                <div className="glass-panel border-t border-border/40 px-3 py-2 max-h-24 overflow-y-auto">
                    <div className="text-xs text-text-dim mb-1.5 flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        传输进度
                    </div>
                    <div className="space-y-1">
                        {transfers.filter(t => t.status !== 'error').slice(-5).map((task) => {
                            const fileName = task.localPath.split(/[/\\]/).pop()
                            return (
                                <div key={task.id} className="flex items-center gap-2 text-xs">
                                    {task.type === 'upload' ? (
                                        <svg className="w-3 h-3 text-accent-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3 h-3 text-accent-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                        </svg>
                                    )}
                                    <span className="truncate flex-1 text-text-muted">{fileName}</span>
                                    {task.status === 'completed' ? (
                                        <span className="text-accent-green flex-shrink-0">完成</span>
                                    ) : (
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <div className="w-16 progress-bar">
                                                <div className="progress-bar-fill" style={{ width: `${task.progress}%` }} />
                                            </div>
                                            <span className="text-text-dim w-8 text-right">{task.progress.toFixed(0)}%</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="h-9 glass-panel border-t border-border/40 flex items-center px-3 gap-1.5 flex-shrink-0">
                <span className="text-[10px] text-text-dim font-medium mr-1">本地</span>
                <button className="btn-ghost text-xs px-2 py-0.5" onClick={handleMkdirLocal}>
                    <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        新建
                    </span>
                </button>
                <button className="btn-ghost text-xs px-2 py-0.5" onClick={handleRenameLocal} disabled={!selectedLocal}>
                    <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        重命名
                    </span>
                </button>
                <button className="btn-danger text-xs px-2 py-0.5" onClick={handleDeleteLocal} disabled={!selectedLocal}>
                    <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        删除
                    </span>
                </button>

                <div className="w-px h-4 bg-border/40 mx-2" />

                <span className="text-[10px] text-text-dim font-medium mr-1">远程</span>
                {hasConnection ? (
                    <>
                        <button className="btn-primary text-xs px-2 py-0.5" onClick={handleUpload} disabled={!selectedLocal}>
                            <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                </svg>
                                上传
                            </span>
                        </button>
                        <button className="btn-primary text-xs px-2 py-0.5" onClick={handleDownload} disabled={!selectedRemote}>
                            <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                </svg>
                                下载
                            </span>
                        </button>
                        <button className="btn-ghost text-xs px-2 py-0.5" onClick={handleMkdirRemote}>
                            <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                </svg>
                                新建
                            </span>
                        </button>
                        <button className="btn-ghost text-xs px-2 py-0.5" onClick={handleRenameRemote} disabled={!selectedRemote}>
                            <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                重命名
                            </span>
                        </button>
                        <button className="btn-danger text-xs px-2 py-0.5" onClick={handleDeleteRemote} disabled={!selectedRemote}>
                            <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                删除
                            </span>
                        </button>
                    </>
                ) : (
                    <span className="text-xs text-text-dim">请先连接服务器</span>
                )}
            </div>
        </div>
    )
}

export default FileManager
