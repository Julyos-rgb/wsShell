export interface ServerConfig {
  id: string
  name: string
  group: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
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
  type: 'file' | 'directory'
  path: string
  modTime?: string
  mode?: string
}

export interface TransferTask {
  id: string
  type: 'upload' | 'download'
  localPath: string
  remotePath: string
  progress: number
  total: number
  written: number
  status: 'pending' | 'transferring' | 'completed' | 'error'
  error?: string
}
