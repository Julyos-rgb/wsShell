export interface ServerConfig {
  id: string
  name: string
  group: string
  host: string
  port: number
  username: string
  authType: string
  password: string
  privateKey: string
  vncEnabled: boolean
  vncPort: number
  vncPassword: string
  vncTunnel: boolean
  favorite: boolean
  tags: string[]
  createdAt?: string
  updatedAt?: string
}

export interface ConnectionInfo {
  sessionId: string
  serverId: string
  serverName: string
  host: string
  port: number
  username: string
  connected: boolean
  connectedAt: number
}

export interface FileEntry {
  name: string
  size: number
  type: string
  path: string
  modTime?: string
  mode?: string
}

export interface TransferTask {
  id: string
  type: string
  localPath: string
  remotePath: string
  progress: number
  total: number
  written: number
  status: string
  error?: string
}

export interface TerminalTab {
  id: string
  serverId: string
  sessionId: string
  label: string
  serverName: string
  connected: boolean
}
