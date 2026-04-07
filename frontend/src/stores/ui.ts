import { create } from 'zustand'
import { ServerConfig, ConnectionInfo, TransferTask, TerminalTab } from '../types'

interface UIState {
  activeTab: 'terminal' | 'vnc' | 'file'
  activeServerId: string | null
  sidebarCollapsed: boolean
  theme: 'dark' | 'light'
  showAddServerDialog: boolean
  editingServer: ServerConfig | null
  statusMessage: string
  latency: number
  transferRate: string

  setActiveTab: (tab: 'terminal' | 'vnc' | 'file') => void
  setActiveServerId: (serverId: string | null) => void
  toggleSidebar: () => void
  setTheme: (theme: 'dark' | 'light') => void
  setShowAddServerDialog: (show: boolean) => void
  setEditingServer: (server: ServerConfig | null) => void
  setStatusMessage: (msg: string) => void
  setLatency: (ms: number) => void
  setTransferRate: (rate: string) => void
}

interface TerminalTabState {
  terminalTabs: TerminalTab[]
  activeTerminalTabId: string | null

  addTerminalTab: (tab: TerminalTab) => void
  removeTerminalTab: (tabId: string) => void
  setActiveTerminalTab: (tabId: string | null) => void
  updateTerminalTab: (tabId: string, updates: Partial<TerminalTab>) => void
  getTerminalTab: (tabId: string) => TerminalTab | undefined
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'terminal',
  activeServerId: null,
  sidebarCollapsed: false,
  theme: 'dark',
  showAddServerDialog: false,
  editingServer: null,
  statusMessage: '未连接',
  latency: 0,
  transferRate: '0 KB/s',

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveServerId: (serverId) => set({ activeServerId: serverId }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  setShowAddServerDialog: (show) => set({ showAddServerDialog: show }),
  setEditingServer: (server) => set({ editingServer: server }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
  setLatency: (ms) => set({ latency: ms }),
  setTransferRate: (rate) => set({ transferRate: rate }),
}))

interface ConnectionState {
  servers: ServerConfig[]
  connections: Map<string, ConnectionInfo>
  sftpSessions: Map<string, string>

  setServers: (servers: ServerConfig[]) => void
  addConnection: (serverId: string, info: ConnectionInfo) => void
  removeConnection: (serverId: string) => void
  addSftpSession: (serverId: string, sessionId: string) => void
  removeSftpSession: (serverId: string) => void
  getConnection: (serverId: string) => ConnectionInfo | undefined
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  servers: [],
  connections: new Map(),
  sftpSessions: new Map(),

  setServers: (servers) => set({ servers }),
  addConnection: (serverId, info) =>
    set((state) => {
      const next = new Map(state.connections)
      next.set(serverId, info)
      return { connections: next }
    }),
  removeConnection: (serverId) =>
    set((state) => {
      const next = new Map(state.connections)
      next.delete(serverId)
      return { connections: next }
    }),
  addSftpSession: (serverId, sessionId) =>
    set((state) => {
      const next = new Map(state.sftpSessions)
      next.set(serverId, sessionId)
      return { sftpSessions: next }
    }),
  removeSftpSession: (serverId) =>
    set((state) => {
      const next = new Map(state.sftpSessions)
      next.delete(serverId)
      return { sftpSessions: next }
    }),
  getConnection: (serverId) => get().connections.get(serverId),
}))

interface TransferState {
  transfers: TransferTask[]
  addTransfer: (task: TransferTask) => void
  updateTransfer: (id: string, updates: Partial<TransferTask>) => void
  removeTransfer: (id: string) => void
}

export const useTransferStore = create<TransferState>((set) => ({
  transfers: [],

  addTransfer: (task) =>
    set((state) => ({ transfers: [...state.transfers, task] })),
  updateTransfer: (id, updates) =>
    set((state) => ({
      transfers: state.transfers.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  removeTransfer: (id) =>
    set((state) => ({
      transfers: state.transfers.filter((t) => t.id !== id),
    })),
}))

export const useTerminalTabStore = create<TerminalTabState>((set, get) => ({
  terminalTabs: [],
  activeTerminalTabId: null,

  addTerminalTab: (tab) =>
    set((state) => ({
      terminalTabs: [...state.terminalTabs, tab],
      activeTerminalTabId: tab.id,
    })),

  removeTerminalTab: (tabId) =>
    set((state) => {
      const idx = state.terminalTabs.findIndex((t) => t.id === tabId)
      const newTabs = state.terminalTabs.filter((t) => t.id !== tabId)
      let newActiveId = state.activeTerminalTabId
      if (state.activeTerminalTabId === tabId) {
        if (newTabs.length > 0) {
          const newIdx = Math.min(idx, newTabs.length - 1)
          newActiveId = newTabs[newIdx].id
        } else {
          newActiveId = null
        }
      }
      return { terminalTabs: newTabs, activeTerminalTabId: newActiveId }
    }),

  setActiveTerminalTab: (tabId) => set({ activeTerminalTabId: tabId }),

  updateTerminalTab: (tabId, updates) =>
    set((state) => ({
      terminalTabs: state.terminalTabs.map((t) =>
        t.id === tabId ? { ...t, ...updates } : t
      ),
    })),

  getTerminalTab: (tabId) => get().terminalTabs.find((t) => t.id === tabId),
}))
