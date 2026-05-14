import { create } from 'zustand'
import { ServerConfig, ConnectionInfo, TransferTask, TerminalTab } from '../types'

type MainTab = 'terminal' | 'vnc'

interface UIState {
  activeTab: MainTab
  activeServerId: string | null
  sidebarCollapsed: boolean
  theme: 'dark' | 'light'
  showAddServerDialog: boolean
  editingServer: ServerConfig | null
  statusMessage: string
  latency: number
  transferRate: string

  setActiveTab: (tab: MainTab) => void
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
  reorderTabs: (fromIndex: number, toIndex: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'terminal',
  activeServerId: null,
  sidebarCollapsed: false,
  theme: (() => { const t = localStorage.getItem('wsshell-theme'); return t === 'dark' || t === 'light' ? t : 'light' })(),
  showAddServerDialog: false,
  editingServer: null,
  statusMessage: '未连接',
  latency: 0,
  transferRate: '0 KB/s',

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveServerId: (serverId) => set({ activeServerId: serverId }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => {
    localStorage.setItem('wsshell-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  },
  setShowAddServerDialog: (show) => set({ showAddServerDialog: show }),
  setEditingServer: (server) => set({ editingServer: server }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
  setLatency: (ms) => set({ latency: ms }),
  setTransferRate: (rate) => set({ transferRate: rate }),
}))

interface ConnectionState {
  servers: ServerConfig[]
  connections: Record<string, ConnectionInfo>
  sftpSessions: Record<string, string>

  setServers: (servers: ServerConfig[]) => void
  addConnection: (serverId: string, info: ConnectionInfo) => void
  removeConnection: (serverId: string) => void
  addSftpSession: (serverId: string, sessionId: string) => void
  removeSftpSession: (serverId: string) => void
  getConnection: (serverId: string) => ConnectionInfo | undefined
  hasConnection: (serverId: string) => boolean
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  servers: [],
  connections: {},
  sftpSessions: {},

  setServers: (servers) => set({ servers }),
  addConnection: (serverId, info) =>
    set((state) => ({
      connections: { ...state.connections, [serverId]: info },
    })),
  removeConnection: (serverId) =>
    set((state) => {
      const { [serverId]: _, ...rest } = state.connections
      return { connections: rest }
    }),
  addSftpSession: (serverId, sessionId) =>
    set((state) => ({
      sftpSessions: { ...state.sftpSessions, [serverId]: sessionId },
    })),
  removeSftpSession: (serverId) =>
    set((state) => {
      const { [serverId]: _, ...rest } = state.sftpSessions
      return { sftpSessions: rest }
    }),
  getConnection: (serverId) => get().connections[serverId],
  hasConnection: (serverId) => serverId in get().connections,
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

  addTerminalTab: (tab) => {
    useUIStore.getState().setActiveServerId(tab.serverId)
    return set((state) => ({
      terminalTabs: [...state.terminalTabs, tab],
      activeTerminalTabId: tab.id,
    }))
  },

  removeTerminalTab: (tabId) =>
    set((state) => {
      const idx = state.terminalTabs.findIndex((t) => t.id === tabId)
      const newTabs = state.terminalTabs.filter((t) => t.id !== tabId)
      let newActiveId = state.activeTerminalTabId
      if (state.activeTerminalTabId === tabId) {
        if (newTabs.length > 0) {
          const newIdx = Math.min(idx, newTabs.length - 1)
          newActiveId = newTabs[newIdx].id
          const newActiveTab = newTabs[newIdx]
          if (newActiveTab) {
            useUIStore.getState().setActiveServerId(newActiveTab.serverId)
          }
        } else {
          newActiveId = null
        }
      }
      return { terminalTabs: newTabs, activeTerminalTabId: newActiveId }
    }),

  setActiveTerminalTab: (tabId) => {
    const tab = get().terminalTabs.find(t => t.id === tabId)
    if (tab) useUIStore.getState().setActiveServerId(tab.serverId)
    set({ activeTerminalTabId: tabId })
  },

  updateTerminalTab: (tabId, updates) =>
    set((state) => ({
      terminalTabs: state.terminalTabs.map((t) =>
        t.id === tabId ? { ...t, ...updates } : t
      ),
    })),

  getTerminalTab: (tabId) => get().terminalTabs.find((t) => t.id === tabId),

  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      const tabs = [...state.terminalTabs]
      const [moved] = tabs.splice(fromIndex, 1)
      tabs.splice(toIndex, 0, moved)
      return { terminalTabs: tabs }
    }),
}))
