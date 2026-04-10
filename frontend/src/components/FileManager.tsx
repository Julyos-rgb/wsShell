import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
    ListFiles, UploadFile, DownloadFile,
    DeleteFile, Mkdir, Rename, GetTransferState,
    ResumeUpload, ResumeDownload, PickFiles, PickSaveFile,
} from '../../wailsjs/go/sftp/SFTPManager'
import { EventsOn, EventsOff, OnFileDrop, OnFileDropOff } from '../../wailsjs/runtime/runtime'
import { sftp } from '../../wailsjs/go/models'
import { FileEntry } from '../types'
import { useConnectionStore, useUIStore, useTransferStore } from '../stores/ui'
import { useContextMenu, ContextMenuItem } from './ContextMenu'
import { useDialog } from './Dialog'
import { useToast } from './Toast'

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

type SortField = 'name' | 'size' | 'modTime'
type SortDir = 'asc' | 'desc'

interface FileItemProps {
    file: FileEntry
    isSelected: boolean
    onSelect: (path: string, multi: boolean) => void
    onNavigate: (path: string) => void
    onContextMenu: (e: React.MouseEvent, file: FileEntry) => void
    onDoubleClick: (file: FileEntry) => void
}

const FileItem: React.FC<FileItemProps> = ({ file, isSelected, onSelect, onNavigate, onContextMenu, onDoubleClick }) => (
    <div
        className={`flex items-center px-2 py-1 cursor-pointer transition-colors rounded text-xs ${
            isSelected ? 'bg-primary-500/15 text-primary-300' : 'hover:bg-surface-50/40 text-text-muted'
        }`}
        onClick={(e) => {
            if (file.type === 'directory') {
                onNavigate(file.path)
            } else {
                onSelect(file.path, e.ctrlKey || e.metaKey)
            }
        }}
        onDoubleClick={() => { if (file.type !== 'directory') onDoubleClick(file) }}
        onContextMenu={(e) => onContextMenu(e, file)}
    >
        <div className="flex items-center gap-2 min-w-0 flex-1">
            {file.type === 'directory' ? <FolderIcon /> : <FileIcon />}
            <span className="truncate">{file.name}</span>
        </div>
        {file.modTime && (
            <span className="text-text-dim flex-shrink-0 ml-2 font-mono text-[10px] w-[120px] text-right">
                {file.modTime}
            </span>
        )}
        <span className="text-text-dim flex-shrink-0 ml-2 font-mono text-[10px] w-[60px] text-right">
            {file.type === 'file' ? formatSize(file.size) : ''}
        </span>
    </div>
)

interface BreadcrumbProps {
    path: string
    onNavigate: (path: string) => void
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ path, onNavigate }) => {
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 0) {
        return <span className="text-text-muted cursor-pointer hover:text-text transition-colors" onClick={() => onNavigate('/')}>/</span>
    }

    return (
        <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
            <span
                className="text-text-muted hover:text-text transition-colors cursor-pointer flex-shrink-0"
                onClick={() => onNavigate('/')}
            >
                /
            </span>
            {parts.map((part, i) => {
                const targetPath = '/' + parts.slice(0, i + 1).join('/')
                return (
                    <React.Fragment key={i}>
                        <svg className="w-2.5 h-2.5 text-text-dim/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span
                            className={`text-[10px] truncate transition-colors cursor-pointer ${
                                i === parts.length - 1
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
    const { transfers, addTransfer, updateTransfer, removeTransfer } = useTransferStore()
    const { confirm, prompt: dialogPrompt } = useDialog()
    const { toast } = useToast()
    const [remoteFiles, setRemoteFiles] = useState<FileEntry[]>([])
    const [remotePath, setRemotePath] = useState('/')
    const [remoteLoading, setRemoteLoading] = useState(false)
    const [selectedRemotes, setSelectedRemotes] = useState<Set<string>>(new Set())
    const [remoteHistory, setRemoteHistory] = useState<string[]>([])
    const [remoteForward, setRemoteForward] = useState<string[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)
    const [pathInput, setPathInput] = useState('')
    const [showPathInput, setShowPathInput] = useState(false)
    const [sortField, setSortField] = useState<SortField>('name')
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    const [viewingFile, setViewingFile] = useState<{ name: string; content: string } | null>(null)
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/']))
    const [treeChildCache, setTreeChildCache] = useState<Record<string, FileEntry[]>>({})
    const dropZoneRef = useRef<HTMLDivElement>(null)
    const remotePathRef = useRef('/')
    const searchInputRef = useRef<HTMLInputElement>(null)
    const pathInputRef = useRef<HTMLInputElement>(null)
    const { show: showRemoteCtx, ContextMenuOverlay: RemoteCtxOverlay } = useContextMenu()
    const confirmRef = useRef(confirm)
    confirmRef.current = confirm

    const getSftpSessionId = useCallback(() => {
        if (!activeServerId) return null
        return sftpSessions[activeServerId] || null
    }, [activeServerId, sftpSessions])

    const loadRemoteFiles = useCallback(async (path?: string, _pushHistory?: boolean) => {
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
                const dirs = (resp.files || []).filter((f: FileEntry) => f.type === 'directory')
                setTreeChildCache(prev => ({ ...prev, [resp.path || '/']: dirs }))
            }
        } catch (e) {
            toast(`加载文件列表失败: ${e}`, 'error')
        }
        setRemoteLoading(false)
    }, [getSftpSessionId, toast])

    const expandPathTo = useCallback((path: string) => {
        const parts = path.split('/').filter(Boolean)
        const ancestors: string[] = []
        for (let i = 1; i <= parts.length; i++) {
            ancestors.push('/' + parts.slice(0, i).join('/'))
        }
        setExpandedDirs(prev => {
            const next = new Set(prev)
            ancestors.forEach(p => next.add(p))
            return next
        })
    }, [])

    const navigateRemote = useCallback((path: string) => {
        setRemoteHistory(prev => [...prev, remotePathRef.current])
        setRemoteForward([])
        expandPathTo(path)
        loadRemoteFiles(path)
    }, [loadRemoteFiles, expandPathTo])

    const loadTreeChildren = useCallback(async (path: string) => {
        const sessionId = getSftpSessionId()
        if (!sessionId) return
        try {
            const resp = await ListFiles({ sessionId, path })
            if (resp.success) {
                const dirs = (resp.files || []).filter((f: FileEntry) => f.type === 'directory')
                setTreeChildCache(prev => ({ ...prev, [path]: dirs }))
            }
        } catch (e) { /* ignore tree errors */ }
    }, [getSftpSessionId])

    useEffect(() => {
        const sessionId = getSftpSessionId()
        if (sessionId) {
            loadRemoteFiles('/')
            setExpandedDirs(new Set(['/']))
            setTreeChildCache({})
            setSelectedRemotes(new Set())
            setRemoteHistory([])
            setRemoteForward([])
            loadTreeChildren('/')
        }
    }, [activeServerId, sftpSessions])

    useEffect(() => {
        if (!getSftpSessionId()) return
        expandedDirs.forEach(dir => {
            if (!treeChildCache[dir]) {
                loadTreeChildren(dir)
            }
        })
    }, [expandedDirs, getSftpSessionId, loadTreeChildren])

    const toggleDirExpand = useCallback((path: string) => {
        setExpandedDirs(prev => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
                if (!treeChildCache[path]) {
                    loadTreeChildren(path)
                }
            }
            return next
        })
    }, [treeChildCache, loadTreeChildren])

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
        const handleDownloadProgress = (data: any) => {
            const taskId = `download-${data.localPath}-${data.remotePath}`
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
        EventsOn('sftp:download:progress', handleDownloadProgress)
        return () => {
            EventsOff('sftp:upload:progress')
            EventsOff('sftp:download:progress')
        }
    }, [])

    useEffect(() => {
        const completed = transfers.filter(t => t.status === 'completed')
        if (completed.length === 0) return
        const timers = completed.map(t =>
            setTimeout(() => removeTransfer(t.id), 3000)
        )
        return () => { timers.forEach(clearTimeout) }
    }, [transfers.filter(t => t.status === 'completed').length, removeTransfer])

    const handleDownload = useCallback(async (filePath?: string) => {
        const target = filePath || (selectedRemotes.size === 1 ? [...selectedRemotes][0] : null)
        if (!target || !getSftpSessionId()) return
        const file = remoteFiles.find((f) => f.path === target)
        if (!file || file.type === 'directory') return
        const sessionId = getSftpSessionId()!

        let localFilePath: string
        try {
            const resp = await PickSaveFile({ defaultFilename: file.name } as sftp.PickSaveFileRequest)
            if (resp.error) { toast(resp.error, 'error'); return }
            if (!resp.path) return
            localFilePath = resp.path
        } catch (e) { toast(`打开保存对话框失败: ${e}`, 'error'); return }

        try {
            const state = await GetTransferState({
                sessionId, remotePath: file.path, localPath: localFilePath, direction: 'download',
            } as sftp.GetTransferStateRequest)
            if (state.canResume) {
                const confirmed = await confirmRef.current({
                    title: '续传确认',
                    message: `检测到部分文件 (${formatSize(state.localSize || 0)} / ${formatSize(state.remoteSize || 0)})，是否续传？`,
                    confirmText: '续传',
                })
                if (confirmed) {
                    const taskId = `download-${localFilePath}-${file.path}`
                    addTransfer({ id: taskId, type: 'download', localPath: localFilePath, remotePath: file.path, progress: 0, total: file.size, written: 0, status: 'pending' })
                    try {
                        await ResumeDownload({ sessionId, remotePath: file.path, localPath: localFilePath, offset: -1 } as sftp.ResumeDownloadRequest)
                        updateTransfer(taskId, { status: 'completed', progress: 100 })
                    } catch (e: any) {
                        updateTransfer(taskId, { status: 'error', error: String(e) })
                        toast(`下载失败: ${e}`, 'error')
                    }
                    return
                }
            }
        } catch (e) { /* ignore state check errors */ }

        const taskId = `download-${localFilePath}-${file.path}`
        addTransfer({ id: taskId, type: 'download', localPath: localFilePath, remotePath: file.path, progress: 0, total: file.size, written: 0, status: 'pending' })
        try {
            await DownloadFile({ sessionId, remotePath: file.path, localPath: localFilePath } as sftp.DownloadRequest)
            updateTransfer(taskId, { status: 'completed', progress: 100 })
        } catch (e: any) {
            updateTransfer(taskId, { status: 'error', error: String(e) })
            toast(`下载失败: ${e}`, 'error')
        }
    }, [selectedRemotes, getSftpSessionId, remoteFiles, addTransfer, updateTransfer, toast])

    const handleDownloadSelected = useCallback(async () => {
        for (const path of selectedRemotes) {
            await handleDownload(path)
        }
    }, [selectedRemotes, handleDownload])

    const handleDeleteRemote = useCallback(async (filePath?: string) => {
        const targets = filePath ? [filePath] : [...selectedRemotes]
        if (targets.length === 0 || !getSftpSessionId()) return
        const files = targets.map(t => remoteFiles.find(f => f.path === t)).filter(Boolean)
        const names = files.map(f => f?.name || '').join(', ')
        const ok = await confirm({
            title: '删除确认',
            message: `确定删除 ${targets.length > 1 ? `${targets.length} 个项目` : `"${names}"`} 吗？${files.some(f => f?.type === 'directory') ? '\n目录将递归删除所有内容。' : ''}`,
            confirmText: '删除',
            danger: true,
        })
        if (!ok) return
        try {
            for (const target of targets) {
                const resp = await DeleteFile({ sessionId: getSftpSessionId()!, path: target })
                if (!resp.success) {
                    toast(`删除失败: ${resp.error}`, 'error')
                }
            }
            loadRemoteFiles()
            setSelectedRemotes(new Set())
        } catch (e: any) {
            toast(`删除失败: ${e}`, 'error')
        }
    }, [selectedRemotes, getSftpSessionId, remoteFiles, confirm, loadRemoteFiles, toast])

    const handleRenameRemote = useCallback(async (filePath?: string) => {
        const target = filePath || (selectedRemotes.size === 1 ? [...selectedRemotes][0] : null)
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
            setSelectedRemotes(new Set())
        } catch (e: any) {
            toast(`重命名失败: ${e}`, 'error')
        }
    }, [selectedRemotes, getSftpSessionId(), remoteFiles, dialogPrompt, loadRemoteFiles, toast])

    const handleMkdirRemote = useCallback(async () => {
        const name = await dialogPrompt({
            title: '新建目录',
            placeholder: '目录名称',
            confirmText: '创建',
        })
        if (!name || !getSftpSessionId()) return
        try {
            await Mkdir({ sessionId: getSftpSessionId()!, path: remotePath === '/' ? '/' + name : remotePath + '/' + name } as sftp.MkdirRequest)
            loadRemoteFiles()
        } catch (e: any) {
            toast(`创建目录失败: ${e}`, 'error')
        }
    }, [getSftpSessionId, remotePath, dialogPrompt, loadRemoteFiles, toast])

    const handleViewFile = useCallback(async (file: FileEntry) => {
        if (file.type === 'directory') {
            navigateRemote(file.path)
            return
        }
        if (!getSftpSessionId()) return
        try {
            const { ReadRemoteFile } = await import('../../wailsjs/go/sftp/SFTPManager')
            const resp = await ReadRemoteFile({ sessionId: getSftpSessionId()!, path: file.path, maxSize: 512 * 1024 } as any)
            if (resp.success) {
                setViewingFile({ name: file.name, content: resp.content || '' })
            } else {
                toast(`查看文件失败: ${resp.error}`, 'error')
            }
        } catch {
            toast('暂不支持查看该文件', 'warning')
        }
    }, [getSftpSessionId, navigateRemote, toast])

    const uploadLocalFiles = useCallback(async (localPaths: string[]) => {
        const sessionId = getSftpSessionId()
        if (!sessionId || localPaths.length === 0) return

        for (const localPath of localPaths) {
            const fileName = localPath.split(/[/\\]/).pop() || 'unknown'
            const currentRemotePath = remotePathRef.current
            const remoteFilePath = currentRemotePath === '/' ? '/' + fileName : currentRemotePath + '/' + fileName

            try {
                const state = await GetTransferState({ sessionId, localPath, remotePath: remoteFilePath, direction: 'upload' } as sftp.GetTransferStateRequest)
                const remoteSize = state.remoteSize ?? 0
                const localSize = state.localSize ?? 0
                if (remoteSize > 0 && localSize > 0) {
                    const action = await confirm({
                        title: '文件已存在',
                        message: `远程已存在 "${fileName}" (${formatSize(remoteSize)})，如何处理？`,
                        confirmText: '覆盖',
                        cancelText: '跳过',
                    })
                    if (!action) continue
                    if (state.canResume) {
                        const doResume = await confirm({
                            title: '续传',
                            message: `本地文件 ${formatSize(localSize)}，远程已有 ${formatSize(remoteSize)}，是否续传？`,
                            confirmText: '续传',
                            cancelText: '覆盖',
                        })
                        if (doResume) {
                            const taskId = `upload-${localPath}-${remoteFilePath}`
                            addTransfer({ id: taskId, type: 'upload', localPath, remotePath: remoteFilePath, progress: 0, total: localSize, written: 0, status: 'pending' })
                            try {
                                await ResumeUpload({ sessionId, localPath, remotePath: remoteFilePath, offset: -1 } as sftp.ResumeUploadRequest)
                                updateTransfer(taskId, { status: 'completed', progress: 100 })
                            } catch (err: any) {
                                updateTransfer(taskId, { status: 'error', error: String(err) })
                                toast(`上传失败: ${err}`, 'error')
                            }
                            continue
                        }
                    }
                }
            } catch (e) { /* ignore state check errors */ }
            const taskId = `upload-${localPath}-${remoteFilePath}`
            addTransfer({ id: taskId, type: 'upload', localPath, remotePath: remoteFilePath, progress: 0, total: 0, written: 0, status: 'pending' })
            try {
                await UploadFile({ sessionId, localPath, remotePath: remoteFilePath } as sftp.UploadRequest)
                updateTransfer(taskId, { status: 'completed', progress: 100 })
            } catch (err: any) {
                updateTransfer(taskId, { status: 'error', error: String(err) })
                toast(`上传失败: ${err}`, 'error')
            }
        }
        loadRemoteFiles()
    }, [getSftpSessionId, addTransfer, updateTransfer, loadRemoteFiles, confirm, toast])

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
            if (resp.error) { toast(resp.error, 'error'); return }
            if (resp.paths && resp.paths.length > 0) {
                await uploadLocalFiles(resp.paths)
            }
        } catch (e: any) { toast(`选择文件失败: ${e}`, 'error') }
    }, [uploadLocalFiles, toast])

    const handlePathSubmit = () => {
        const p = pathInput.trim()
        if (p) {
            setRemoteHistory(prev => [...prev, remotePathRef.current])
            setRemoteForward([])
            expandPathTo(p)
            loadRemoteFiles(p)
            setShowPathInput(false)
        }
    }

    const hasConnection = !!getSftpSessionId()

    const goBackRemote = useCallback(() => {
        if (remoteHistory.length > 0) {
            const prev = remoteHistory[remoteHistory.length - 1]
            setRemoteHistory(h => h.slice(0, -1))
            setRemoteForward(f => [remotePathRef.current, ...f])
            expandPathTo(prev)
            loadRemoteFiles(prev, false)
        } else if (remotePath !== '/') {
            const parts = remotePath.split('/').filter(Boolean)
            parts.pop()
            const parentPath = '/' + parts.join('/') || '/'
            expandPathTo(parentPath)
            loadRemoteFiles(parentPath, false)
        }
    }, [remoteHistory, remotePath, loadRemoteFiles, expandPathTo])

    const goForwardRemote = useCallback(() => {
        if (remoteForward.length > 0) {
            const next = remoteForward[0]
            setRemoteForward(f => f.slice(1))
            setRemoteHistory(h => [...h, remotePathRef.current])
            expandPathTo(next)
            loadRemoteFiles(next, false)
        }
    }, [remoteForward, loadRemoteFiles, expandPathTo])

    const toggleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('asc')
        }
    }, [sortField])

    const sortedFiles = useMemo(() => {
        const dirs = remoteFiles.filter(f => f.type === 'directory')
        const files = remoteFiles.filter(f => f.type === 'file')
        const sortFn = (a: FileEntry, b: FileEntry) => {
            let cmp = 0
            switch (sortField) {
                case 'name': cmp = a.name.localeCompare(b.name); break
                case 'size': cmp = a.size - b.size; break
                case 'modTime': cmp = (a.modTime || '').localeCompare(b.modTime || ''); break
            }
            return sortDir === 'asc' ? cmp : -cmp
        }
        dirs.sort(sortFn)
        files.sort(sortFn)
        return { directories: dirs, filesOnly: files }
    }, [remoteFiles, sortField, sortDir])

    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return sortedFiles
        const q = searchQuery.toLowerCase().trim()
        return {
            directories: sortedFiles.directories.filter(f => f.name.toLowerCase().includes(q)),
            filesOnly: sortedFiles.filesOnly.filter(f => f.name.toLowerCase().includes(q)),
        }
    }, [sortedFiles, searchQuery])

    useEffect(() => {
        if (showSearch && searchInputRef.current) searchInputRef.current.focus()
    }, [showSearch])

    useEffect(() => {
        if (showPathInput && pathInputRef.current) {
            pathInputRef.current.focus()
            pathInputRef.current.select()
        }
    }, [showPathInput])

    const handleSelect = useCallback((path: string, multi: boolean) => {
        setSelectedRemotes(prev => {
            const next = new Set(multi ? prev : [])
            if (next.has(path) && multi) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
    }, [])

    const handleSelectAll = useCallback(() => {
        if (selectedRemotes.size === remoteFiles.length) {
            setSelectedRemotes(new Set())
        } else {
            setSelectedRemotes(new Set(remoteFiles.map(f => f.path)))
        }
    }, [selectedRemotes, remoteFiles])

    const getRemoteContextMenu = useCallback((e: React.MouseEvent, file: FileEntry) => {
        const items: ContextMenuItem[] = [
            ...(file.type === 'directory' ? [{
                label: '进入目录',
                icon: <FolderIcon />,
                onClick: () => navigateRemote(file.path),
            }, { separator: true } as ContextMenuItem] : [{
                label: '查看文件',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                ),
                onClick: () => handleViewFile(file),
            }, {
                label: '下载到本地',
                icon: (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                    </svg>
                ),
                onClick: () => handleDownload(file.path),
            }, { separator: true } as ContextMenuItem]),
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
        showRemoteCtx(e, items)
    }, [navigateRemote, handleDownload, handleRenameRemote, handleDeleteRemote, handleViewFile, showRemoteCtx])

    const renderTreeItem = (dir: FileEntry, depth: number, isRoot: boolean) => {
        const isExpanded = expandedDirs.has(dir.path)
        const children = treeChildCache[dir.path] || []
        const isActive = remotePath === dir.path
        const hasChildren = children.length > 0

        return (
            <div key={dir.path}>
                <div
                    className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-[10px] hover:bg-surface-50/40 ${isActive ? 'bg-primary-500/10 text-primary-300' : 'text-text-dim'}`}
                    style={{ paddingLeft: `${depth * 10 + 8}px` }}
                    onContextMenu={(e) => getRemoteContextMenu(e, dir)}
                >
                    <button
                        className={`flex items-center justify-center w-3 h-3 flex-shrink-0 rounded-sm ${hasChildren ? 'hover:bg-surface-50/60' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleDirExpand(dir.path) }}
                    >
                        {hasChildren ? (
                            <svg className={`w-2.5 h-2.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        ) : (
                            <span className="w-2.5 h-2.5" />
                        )}
                    </button>
                    <span className="flex items-center gap-1 flex-1 min-w-0" onClick={() => navigateRemote(dir.path)}>
                        <FolderIcon />
                        <span className="truncate">{isRoot ? '/' : dir.name}</span>
                    </span>
                </div>
                {isExpanded && children.map(child => renderTreeItem(child, depth + 1, false))}
            </div>
        )
    }

    const SortHeader: React.FC<{ field: SortField; label: string; width?: string }> = ({ field, label, width }) => (
        <button
            className={`flex items-center gap-0.5 text-[9px] font-medium transition-colors px-1 py-0.5 rounded ${sortField === field ? 'text-primary-400' : 'text-text-dim hover:text-text-muted'}`}
            style={width ? { width } : undefined}
            onClick={() => toggleSort(field)}
        >
            {label}
            {sortField === field && (
                <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={sortDir === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                </svg>
            )}
        </button>
    )

    return (
        <div className="w-full h-full flex flex-col overflow-hidden">
            <div
                ref={dropZoneRef}
                className={`flex-1 flex overflow-hidden transition-colors ${isDragging ? 'bg-primary-500/5' : ''}`}
                style={{'--wails-drop-target': 'filemanager'} as React.CSSProperties}
            >
                <div className="flex flex-col border-r border-border/30 flex-shrink-0" style={{ width: '35%' }}>
                    <div className="px-2 py-1 border-b border-border/30 flex-shrink-0 flex items-center gap-1">
                        <span className="text-[10px] text-text-dim font-medium">目录</span>
                        <div className="ml-auto flex items-center gap-0.5">
                            {hasConnection && (
                                <button className="p-0.5 rounded text-text-dim hover:text-text transition-colors" onClick={() => loadRemoteFiles()} title="刷新">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 014.51 15" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {!hasConnection ? (
                            <div className="flex items-center justify-center h-full text-text-dim text-[10px]">未连接</div>
                        ) : remoteLoading && !treeChildCache['/'] ? (
                            <div className="flex items-center justify-center py-4 text-text-dim text-[10px]">
                                <svg className="w-3 h-3 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                                加载中...
                            </div>
                        ) : (
                            <>
                                {renderTreeItem({ name: '/', path: '/', type: 'directory' } as FileEntry, 0, true)}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                    <div className="px-2 py-1 border-b border-border/30 flex-shrink-0 flex items-center gap-1">
                        <button
                            className="p-1 rounded text-text-dim hover:text-text transition-colors flex-shrink-0 disabled:opacity-30"
                            onClick={goBackRemote}
                            disabled={remoteHistory.length === 0 && remotePath === '/'}
                            title="后退"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                            </svg>
                        </button>
                        <button
                            className="p-1 rounded text-text-dim hover:text-text transition-colors flex-shrink-0 disabled:opacity-30"
                            onClick={goForwardRemote}
                            disabled={remoteForward.length === 0}
                            title="前进"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>
                        <div className="flex-1 min-w-0">
                            {hasConnection ? (
                                showPathInput ? (
                                    <input
                                        ref={pathInputRef}
                                        className="w-full bg-surface-400 border border-primary-400 rounded px-1.5 py-0.5 text-[10px] font-mono text-text outline-none"
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
                                        <Breadcrumb path={remotePath} onNavigate={navigateRemote} />
                                    </div>
                                )
                            ) : (
                                <span className="text-text-dim text-[10px]">未连接</span>
                            )}
                        </div>
                        {hasConnection && !showPathInput && (
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button className="p-0.5 rounded text-text-dim hover:text-text transition-colors" onClick={() => { setPathInput(remotePath); setShowPathInput(true) }} title="编辑路径">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                                    </svg>
                                </button>
                                <button className={`p-0.5 rounded transition-colors ${showSearch ? 'text-primary-400' : 'text-text-dim hover:text-text'}`} onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery('') }} title="搜索">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>

                    {hasConnection && (
                        <div className="flex items-center px-2 py-0.5 border-b border-border/20 flex-shrink-0 text-text-dim gap-1">
                            {showSearch ? (
                                <input
                                    ref={searchInputRef}
                                    className="flex-1 bg-surface-400 border border-primary-400/60 rounded px-1.5 py-0.5 text-[10px] text-text outline-none placeholder:text-text-dim/50"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery('') } }}
                                    placeholder="搜索当前目录..."
                                    autoFocus
                                />
                            ) : (
                                <>
                                    <div className="flex-1">
                                        <SortHeader field="name" label="名称" />
                                    </div>
                                    <SortHeader field="modTime" label="修改时间" width="120px" />
                                    <SortHeader field="size" label="大小" width="60px" />
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto relative" onClick={() => setSelectedRemotes(new Set())}>
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
                                {filteredFiles.directories.map((file, i) => (
                                    <FileItem
                                        key={`dir-${i}`}
                                        file={file}
                                        isSelected={selectedRemotes.has(file.path)}
                                        onSelect={handleSelect}
                                        onNavigate={navigateRemote}
                                        onContextMenu={getRemoteContextMenu}
                                        onDoubleClick={handleViewFile}
                                    />
                                ))}
                                {filteredFiles.filesOnly.map((file, i) => (
                                    <FileItem
                                        key={`file-${i}`}
                                        file={file}
                                        isSelected={selectedRemotes.has(file.path)}
                                        onSelect={handleSelect}
                                        onNavigate={navigateRemote}
                                        onContextMenu={getRemoteContextMenu}
                                        onDoubleClick={handleViewFile}
                                    />
                                ))}
                            </>
                        )}
                    </div>
                    <RemoteCtxOverlay />
                </div>
            </div>

            {viewingFile && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={() => setViewingFile(null)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                        className="relative bg-surface-300 rounded-lg shadow-glass border border-border/60 animate-slide-up flex flex-col"
                        style={{ width: '70vw', maxHeight: '70vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
                            <span className="text-xs font-medium text-text flex-1 truncate">{viewingFile.name}</span>
                            <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={() => setViewingFile(null)}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <pre className="text-[11px] font-mono text-text-muted whitespace-pre-wrap break-all leading-relaxed">{viewingFile.content}</pre>
                        </div>
                    </div>
                </div>
            )}

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
                {hasConnection ? (
                    <>
                        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-dim hover:text-text hover:bg-surface-50/40 transition-colors" onClick={handleMkdirRemote} title="新建目录">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                            <span>新建</span>
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-dim hover:text-text hover:bg-surface-50/40 transition-colors disabled:opacity-30" onClick={() => handleRenameRemote()} disabled={selectedRemotes.size !== 1} title="重命名">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>重命名</span>
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-dim hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-30" onClick={() => handleDeleteRemote()} disabled={selectedRemotes.size === 0} title="删除">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>删除{selectedRemotes.size > 1 ? `(${selectedRemotes.size})` : ''}</span>
                        </button>
                        <div className="w-px h-3.5 bg-border/40 mx-1" />
                        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-accent-green hover:bg-accent-green/10 transition-colors" onClick={handleUploadClick} title="上传文件">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 13l5-5m0 0l5 5m-5-5v12" />
                            </svg>
                            <span>上传</span>
                        </button>
                        <button className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-accent-blue hover:bg-accent-blue/10 transition-colors disabled:opacity-30" onClick={handleDownloadSelected} disabled={selectedRemotes.size === 0} title="下载选中文件">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                            </svg>
                            <span>下载{selectedRemotes.size > 1 ? `(${selectedRemotes.size})` : ''}</span>
                        </button>
                        <div className="ml-auto">
                            <button className="p-1 rounded text-text-dim hover:text-text transition-colors" onClick={handleSelectAll} title="全选/取消全选 (Ctrl+A)">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </button>
                        </div>
                    </>
                ) : (
                    <span className="text-[10px] text-text-dim ml-2">请先连接服务器以使用文件管理</span>
                )}
            </div>
        </div>
    )
}

export default FileManager
