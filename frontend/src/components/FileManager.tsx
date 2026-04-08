import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    ListFiles, ListLocalFiles, UploadFile, DownloadFile,
    DeleteFile, Mkdir, Rename, GetTransferState,
    ResumeUpload, ResumeDownload, LocalDelete, LocalMkdir, LocalRename,
} from '../../wailsjs/go/sftp/SFTPManager'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import { sftp } from '../../wailsjs/go/models'
import { FileEntry } from '../types'
import { useConnectionStore, useUIStore, useTransferStore } from '../stores/ui'

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

const FileItem: React.FC<FileItemProps> = ({ file, isSelected, onSelect, onNavigate }) => (
    <div
        className={`flex justify-between items-center px-2 py-1 cursor-pointer transition-colors rounded text-xs ${
            isSelected ? 'bg-primary-500/15 text-primary-300' : 'hover:bg-surface-50/40 text-text-muted'
        }`}
        onClick={() => onSelect(file.path)}
        onDoubleClick={() => file.type === 'directory' ? onNavigate(file.path) : undefined}
    >
        <div className="flex items-center gap-2 min-w-0">
            {file.type === 'directory' ? (
                <svg className="w-3.5 h-3.5 text-accent-yellow flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                </svg>
            ) : (
                <svg className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            )}
            <span className="truncate">{file.name}</span>
        </div>
        <span className="text-text-dim flex-shrink-0 ml-2 font-mono text-[10px]">
            {file.type === 'file' ? formatSize(file.size) : ''}
        </span>
    </div>
)

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
        return sftpSessions[activeServerId] || null
    }, [activeServerId, sftpSessions])

    const loadLocalFiles = useCallback(async (path?: string) => {
        setLocalLoading(true)
        try {
            const resp = await ListLocalFiles({ path: path || localPath })
            if (resp.success) {
                setLocalFiles(resp.files || [])
                setLocalPath(resp.path || '')
            }
        } catch (e) { console.error(e) }
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
        } catch (e) { console.error(e) }
        setRemoteLoading(false)
    }, [getSftpSessionId, remotePath])

    useEffect(() => { loadLocalFiles('') }, [])

    useEffect(() => {
        const sessionId = getSftpSessionId()
        if (sessionId) loadRemoteFiles('/')
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
        return () => { EventsOff('sftp:upload:progress') }
    }, [transfers, updateTransfer])

    const handleUpload = async () => {
        if (!selectedLocal || !getSftpSessionId()) return
        const file = localFiles.find((f) => f.path === selectedLocal)
        if (!file || file.type === 'directory') return
        const sessionId = getSftpSessionId()!
        const remoteFilePath = remotePath + '/' + file.name

        try {
            const state = await GetTransferState({
                sessionId, localPath: file.path, remotePath: remoteFilePath, direction: 'upload',
            } as sftp.GetTransferStateRequest)
            if (state.canResume) {
                const confirmed = window.confirm(`检测到部分文件 (${formatSize(state.remoteSize || 0)} / ${formatSize(state.localSize || 0)})，是否续传？`)
                if (confirmed) {
                    await ResumeUpload({ sessionId, localPath: file.path, remotePath: remoteFilePath, offset: -1 } as sftp.ResumeUploadRequest)
                    loadRemoteFiles()
                    return
                }
            }
        } catch (e) { console.error(e) }

        const taskId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        addTransfer({ id: taskId, type: 'upload', localPath: file.path, remotePath: remoteFilePath, progress: 0, total: file.size, written: 0, status: 'pending' })
        try {
            await UploadFile({ sessionId, localPath: file.path, remotePath: remoteFilePath } as sftp.UploadRequest)
            updateTransfer(taskId, { status: 'completed', progress: 100 })
            loadRemoteFiles()
        } catch (e) {
            updateTransfer(taskId, { status: 'error', error: String(e) })
        }
    }

    const handleDownload = async () => {
        if (!selectedRemote || !getSftpSessionId()) return
        const file = remoteFiles.find((f) => f.path === selectedRemote)
        if (!file || file.type === 'directory') return
        const sessionId = getSftpSessionId()!
        const localFilePath = localPath + '/' + file.name

        try {
            const state = await GetTransferState({
                sessionId, remotePath: file.path, localPath: localFilePath, direction: 'download',
            } as sftp.GetTransferStateRequest)
            if (state.canResume) {
                const confirmed = window.confirm(`检测到部分文件 (${formatSize(state.localSize || 0)} / ${formatSize(state.remoteSize || 0)})，是否续传？`)
                if (confirmed) {
                    await ResumeDownload({ sessionId, remotePath: file.path, localPath: localFilePath, offset: -1 } as sftp.ResumeDownloadRequest)
                    loadLocalFiles()
                    return
                }
            }
        } catch (e) { console.error(e) }

        const taskId = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        addTransfer({ id: taskId, type: 'download', localPath: localFilePath, remotePath: file.path, progress: 0, total: file.size, written: 0, status: 'pending' })
        try {
            await DownloadFile({ sessionId, remotePath: file.path, localPath: localFilePath } as sftp.DownloadRequest)
            updateTransfer(taskId, { status: 'completed', progress: 100 })
            loadLocalFiles()
        } catch (e) {
            updateTransfer(taskId, { status: 'error', error: String(e) })
        }
    }

    const handleDeleteRemote = async () => {
        if (!selectedRemote || !getSftpSessionId()) return
        try {
            await DeleteFile({ sessionId: getSftpSessionId()!, path: selectedRemote })
            loadRemoteFiles()
            setSelectedRemote(null)
        } catch (e) { console.error(e) }
    }

    const handleRenameRemote = async () => {
        if (!selectedRemote || !getSftpSessionId()) return
        const file = remoteFiles.find(f => f.path === selectedRemote)
        if (!file) return
        const newName = prompt('新名称:', file.name)
        if (!newName || newName === file.name) return
        const parentPath = selectedRemote.substring(0, selectedRemote.lastIndexOf('/'))
        try {
            await Rename({ sessionId: getSftpSessionId()!, oldPath: selectedRemote, newPath: parentPath + '/' + newName } as sftp.RenameRequest)
            loadRemoteFiles()
            setSelectedRemote(null)
        } catch (e) { console.error(e) }
    }

    const handleDeleteLocal = async () => {
        if (!selectedLocal || !confirm('确定删除？')) return
        try {
            await LocalDelete({ path: selectedLocal })
            loadLocalFiles()
            setSelectedLocal(null)
        } catch (e) { console.error(e) }
    }

    const handleMkdirLocal = async () => {
        const name = prompt('目录名称:')
        if (!name) return
        const sep = localPath.includes('\\') ? '\\' : '/'
        try {
            await LocalMkdir({ path: localPath + sep + name })
            loadLocalFiles()
        } catch (e) { console.error(e) }
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
        try {
            await LocalRename({ oldPath: selectedLocal, newPath: parts.join(sep) })
            loadLocalFiles()
            setSelectedLocal(null)
        } catch (e) { console.error(e) }
    }

    const handleMkdirRemote = async () => {
        const name = prompt('目录名称:')
        if (!name || !getSftpSessionId()) return
        try {
            await Mkdir({ sessionId: getSftpSessionId()!, path: remotePath === '/' ? '/' + name : remotePath + '/' + name } as sftp.MkdirRequest)
            loadRemoteFiles()
        } catch (e) { console.error(e) }
    }

    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }, [])
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }, [])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false)
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
                const state = await GetTransferState({ sessionId, localPath, remotePath: remoteFilePath, direction: 'upload' } as sftp.GetTransferStateRequest)
                if (state.canResume) {
                    if (window.confirm(`检测到部分文件，是否续传 ${file.name}？`)) {
                        await ResumeUpload({ sessionId, localPath, remotePath: remoteFilePath, offset: -1 } as sftp.ResumeUploadRequest)
                        continue
                    }
                }
            } catch (e) { console.error(e) }
            const taskId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            addTransfer({ id: taskId, type: 'upload', localPath, remotePath: remoteFilePath, progress: 0, total: file.size, written: 0, status: 'pending' })
            try {
                await UploadFile({ sessionId, localPath, remotePath: remoteFilePath } as sftp.UploadRequest)
                updateTransfer(taskId, { status: 'completed', progress: 100 })
            } catch (err: any) {
                updateTransfer(taskId, { status: 'error', error: String(err) })
            }
        }
        loadRemoteFiles()
    }, [getSftpSessionId, remotePath, addTransfer, updateTransfer, loadRemoteFiles])

    const navigateLocal = (path: string) => { setLocalHistory((prev) => [...prev, localPath]); loadLocalFiles(path) }
    const navigateRemote = (path: string) => { setRemoteHistory((prev) => [...prev, remotePath]); loadRemoteFiles(path) }

    const goBackLocal = () => {
        if (localHistory.length > 0) {
            const prev = localHistory[localHistory.length - 1]
            setLocalHistory((h) => h.slice(0, -1))
            loadLocalFiles(prev)
        } else if (localPath.includes('/') || localPath.includes('\\')) {
            loadLocalFiles(localPath.split(/[/\\]/).slice(0, -1).join('/') || '/')
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
            loadRemoteFiles('/' + parts.join('/') || '/')
        }
    }

    const hasConnection = !!getSftpSessionId()

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/2 border-r border-border/40 flex flex-col">
                    <div className="px-2 py-1.5 border-b border-border/30 flex-shrink-0 flex items-center gap-1.5">
                        <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={goBackLocal} title="上级目录">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                            </svg>
                        </button>
                        <span className="text-[10px] text-text-dim flex-shrink-0">本地</span>
                        <div className="flex-1 text-[10px] bg-surface-500 px-2 py-1 rounded text-text-muted font-mono truncate border border-border/30">
                            {localPath}
                        </div>
                        <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={() => loadLocalFiles()} title="刷新">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {localLoading ? (
                            <div className="flex items-center justify-center py-6 text-text-dim text-xs">
                                <svg className="w-3.5 h-3.5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                                加载中...
                            </div>
                        ) : localFiles.map((file, i) => (
                            <FileItem key={i} file={file} isSelected={selectedLocal === file.path} onSelect={setSelectedLocal} onNavigate={navigateLocal} />
                        ))}
                    </div>
                </div>

                <div
                    ref={dropZoneRef}
                    className={`w-1/2 flex flex-col transition-colors ${isDragging ? 'bg-primary-500/5' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="px-2 py-1.5 border-b border-border/30 flex-shrink-0 flex items-center gap-1.5">
                        <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={goBackRemote} title="上级目录">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                            </svg>
                        </button>
                        <span className="text-[10px] text-text-dim flex-shrink-0">远程</span>
                        <div className="flex-1 text-[10px] bg-surface-500 px-2 py-1 rounded font-mono truncate border border-border/30">
                            {hasConnection ? <span className="text-text-muted">{remotePath}</span> : <span className="text-text-dim">未连接</span>}
                        </div>
                        {hasConnection && (
                            <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={() => loadRemoteFiles()} title="刷新">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto relative">
                        {!hasConnection ? (
                            <div className="flex items-center justify-center h-full text-text-dim text-xs">请先连接服务器</div>
                        ) : isDragging ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-primary-500/10 pointer-events-none z-10 rounded border-2 border-dashed border-primary-400/50 m-1">
                                <span className="text-primary-300 text-xs">释放文件到此处上传</span>
                            </div>
                        ) : remoteLoading ? (
                            <div className="flex items-center justify-center py-6 text-text-dim text-xs">
                                <svg className="w-3.5 h-3.5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                                加载中...
                            </div>
                        ) : remoteFiles.map((file, i) => (
                            <FileItem key={i} file={file} isSelected={selectedRemote === file.path} onSelect={setSelectedRemote} onNavigate={navigateRemote} />
                        ))}
                    </div>
                </div>
            </div>

            {transfers.filter(t => t.status === 'pending' || t.status === 'completed').length > 0 && (
                <div className="border-t border-border/30 px-3 py-1.5 max-h-20 overflow-y-auto bg-surface-300/50">
                    <div className="space-y-0.5">
                        {transfers.filter(t => t.status !== 'error').slice(-3).map((task) => {
                            const fileName = task.localPath.split(/[/\\]/).pop()
                            return (
                                <div key={task.id} className="flex items-center gap-2 text-[10px]">
                                    <span className={task.type === 'upload' ? 'text-accent-green' : 'text-accent-blue'}>
                                        {task.type === 'upload' ? '↑' : '↓'}
                                    </span>
                                    <span className="truncate flex-1 text-text-muted">{fileName}</span>
                                    {task.status === 'completed' ? (
                                        <span className="text-accent-green">完成</span>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <div className="w-12 h-0.5 bg-surface-50 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary-400 rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                                            </div>
                                            <span className="text-text-dim w-7 text-right">{task.progress.toFixed(0)}%</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="h-8 border-t border-border/30 flex items-center px-2 gap-1 flex-shrink-0">
                <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={handleMkdirLocal} title="本地新建目录">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                </button>
                <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={handleRenameLocal} disabled={!selectedLocal} title="本地重命名">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button className="p-1 rounded text-text-dim hover:text-danger transition-colors" onClick={handleDeleteLocal} disabled={!selectedLocal} title="本地删除">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>

                <div className="w-px h-3.5 bg-border/40 mx-1" />

                {hasConnection ? (
                    <>
                        <button className="p-1 rounded text-accent-green hover:bg-accent-green/10 transition-colors" onClick={handleUpload} disabled={!selectedLocal} title="上传选中文件">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                            </svg>
                        </button>
                        <button className="p-1 rounded text-accent-blue hover:bg-accent-blue/10 transition-colors" onClick={handleDownload} disabled={!selectedRemote} title="下载选中文件">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                            </svg>
                        </button>
                        <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={handleMkdirRemote} title="远程新建目录">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                        </button>
                        <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={handleRenameRemote} disabled={!selectedRemote} title="远程重命名">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button className="p-1 rounded text-text-dim hover:text-danger transition-colors" onClick={handleDeleteRemote} disabled={!selectedRemote} title="远程删除">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </>
                ) : (
                    <span className="text-[10px] text-text-dim">请先连接服务器</span>
                )}
            </div>
        </div>
    )
}

export default FileManager
