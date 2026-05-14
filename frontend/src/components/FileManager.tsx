import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    ListFiles, UploadFile, DownloadFile,
    DeleteFile, Mkdir, Rename, GetTransferState,
    ResumeUpload, ResumeDownload, PickFiles,
} from '../../wailsjs/go/sftp/SFTPManager'
import { EventsOn, EventsOff, OnFileDrop, OnFileDropOff } from '../../wailsjs/runtime/runtime'
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
        className={`flex justify-between items-center px-3 py-2 cursor-pointer transition-colors text-xs ${
            isSelected ? 'bg-primary-500/10 text-primary-500' : 'hover:bg-surface-50/50 text-text-muted'
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
        return <span className="text-text-muted/50 cursor-pointer hover:text-text-muted transition-colors" onClick={() => onNavigate(sep)}>{sep}</span>
    }

    const isWindows = sep === '\\'
    const rootLabel = isWindows ? parts[0] : ''
    const startIndex = isWindows ? 1 : 0

    return (
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
            {isWindows ? (
                <span
                    className="text-text-muted/50 hover:text-text-muted transition-colors cursor-pointer flex-shrink-0"
                    onClick={() => onNavigate(rootLabel + sep)}
                >
                    {rootLabel}
                </span>
            ) : (
                <span
                    className="text-text-muted/50 hover:text-text-muted transition-colors cursor-pointer flex-shrink-0"
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
                        <svg className="w-2 h-2 text-text-dim/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span
                            className={`text-[10px] truncate transition-colors cursor-pointer ${
                                i === parts.slice(startIndex).length - 1
                                    ? 'text-text/80 font-medium'
                                    : 'text-text-muted/60 hover:text-text-muted'
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
    const { transfers, addTransfer, updateTransfer, removeTransfer } = useTransferStore()
    const { confirm, prompt: dialogPrompt } = useDialog()
    const [remoteFiles, setRemoteFiles] = useState<FileEntry[]>([])
    const [remotePath, setRemotePath] = useState('/')
    const [remoteLoading, setRemoteLoading] = useState(false)
    const [selectedRemote, setSelectedRemote] = useState<string | null>(null)
    const [remoteHistory, setRemoteHistory] = useState<string[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)
    const [pathInput, setPathInput] = useState('')
    const [showPathInput, setShowPathInput] = useState(false)
    const dropZoneRef = useRef<HTMLDivElement>(null)
    const remotePathRef = useRef('/')
    const searchInputRef = useRef<HTMLInputElement>(null)
    const pathInputRef = useRef<HTMLInputElement>(null)
    const { show: showRemoteCtx, ContextMenuOverlay: RemoteCtxOverlay } = useContextMenu()

    const getSftpSessionId = useCallback(() => {
        if (!activeServerId) return null
        return sftpSessions[activeServerId] || null
    }, [activeServerId, sftpSessions])

    const loadRemoteFiles = useCallback(async (path?: string) => {
        const sessionId = getSftpSessionId()
        if (!sessionId) return
        const targetPath = path || remotePathRef.current
        setRemoteLoading(true)
        try {
            const resp = await ListFiles({ sessionId, path: targetPath })
            if (resp.success) {
                setRemoteFiles((resp.files || []) as FileEntry[])
                setRemotePath(resp.path || '/')
                remotePathRef.current = resp.path || '/'
                setPathInput(resp.path || '/')
            }
        } catch (e) { console.error(e) }
        setRemoteLoading(false)
    }, [getSftpSessionId])

    useEffect(() => {
        const sessionId = getSftpSessionId()
        if (sessionId) loadRemoteFiles('/')
    }, [activeServerId, sftpSessions])

    useEffect(() => {
        const handleUploadProgress = (data: any) => {
            const taskId = `upload-${data.localPath}-${data.remotePath}`
            const updates: Record<string, any> = {
                progress: data.progress,
                written: data.written,
                total: data.total,
            }
            if (data.progress >= 100) {
                updates.status = 'completed'
            }
            useTransferStore.getState().updateTransfer(taskId, updates)
        }
        EventsOn('sftp:upload:progress', handleUploadProgress)
        return () => { EventsOff('sftp:upload:progress') }
    }, [])

    // Auto-remove completed transfers after 3 seconds
    useEffect(() => {
        const completed = transfers.filter(t => t.status === 'completed')
        if (completed.length === 0) return
        const timers = completed.map(t =>
            setTimeout(() => removeTransfer(t.id), 3000)
        )
        return () => { timers.forEach(clearTimeout) }
    }, [transfers.filter(t => t.status === 'completed').length, removeTransfer])

    const handleDownload = async () => {
        if (!selectedRemote || !getSftpSessionId()) return
        const file = remoteFiles.find((f) => f.path === selectedRemote)
        if (!file || file.type === 'directory') return
        const sessionId = getSftpSessionId()!
        const localFilePath = './downloads/' + file.name

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
                    loadRemoteFiles()
                    return
                }
            }
        } catch (e) { console.error(e) }

        const taskId = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        addTransfer({ id: taskId, type: 'download', localPath: localFilePath, remotePath: file.path, progress: 0, total: file.size, written: 0, status: 'pending' })
        try {
            await DownloadFile({ sessionId, remotePath: file.path, localPath: localFilePath } as sftp.DownloadRequest)
            updateTransfer(taskId, { status: 'completed', progress: 100 })
            loadRemoteFiles()
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

    const uploadLocalFiles = useCallback(async (localPaths: string[]) => {
        const sessionId = getSftpSessionId()
        if (!sessionId || localPaths.length === 0) return

        for (const localPath of localPaths) {
            const fileName = localPath.split(/[/\\]/).pop() || 'unknown'
            const currentRemotePath = remotePathRef.current
            const remoteFilePath = currentRemotePath === '/' ? '/' + fileName : currentRemotePath + '/' + fileName

            try {
                const state = await GetTransferState({ sessionId, localPath, remotePath: remoteFilePath, direction: 'upload' } as sftp.GetTransferStateRequest)
                if (state.canResume) {
                    const confirmed = await confirm({
                        title: '续传确认',
                        message: `检测到部分文件，是否续传 ${fileName}？`,
                        confirmText: '续传',
                    })
                    if (confirmed) {
                        await ResumeUpload({ sessionId, localPath, remotePath: remoteFilePath, offset: -1 } as sftp.ResumeUploadRequest)
                        continue
                    }
                }
            } catch (e) { console.error(e) }
            const taskId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            addTransfer({ id: taskId, type: 'upload', localPath, remotePath: remoteFilePath, progress: 0, total: 0, written: 0, status: 'pending' })
            try {
                await UploadFile({ sessionId, localPath, remotePath: remoteFilePath } as sftp.UploadRequest)
                updateTransfer(taskId, { status: 'completed', progress: 100 })
            } catch (err: any) {
                updateTransfer(taskId, { status: 'error', error: String(err) })
            }
        }
        loadRemoteFiles()
    }, [getSftpSessionId, addTransfer, updateTransfer, loadRemoteFiles])

    useEffect(() => {
        OnFileDrop((_x: number, _y: number, paths: string[]) => {
            setIsDragging(false)
            if (!paths || paths.length === 0) return
            uploadLocalFiles(paths)
        }, true)
        return () => { OnFileDropOff() }
    }, [uploadLocalFiles])

    const handleUploadClick = useCallback(async () => {
        try {
            const resp = await PickFiles()
            if (resp.error) { console.error(resp.error); return }
            if (resp.paths && resp.paths.length > 0) {
                await uploadLocalFiles(resp.paths)
            }
        } catch (e) { console.error(e) }
    }, [uploadLocalFiles])

    const navigateRemote = (path: string) => { setRemoteHistory((prev) => [...prev, remotePath]); loadRemoteFiles(path) }

    const handlePathSubmit = () => {
        const p = pathInput.trim()
        if (p) {
            loadRemoteFiles(p)
            setShowPathInput(false)
        }
    }

    const hasConnection = !!getSftpSessionId()

    const directories = remoteFiles.filter(f => f.type === 'directory')
    const filesOnly = remoteFiles.filter(f => f.type === 'file')

    const filteredFiles = React.useMemo(() => {
        if (!searchQuery.trim()) return { directories, filesOnly }
        const q = searchQuery.toLowerCase().trim()
        return {
            directories: directories.filter(f => f.name.toLowerCase().includes(q)),
            filesOnly: filesOnly.filter(f => f.name.toLowerCase().includes(q)),
        }
    }, [directories, filesOnly, searchQuery])

    useEffect(() => {
        if (showSearch && searchInputRef.current) searchInputRef.current.focus()
    }, [showSearch])

    useEffect(() => {
        if (showPathInput && pathInputRef.current) {
            pathInputRef.current.focus()
            pathInputRef.current.select()
        }
    }, [showPathInput])

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

    return (
        <div className="w-full h-full flex flex-col overflow-hidden">
            <div
                ref={dropZoneRef}
                className={`flex-1 flex overflow-hidden transition-colors ${isDragging ? 'bg-primary-500/5' : ''}`}
                style={{'--wails-drop-target': 'filemanager'} as React.CSSProperties}
            >
                <div className="flex flex-col border-r border-border/15 flex-shrink-0" style={{ width: '35%' }}>
                    <div className="px-2 py-1 border-b border-border/30 flex-shrink-0 flex items-center gap-1">
                        <span className="text-[10px] text-text-dim font-medium">目录</span>
                        <div className="ml-auto flex items-center gap-0.5">
                            {hasConnection && (
                                <>
                                    <button className="p-0.5 rounded text-text-dim hover:text-text transition-colors" onClick={() => { setShowSearch(!showSearch); setSearchQuery('') }} title="搜索">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </button>
                                    <button className="p-0.5 rounded text-text-dim hover:text-text transition-colors" onClick={() => loadRemoteFiles()} title="刷新">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
                                        </svg>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    {showSearch && hasConnection && (
                        <div className="px-2 py-1 border-b border-border/30 flex-shrink-0">
                            <input
                                ref={searchInputRef}
                                className="w-full bg-surface-50 rounded-xl border-none px-2 py-1 text-[10px] text-text outline-none focus:shadow-[var(--shadow-glow-sm)]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery('') } }}
                                placeholder="搜索文件名..."
                            />
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto">
                        {!hasConnection ? (
                            <div className="flex items-center justify-center h-full text-text-dim text-[10px]">未连接</div>
                        ) : remoteLoading ? (
                            <div className="flex items-center justify-center py-4 text-text-dim text-[10px]">
                                <svg className="w-3 h-3 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                                加载中...
                            </div>
                        ) : (
                            <>
                                <div
                                    className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[10px] text-text-dim hover:bg-surface-50/50 rounded-t-lg ${remotePath === '/' ? 'bg-primary-500/10 text-primary-500' : ''}`}
                                    onClick={() => navigateRemote('/')}
                                >
                                    <FolderIcon />
                                    <span className="truncate">/</span>
                                </div>
                                {directories.map((dir, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer text-[10px] text-text-dim hover:bg-surface-50/50 ${i === directories.length - 1 ? 'rounded-b-lg' : ''} ${selectedRemote === dir.path ? 'bg-primary-500/10 text-primary-500' : ''}`}
                                        onClick={() => navigateRemote(dir.path)}
                                        onContextMenu={(e) => getRemoteContextMenu(e, dir)}
                                    >
                                        <FolderIcon />
                                        <span className="truncate">{dir.name}</span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                    <div className="px-2 py-1 border-b border-border/30 flex-shrink-0 flex items-center gap-1.5">
                        <button className="p-1 rounded text-text-dim hover:text-text transition-colors flex-shrink-0" onClick={goBackRemote} title="上级目录">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                            </svg>
                        </button>
                        <div className="flex-1 min-w-0">
                            {hasConnection ? (
                                showPathInput ? (
                                    <input
                                        ref={pathInputRef}
                                        className="w-full bg-surface-50 rounded-xl border-none px-2 py-1 text-[10px] font-mono text-text outline-none"
                                        value={pathInput}
                                        onChange={(e) => setPathInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handlePathSubmit()
                                            if (e.key === 'Escape') setShowPathInput(false)
                                        }}
                                        onBlur={() => setShowPathInput(false)}
                                    />
                                ) : (
                                    <div
                                        className="cursor-pointer"
                                        onDoubleClick={() => { setPathInput(remotePath); setShowPathInput(true) }}
                                        title="双击编辑路径"
                                    >
                                        <Breadcrumb path={remotePath} onNavigate={navigateRemote} sep="/" />
                                    </div>
                                )
                            ) : (
                                <span className="text-text-dim text-[10px]">未连接</span>
                            )}
                        </div>
                        {hasConnection && !showPathInput && (
                            <button className="p-0.5 rounded text-text-dim hover:text-text transition-colors flex-shrink-0" onClick={() => { setPathInput(remotePath); setShowPathInput(true) }} title="编辑路径">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                                </svg>
                            </button>
                        )}
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
                        ) : filteredFiles.filesOnly.length === 0 && filteredFiles.directories.length === 0 ? (
                            <div className="flex items-center justify-center py-6 text-text-dim text-xs">
                                {searchQuery ? '无匹配文件' : '无文件'}
                            </div>
                        ) : (
                            <>
                                <div className="mx-1 rounded-xl overflow-hidden">
                                {filteredFiles.directories.map((file, i) => (
                                    <FileItem key={`dir-${i}`} file={file} isSelected={selectedRemote === file.path} onSelect={setSelectedRemote} onNavigate={navigateRemote} onContextMenu={getRemoteContextMenu} />
                                ))}
                                {filteredFiles.filesOnly.map((file, i) => (
                                    <FileItem key={`file-${i}`} file={file} isSelected={selectedRemote === file.path} onSelect={setSelectedRemote} onNavigate={navigateRemote} onContextMenu={getRemoteContextMenu} />
                                ))}
                                </div>
                            </>
                        )}
                    </div>
                    <RemoteCtxOverlay />
                </div>
            </div>

            {transfers.filter(t => t.status === 'pending' || t.status === 'completed').length > 0 && (
                <div className="border-t border-border/30 px-3 py-1.5 max-h-20 overflow-y-auto bg-surface-400/50 rounded-xl">
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
                {hasConnection ? (
                    <>
                        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] transition-colors text-text-dim hover:text-text hover:bg-surface-50/50" onClick={handleMkdirRemote} title="新建目录">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            <span>新建</span>
                        </button>
                        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] transition-colors text-text-dim hover:text-text hover:bg-surface-50/50 disabled:opacity-30" onClick={() => handleRenameRemote()} disabled={!selectedRemote} title="重命名">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>重命名</span>
                        </button>
                        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] transition-colors text-danger hover:bg-danger/8 disabled:opacity-30" onClick={() => handleDeleteRemote()} disabled={!selectedRemote} title="删除">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>删除</span>
                        </button>
                        <div className="w-px h-3.5 bg-border/40 mx-1" />
                        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] transition-colors text-accent-green hover:bg-accent-green/8" onClick={handleUploadClick} title="上传文件">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 13l5-5m0 0l5 5m-5-5v12" />
                            </svg>
                            <span>上传</span>
                        </button>
                        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] transition-colors text-accent-blue hover:bg-accent-blue/8 disabled:opacity-30" onClick={handleDownload} disabled={!selectedRemote} title="下载选中文件">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                            </svg>
                            <span>下载</span>
                        </button>
                    </>
                ) : (
                    <span className="text-[10px] text-text-dim ml-2">请先连接服务器以使用文件管理</span>
                )}
            </div>
        </div>
    )
}

export default FileManager
