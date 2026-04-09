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
import { useContextMenu, ContextMenuItem } from './ContextMenu'
import { useDialog } from './Dialog'

const formatSize = (bytes: number): string => {
    if (bytes === 0) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const FolderIcon = () => (
    <svg className="w-3.5 h-3.5 text-accent-yellow flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
)

const FileIcon = () => (
    <svg className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
)

interface FileItemProps {
    file: FileEntry
    isSelected: boolean
    onSelect: (path: string) => void
    onNavigate: (path: string) => void
    onContextMenu: (e: React.MouseEvent, file: FileEntry) => void
}

const FileItem: React.FC<FileItemProps> = ({ file, isSelected, onSelect, onNavigate, onContextMenu }) => (
    <div
        className={`flex justify-between items-center px-2 py-1 cursor-pointer transition-colors rounded text-xs ${
            isSelected ? 'bg-primary-500/15 text-primary-300' : 'hover:bg-surface-50/40 text-text-muted'
        }`}
        onClick={() => onSelect(file.path)}
        onDoubleClick={() => file.type === 'directory' ? onNavigate(file.path) : undefined}
        onContextMenu={(e) => onContextMenu(e, file)}
    >
        <div className="flex items-center gap-2 min-w-0">
            {file.type === 'directory' ? <FolderIcon /> : <FileIcon />}
            <span className="truncate">{file.name}</span>
        </div>
        <span className="text-text-dim flex-shrink-0 ml-2 font-mono text-[10px]">
            {file.type === 'file' ? formatSize(file.size) : ''}
        </span>
    </div>
)

interface BreadcrumbProps {
    path: string
    onNavigate: (path: string) => void
    sep: string
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ path, onNavigate, sep }) => {
    const parts = path.split(sep).filter(Boolean)
    if (parts.length === 0) {
        return <span className="text-text-muted cursor-pointer hover:text-text transition-colors" onClick={() => onNavigate(sep)}>{sep}</span>
    }

    const isWindows = sep === '\\'
    const rootLabel = isWindows ? parts[0] : ''
    const startIndex = isWindows ? 1 : 0

    return (
        <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
            {isWindows ? (
                <span
                    className="text-text-muted hover:text-text transition-colors cursor-pointer flex-shrink-0"
                    onClick={() => onNavigate(rootLabel + sep)}
                >
                    {rootLabel}
                </span>
            ) : (
                <span
                    className="text-text-muted hover:text-text transition-colors cursor-pointer flex-shrink-0"
                    onClick={() => onNavigate('/')}
                >
                    /
                </span>
            )}
            {parts.slice(startIndex).map((part, i) => {
                const clickedParts = isWindows
                    ? [rootLabel, ...parts.slice(startIndex, startIndex + i + 1)]
                    : parts.slice(0, startIndex + i + 1)
                const targetPath = isWindows
                    ? clickedParts.join(sep) + sep
                    : '/' + clickedParts.join('/')
                return (
                    <React.Fragment key={i}>
                        <svg className="w-2.5 h-2.5 text-text-dim/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span
                            className={`text-[10px] truncate transition-colors cursor-pointer ${
                                i === parts.slice(startIndex).length - 1
                                    ? 'text-text font-medium'
                                    : 'text-text-muted hover:text-text'
                            }`}
                            onClick={() => onNavigate(targetPath)}
                        >
                            {part}
                        </span>
                    </React.Fragment>
                )
            })}
        </div>
    )
}

const FileManager: React.FC = () => {
    const { sftpSessions } = useConnectionStore()
    const activeServerId = useUIStore((s) => s.activeServerId)
    const { transfers, addTransfer, updateTransfer } = useTransferStore()
    const { confirm, prompt: dialogPrompt } = useDialog()
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
    const { show: showLocalCtx, ContextMenuOverlay: LocalCtxOverlay } = useContextMenu()
    const { show: showRemoteCtx, ContextMenuOverlay: RemoteCtxOverlay } = useContextMenu()

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
                const confirmed = await confirm({
                    title: '续传确认',
                    message: `检测到部分文件 (${formatSize(state.remoteSize || 0)} / ${formatSize(state.localSize || 0)})，是否续传？`,
                    confirmText: '续传',
                })
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
                const confirmed = await confirm({
                    title: '续传确认',
                    message: `检测到部分文件 (${formatSize(state.localSize || 0)} / ${formatSize(state.remoteSize || 0)})，是否续传？`,
                    confirmText: '续传',
                })
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

    const handleDeleteRemote = async (filePath?: string) => {
        const target = filePath || selectedRemote
        if (!target || !getSftpSessionId()) return
        const file = remoteFiles.find(f => f.path === target)
        const ok = await confirm({
            title: '删除确认',
            message: `确定删除 "${file?.name || target}" 吗？`,
            confirmText: '删除',
            danger: true,
        })
        if (!ok) return
        try {
            await DeleteFile({ sessionId: getSftpSessionId()!, path: target })
            loadRemoteFiles()
            setSelectedRemote(null)
        } catch (e) { console.error(e) }
    }

    const handleRenameRemote = async (filePath?: string) => {
        const target = filePath || selectedRemote
        if (!target || !getSftpSessionId()) return
        const file = remoteFiles.find(f => f.path === target)
        if (!file) return
        const newName = await dialogPrompt({
            title: '重命名',
            message: `输入新名称：`,
            defaultValue: file.name,
            placeholder: '新名称',
            confirmText: '重命名',
        })
        if (!newName || newName === file.name) return
        const parentPath = target.substring(0, target.lastIndexOf('/'))
        try {
            await Rename({ sessionId: getSftpSessionId()!, oldPath: target, newPath: parentPath + '/' + newName } as sftp.RenameRequest)
            loadRemoteFiles()
            setSelectedRemote(null)
        } catch (e) { console.error(e) }
    }

    const handleDeleteLocal = async (filePath?: string) => {
        const target = filePath || selectedLocal
        if (!target) return
        const file = localFiles.find(f => f.path === target)
        const ok = await confirm({
            title: '删除确认',
            message: `确定删除 "${file?.name || target}" 吗？`,
            confirmText: '删除',
            danger: true,
        })
        if (!ok) return
        try {
            await LocalDelete({ path: target })
            loadLocalFiles()
            setSelectedLocal(null)
        } catch (e) { console.error(e) }
    }

    const handleMkdirLocal = async () => {
        const name = await dialogPrompt({
            title: '新建目录',
            placeholder: '目录名称',
            confirmText: '创建',
        })
        if (!name) return
        const sep = localPath.includes('\\') ? '\\' : '/'
        try {
            await LocalMkdir({ path: localPath + sep + name })
            loadLocalFiles()
        } catch (e) { console.error(e) }
    }

    const handleRenameLocal = async (filePath?: string) => {
        const target = filePath || selectedLocal
        if (!target) return
        const file = localFiles.find(f => f.path === target)
        if (!file) return
        const newName = await dialogPrompt({
            title: '重命名',
            message: '输入新名称：',
            defaultValue: file.name,
            placeholder: '新名称',
            confirmText: '重命名',
        })
        if (!newName || newName === file.name) return
        const sep = target.includes('\\') ? '\\' : '/'
        const parts = target.split(sep)
        parts[parts.length - 1] = newName
        try {
            await LocalRename({ oldPath: target, newPath: parts.join(sep) })
            loadLocalFiles()
            setSelectedLocal(null)
        } catch (e) { console.error(e) }
    }

    const handleMkdirRemote = async () => {
        const name = await dialogPrompt({
            title: '新建目录',
            placeholder: '目录名称',
            confirmText: '创建',
        })
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
                    const confirmed = await confirm({
                        title: '续传确认',
                        message: `检测到部分文件，是否续传 ${file.name}？`,
                        confirmText: '续传',
                    })
                    if (confirmed) {
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

    const getLocalContextMenu = useCallback((e: React.MouseEvent, file: FileEntry) => {
        const items: ContextMenuItem[] = [
            ...(file.type === 'directory' ? [{
                label: '进入目录',
                icon: <FolderIcon />,
                onClick: () => navigateLocal(file.path),
            }] : [{
                label: '上传到远程',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                ),
                onClick: () => { setSelectedLocal(file.path); setTimeout(() => handleUpload(), 0) },
                disabled: !getSftpSessionId(),
            }]),
            { separator: true },
            {
                label: '重命名',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                ),
                onClick: () => handleRenameLocal(file.path),
            },
            {
                label: '删除',
                danger: true,
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                ),
                onClick: () => handleDeleteLocal(file.path),
            },
        ]
        setSelectedLocal(file.path)
        showLocalCtx(e, items)
    }, [getSftpSessionId])

    const getRemoteContextMenu = useCallback((e: React.MouseEvent, file: FileEntry) => {
        const items: ContextMenuItem[] = [
            ...(file.type === 'directory' ? [{
                label: '进入目录',
                icon: <FolderIcon />,
                onClick: () => navigateRemote(file.path),
            }] : [{
                label: '下载到本地',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                    </svg>
                ),
                onClick: () => { setSelectedRemote(file.path); setTimeout(() => handleDownload(), 0) },
            }]),
            { separator: true },
            {
                label: '重命名',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                ),
                onClick: () => handleRenameRemote(file.path),
            },
            {
                label: '删除',
                danger: true,
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                ),
                onClick: () => handleDeleteRemote(file.path),
            },
        ]
        setSelectedRemote(file.path)
        showRemoteCtx(e, items)
    }, [getSftpSessionId])

    const hasConnection = !!getSftpSessionId()
    const localSep = localPath.includes('\\') ? '\\' : '/'

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/2 border-r border-border/40 flex flex-col">
                    <div className="px-2 py-1.5 border-b border-border/30 flex-shrink-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                            <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={goBackLocal} title="上级目录">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                </svg>
                            </button>
                            <span className="text-[10px] text-text-dim flex-shrink-0 font-medium">本地</span>
                            <div className="flex-1 min-w-0">
                                <Breadcrumb path={localPath} onNavigate={navigateLocal} sep={localSep} />
                            </div>
                            <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={() => loadLocalFiles()} title="刷新">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
                                </svg>
                            </button>
                        </div>
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
                        ) : localFiles.length === 0 ? (
                            <div className="flex items-center justify-center py-6 text-text-dim text-xs">
                                空目录
                            </div>
                        ) : localFiles.map((file, i) => (
                            <FileItem key={i} file={file} isSelected={selectedLocal === file.path} onSelect={setSelectedLocal} onNavigate={navigateLocal} onContextMenu={getLocalContextMenu} />
                        ))}
                    </div>
                    <LocalCtxOverlay />
                </div>

                <div
                    ref={dropZoneRef}
                    className={`w-1/2 flex flex-col transition-colors ${isDragging ? 'bg-primary-500/5' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="px-2 py-1.5 border-b border-border/30 flex-shrink-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                            <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={goBackRemote} title="上级目录">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                </svg>
                            </button>
                            <span className="text-[10px] text-text-dim flex-shrink-0 font-medium">远程</span>
                            <div className="flex-1 min-w-0">
                                {hasConnection ? (
                                    <Breadcrumb path={remotePath} onNavigate={navigateRemote} sep="/" />
                                ) : (
                                    <span className="text-text-dim text-[10px]">未连接</span>
                                )}
                            </div>
                            {hasConnection && (
                                <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={() => loadRemoteFiles()} title="刷新">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto relative">
                        {!hasConnection ? (
                            <div className="flex flex-col items-center justify-center h-full text-text-dim text-xs gap-2">
                                <svg className="w-6 h-6 text-text-dim/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                </svg>
                                <span>请先连接服务器</span>
                            </div>
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
                        ) : remoteFiles.length === 0 ? (
                            <div className="flex items-center justify-center py-6 text-text-dim text-xs">
                                空目录
                            </div>
                        ) : remoteFiles.map((file, i) => (
                            <FileItem key={i} file={file} isSelected={selectedRemote === file.path} onSelect={setSelectedRemote} onNavigate={navigateRemote} onContextMenu={getRemoteContextMenu} />
                        ))}
                    </div>
                    <RemoteCtxOverlay />
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

            <div className="h-9 border-t border-border/30 flex items-center px-2 gap-0.5 flex-shrink-0">
                <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-dim hover:text-text hover:bg-surface-50/40 transition-colors" onClick={handleMkdirLocal} title="本地新建目录">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    <span>新建</span>
                </button>
                <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-dim hover:text-text hover:bg-surface-50/40 transition-colors disabled:opacity-30" onClick={() => handleRenameLocal()} disabled={!selectedLocal} title="本地重命名">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>重命名</span>
                </button>
                <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-dim hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-30" onClick={() => handleDeleteLocal()} disabled={!selectedLocal} title="本地删除">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>删除</span>
                </button>

                <div className="w-px h-3.5 bg-border/40 mx-1" />

                {hasConnection ? (
                    <>
                        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-accent-green hover:bg-accent-green/10 transition-colors disabled:opacity-30" onClick={handleUpload} disabled={!selectedLocal} title="上传选中文件">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                            </svg>
                            <span>上传</span>
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-accent-blue hover:bg-accent-blue/10 transition-colors disabled:opacity-30" onClick={handleDownload} disabled={!selectedRemote} title="下载选中文件">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                            </svg>
                            <span>下载</span>
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-dim hover:text-text hover:bg-surface-50/40 transition-colors" onClick={handleMkdirRemote} title="远程新建目录">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            <span>新建</span>
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-dim hover:text-text hover:bg-surface-50/40 transition-colors disabled:opacity-30" onClick={() => handleRenameRemote()} disabled={!selectedRemote} title="远程重命名">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>重命名</span>
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-dim hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-30" onClick={() => handleDeleteRemote()} disabled={!selectedRemote} title="远程删除">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>删除</span>
                        </button>
                    </>
                ) : (
                    <span className="text-[10px] text-text-dim ml-2">请先连接服务器以使用传输功能</span>
                )}
            </div>
        </div>
    )
}

export default FileManager
