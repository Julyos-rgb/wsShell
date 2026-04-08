package sftp

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"wsShell/internal/store"

	"github.com/pkg/sftp"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	sshcrypto "golang.org/x/crypto/ssh"
)

type SSHClientProvider interface {
	GetClient(sessionID string) *sshcrypto.Client
	GetHostKeyCallback(host string) sshcrypto.HostKeyCallback
}

type SFTPManager struct {
	mu          sync.RWMutex
	clients     map[string]*sftp.Client
	sshClients  map[string]*sshcrypto.Client
	ownsClient  map[string]bool
	sshProvider SSHClientProvider
	Ctx         context.Context
}

func NewSFTPManager() *SFTPManager {
	return &SFTPManager{
		clients:    make(map[string]*sftp.Client),
		sshClients: make(map[string]*sshcrypto.Client),
		ownsClient: make(map[string]bool),
	}
}

func (m *SFTPManager) SetSSHProvider(provider SSHClientProvider) {
	m.sshProvider = provider
}

type FileInfo struct {
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	Type    string `json:"type"`
	Path    string `json:"path"`
	ModTime string `json:"modTime,omitempty"`
	Mode    string `json:"mode,omitempty"`
}

type ConnectRequest struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	PrivateKey string `json:"privateKey"`
	AuthType   string `json:"authType"`
}

type ConnectResponse struct {
	Success   bool   `json:"success"`
	Error     string `json:"error,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
}

func (m *SFTPManager) Connect(req ConnectRequest) (ConnectResponse, error) {
	if req.Port == 0 {
		req.Port = 22
	}

	var hostKeyCallback sshcrypto.HostKeyCallback
	if m.sshProvider != nil {
		hostKeyCallback = m.sshProvider.GetHostKeyCallback(req.Host)
	} else {
		hostKeyCallback = m.createStandaloneHostKeyCallback()
	}

	config := &sshcrypto.ClientConfig{
		User:            req.Username,
		HostKeyCallback: hostKeyCallback,
		Timeout:         10 * time.Second,
	}

	if req.AuthType == "key" && req.PrivateKey != "" {
		signer, err := sshcrypto.ParsePrivateKey([]byte(req.PrivateKey))
		if err != nil {
			return ConnectResponse{Success: false, Error: err.Error()}, nil
		}
		config.Auth = []sshcrypto.AuthMethod{sshcrypto.PublicKeys(signer)}
	} else {
		config.Auth = []sshcrypto.AuthMethod{sshcrypto.Password(req.Password)}
	}

	addr := fmt.Sprintf("%s:%d", req.Host, req.Port)
	sshClient, err := sshcrypto.Dial("tcp", addr, config)
	if err != nil {
		return ConnectResponse{Success: false, Error: err.Error()}, nil
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		sshClient.Close()
		return ConnectResponse{Success: false, Error: err.Error()}, nil
	}

	sessionID := fmt.Sprintf("%s@%s:%d", req.Username, req.Host, req.Port)

	m.mu.Lock()
	if existing, ok := m.clients[sessionID]; ok {
		existing.Close()
		if sc, ok := m.sshClients[sessionID]; ok && m.ownsClient[sessionID] {
			sc.Close()
		}
	}
	m.clients[sessionID] = sftpClient
	m.sshClients[sessionID] = sshClient
	m.ownsClient[sessionID] = true
	m.mu.Unlock()

	return ConnectResponse{Success: true, SessionID: sessionID}, nil
}

func (m *SFTPManager) createStandaloneHostKeyCallback() sshcrypto.HostKeyCallback {
	repo, err := store.NewHostKeyRepository()
	if err != nil {
		return sshcrypto.InsecureIgnoreHostKey()
	}
	return func(hostname string, remote net.Addr, key sshcrypto.PublicKey) error {
		keyType := key.Type()
		fingerprint := store.FingerprintSHA256(key.Marshal())

		knownKeys, err := repo.GetByHost(hostname)
		if err != nil {
			return nil
		}

		for _, known := range knownKeys {
			if known.KeyType == keyType {
				if known.Fingerprint == fingerprint {
					return nil
				}
				return fmt.Errorf("HOST KEY MISMATCH for %s", hostname)
			}
		}
		return nil
	}
}

type ConnectFromSSHRequest struct {
	SSHSessionID string `json:"sshSessionId"`
}

func (m *SFTPManager) ConnectFromSSH(req ConnectFromSSHRequest) (ConnectResponse, error) {
	if m.sshProvider == nil {
		return ConnectResponse{Success: false, Error: "SSH provider not configured"}, nil
	}

	sshClient := m.sshProvider.GetClient(req.SSHSessionID)
	if sshClient == nil {
		return ConnectResponse{Success: false, Error: "SSH connection not found for session: " + req.SSHSessionID}, nil
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		return ConnectResponse{Success: false, Error: fmt.Sprintf("create SFTP client failed: %v", err)}, nil
	}

	sessionID := req.SSHSessionID

	m.mu.Lock()
	if existing, ok := m.clients[sessionID]; ok {
		existing.Close()
	}
	m.clients[sessionID] = sftpClient
	m.sshClients[sessionID] = sshClient
	m.ownsClient[sessionID] = false
	m.mu.Unlock()

	return ConnectResponse{Success: true, SessionID: sessionID}, nil
}

func (m *SFTPManager) Disconnect(sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if client, ok := m.clients[sessionID]; ok {
		client.Close()
		delete(m.clients, sessionID)
	}
	if sc, ok := m.sshClients[sessionID]; ok && m.ownsClient[sessionID] {
		sc.Close()
		delete(m.sshClients, sessionID)
	}
	delete(m.ownsClient, sessionID)
	return nil
}

type ListFilesRequest struct {
	SessionID string `json:"sessionId"`
	Path      string `json:"path"`
}

type ListFilesResponse struct {
	Success bool       `json:"success"`
	Files   []FileInfo `json:"files,omitempty"`
	Error   string     `json:"error,omitempty"`
	Path    string     `json:"path,omitempty"`
}

func (m *SFTPManager) ListFiles(req ListFilesRequest) (ListFilesResponse, error) {
	m.mu.RLock()
	client, ok := m.clients[req.SessionID]
	m.mu.RUnlock()

	if !ok {
		return ListFilesResponse{Success: false, Error: "SFTP session not connected"}, nil
	}

	path := req.Path
	if path == "" {
		path = "."
	}

	entries, err := client.ReadDir(path)
	if err != nil {
		return ListFilesResponse{Success: false, Error: err.Error()}, nil
	}

	files := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		fileType := "file"
		if entry.IsDir() {
			fileType = "directory"
		}

		fullPath := filepath.Join(path, entry.Name())
		fullPath = strings.ReplaceAll(fullPath, "\\", "/")

		files = append(files, FileInfo{
			Name:    entry.Name(),
			Size:    entry.Size(),
			Type:    fileType,
			Path:    fullPath,
			ModTime: entry.ModTime().Format("2006-01-02 15:04:05"),
			Mode:    entry.Mode().String(),
		})
	}

	return ListFilesResponse{Success: true, Files: files, Path: path}, nil
}

type UploadRequest struct {
	SessionID  string `json:"sessionId"`
	LocalPath  string `json:"localPath"`
	RemotePath string `json:"remotePath"`
}

type UploadResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *SFTPManager) UploadFile(req UploadRequest) (UploadResponse, error) {
	m.mu.RLock()
	client, ok := m.clients[req.SessionID]
	m.mu.RUnlock()

	if !ok {
		return UploadResponse{Success: false, Error: "SFTP session not connected"}, nil
	}

	localFile, err := os.Open(req.LocalPath)
	if err != nil {
		return UploadResponse{Success: false, Error: err.Error()}, nil
	}
	defer localFile.Close()

	stat, err := localFile.Stat()
	if err != nil {
		return UploadResponse{Success: false, Error: err.Error()}, nil
	}

	remoteFile, err := client.Create(req.RemotePath)
	if err != nil {
		return UploadResponse{Success: false, Error: err.Error()}, nil
	}
	defer remoteFile.Close()

	buf := make([]byte, 32768)
	var written int64
	total := stat.Size()
	var lastEmit time.Time

	for {
		nr, readErr := localFile.Read(buf)
		if nr > 0 {
			nw, writeErr := remoteFile.Write(buf[:nr])
			if writeErr != nil {
				return UploadResponse{Success: false, Error: writeErr.Error()}, nil
			}
			written += int64(nw)

			if m.Ctx != nil && total > 0 {
				now := time.Now()
				progress := float64(written) / float64(total) * 100
				if now.Sub(lastEmit) >= 200*time.Millisecond || progress >= 100 || readErr == io.EOF {
					lastEmit = now
					runtime.EventsEmit(m.Ctx, "sftp:upload:progress", map[string]interface{}{
						"sessionId":  req.SessionID,
						"localPath":  req.LocalPath,
						"remotePath": req.RemotePath,
						"progress":   progress,
						"written":    written,
						"total":      total,
					})
				}
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return UploadResponse{Success: false, Error: readErr.Error()}, nil
		}
	}

	return UploadResponse{Success: true}, nil
}

type DownloadRequest struct {
	SessionID  string `json:"sessionId"`
	RemotePath string `json:"remotePath"`
	LocalPath  string `json:"localPath"`
}

type DownloadResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *SFTPManager) DownloadFile(req DownloadRequest) (DownloadResponse, error) {
	m.mu.RLock()
	client, ok := m.clients[req.SessionID]
	m.mu.RUnlock()

	if !ok {
		return DownloadResponse{Success: false, Error: "SFTP session not connected"}, nil
	}

	remoteFile, err := client.Open(req.RemotePath)
	if err != nil {
		return DownloadResponse{Success: false, Error: err.Error()}, nil
	}
	defer remoteFile.Close()

	stat, err := remoteFile.Stat()
	if err != nil {
		return DownloadResponse{Success: false, Error: err.Error()}, nil
	}

	if err := os.MkdirAll(filepath.Dir(req.LocalPath), 0755); err != nil {
		return DownloadResponse{Success: false, Error: err.Error()}, nil
	}

	localFile, err := os.Create(req.LocalPath)
	if err != nil {
		return DownloadResponse{Success: false, Error: err.Error()}, nil
	}
	defer localFile.Close()

	buf := make([]byte, 32768)
	var written int64
	total := stat.Size()
	var lastEmit time.Time

	for {
		nr, readErr := remoteFile.Read(buf)
		if nr > 0 {
			nw, writeErr := localFile.Write(buf[:nr])
			if writeErr != nil {
				return DownloadResponse{Success: false, Error: writeErr.Error()}, nil
			}
			written += int64(nw)

			if m.Ctx != nil && total > 0 {
				now := time.Now()
				progress := float64(written) / float64(total) * 100
				if now.Sub(lastEmit) >= 200*time.Millisecond || progress >= 100 || readErr == io.EOF {
					lastEmit = now
					runtime.EventsEmit(m.Ctx, "sftp:download:progress", map[string]interface{}{
						"sessionId":  req.SessionID,
						"remotePath": req.RemotePath,
						"localPath":  req.LocalPath,
						"progress":   progress,
						"written":    written,
						"total":      total,
					})
				}
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return DownloadResponse{Success: false, Error: readErr.Error()}, nil
		}
	}

	return DownloadResponse{Success: true}, nil
}

type DeleteFileRequest struct {
	SessionID string `json:"sessionId"`
	Path      string `json:"path"`
}

type DeleteFileResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *SFTPManager) DeleteFile(req DeleteFileRequest) (DeleteFileResponse, error) {
	m.mu.RLock()
	client, ok := m.clients[req.SessionID]
	m.mu.RUnlock()

	if !ok {
		return DeleteFileResponse{Success: false, Error: "SFTP session not connected"}, nil
	}

	err := client.Remove(req.Path)
	if err != nil {
		return DeleteFileResponse{Success: false, Error: err.Error()}, nil
	}

	return DeleteFileResponse{Success: true}, nil
}

type MkdirRequest struct {
	SessionID string `json:"sessionId"`
	Path      string `json:"path"`
}

type MkdirResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *SFTPManager) Mkdir(req MkdirRequest) (MkdirResponse, error) {
	m.mu.RLock()
	client, ok := m.clients[req.SessionID]
	m.mu.RUnlock()

	if !ok {
		return MkdirResponse{Success: false, Error: "SFTP session not connected"}, nil
	}

	err := client.Mkdir(req.Path)
	if err != nil {
		return MkdirResponse{Success: false, Error: err.Error()}, nil
	}

	return MkdirResponse{Success: true}, nil
}

type RenameRequest struct {
	SessionID string `json:"sessionId"`
	OldPath   string `json:"oldPath"`
	NewPath   string `json:"newPath"`
}

type RenameResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *SFTPManager) Rename(req RenameRequest) (RenameResponse, error) {
	m.mu.RLock()
	client, ok := m.clients[req.SessionID]
	m.mu.RUnlock()

	if !ok {
		return RenameResponse{Success: false, Error: "SFTP session not connected"}, nil
	}

	err := client.Rename(req.OldPath, req.NewPath)
	if err != nil {
		return RenameResponse{Success: false, Error: err.Error()}, nil
	}

	return RenameResponse{Success: true}, nil
}

type LocalListFilesRequest struct {
	Path string `json:"path"`
}

type LocalListFilesResponse struct {
	Success bool       `json:"success"`
	Files   []FileInfo `json:"files,omitempty"`
	Error   string     `json:"error,omitempty"`
	Path    string     `json:"path,omitempty"`
}

func (m *SFTPManager) ListLocalFiles(req LocalListFilesRequest) (LocalListFilesResponse, error) {
	path := req.Path
	if path == "" {
		path, _ = os.UserHomeDir()
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return LocalListFilesResponse{Success: false, Error: err.Error()}, nil
	}

	files := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		fileType := "file"
		if entry.IsDir() {
			fileType = "directory"
		}

		fullPath := filepath.Join(path, entry.Name())

		info, err := entry.Info()
		if err != nil {
			files = append(files, FileInfo{
				Name: entry.Name(),
				Type: fileType,
				Path: fullPath,
			})
			continue
		}

		files = append(files, FileInfo{
			Name:    entry.Name(),
			Size:    info.Size(),
			Type:    fileType,
			Path:    fullPath,
			ModTime: info.ModTime().Format("2006-01-02 15:04:05"),
			Mode:    info.Mode().String(),
		})
	}

	return LocalListFilesResponse{Success: true, Files: files, Path: path}, nil
}

type ResumeUploadRequest struct {
	SessionID  string `json:"sessionId"`
	LocalPath  string `json:"localPath"`
	RemotePath string `json:"remotePath"`
	Offset     int64  `json:"offset"`
}

type ResumeUploadResponse struct {
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
	SkipBytes  int64  `json:"skipBytes,omitempty"`
	TotalBytes int64  `json:"totalBytes,omitempty"`
}

func (m *SFTPManager) ResumeUpload(req ResumeUploadRequest) (ResumeUploadResponse, error) {
	m.mu.RLock()
	client, ok := m.clients[req.SessionID]
	m.mu.RUnlock()

	if !ok {
		return ResumeUploadResponse{Success: false, Error: "SFTP session not connected"}, nil
	}

	localFile, err := os.Open(req.LocalPath)
	if err != nil {
		return ResumeUploadResponse{Success: false, Error: err.Error()}, nil
	}
	defer localFile.Close()

	localStat, err := localFile.Stat()
	if err != nil {
		return ResumeUploadResponse{Success: false, Error: err.Error()}, nil
	}

	offset := req.Offset
	if offset < 0 {
		remoteStat, err := client.Stat(req.RemotePath)
		if err == nil && remoteStat != nil {
			offset = remoteStat.Size()
		} else {
			offset = 0
		}
	}

	if offset >= localStat.Size() {
		return ResumeUploadResponse{Success: true, SkipBytes: localStat.Size(), TotalBytes: localStat.Size()}, nil
	}

	_, err = localFile.Seek(offset, io.SeekStart)
	if err != nil {
		return ResumeUploadResponse{Success: false, Error: err.Error()}, nil
	}

	remoteFile, err := client.OpenFile(req.RemotePath, os.O_WRONLY|os.O_APPEND)
	if err != nil {
		return ResumeUploadResponse{Success: false, Error: err.Error()}, nil
	}
	defer remoteFile.Close()

	buf := make([]byte, 32768)
	var written int64 = offset
	total := localStat.Size()
	var lastEmit time.Time

	for {
		nr, readErr := localFile.Read(buf)
		if nr > 0 {
			nw, writeErr := remoteFile.Write(buf[:nr])
			if writeErr != nil {
				return ResumeUploadResponse{Success: false, Error: writeErr.Error()}, nil
			}
			written += int64(nw)

			if m.Ctx != nil && total > 0 {
				now := time.Now()
				progress := float64(written) / float64(total) * 100
				if now.Sub(lastEmit) >= 200*time.Millisecond || progress >= 100 || readErr == io.EOF {
					lastEmit = now
					runtime.EventsEmit(m.Ctx, "sftp:upload:progress", map[string]interface{}{
						"sessionId":  req.SessionID,
						"localPath":  req.LocalPath,
						"remotePath": req.RemotePath,
						"progress":   progress,
						"written":    written,
						"total":      total,
						"resumed":    true,
					})
				}
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return ResumeUploadResponse{Success: false, Error: readErr.Error()}, nil
		}
	}

	return ResumeUploadResponse{Success: true, SkipBytes: offset, TotalBytes: total}, nil
}

type ResumeDownloadRequest struct {
	SessionID  string `json:"sessionId"`
	RemotePath string `json:"remotePath"`
	LocalPath  string `json:"localPath"`
	Offset     int64  `json:"offset"`
}

type ResumeDownloadResponse struct {
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
	SkipBytes  int64  `json:"skipBytes,omitempty"`
	TotalBytes int64  `json:"totalBytes,omitempty"`
}

func (m *SFTPManager) ResumeDownload(req ResumeDownloadRequest) (ResumeDownloadResponse, error) {
	m.mu.RLock()
	client, ok := m.clients[req.SessionID]
	m.mu.RUnlock()

	if !ok {
		return ResumeDownloadResponse{Success: false, Error: "SFTP session not connected"}, nil
	}

	remoteFile, err := client.Open(req.RemotePath)
	if err != nil {
		return ResumeDownloadResponse{Success: false, Error: err.Error()}, nil
	}
	defer remoteFile.Close()

	remoteStat, err := remoteFile.Stat()
	if err != nil {
		return ResumeDownloadResponse{Success: false, Error: err.Error()}, nil
	}

	if err := os.MkdirAll(filepath.Dir(req.LocalPath), 0755); err != nil {
		return ResumeDownloadResponse{Success: false, Error: err.Error()}, nil
	}

	offset := req.Offset
	if offset < 0 {
		localStat, err := os.Stat(req.LocalPath)
		if err == nil {
			offset = localStat.Size()
		} else {
			offset = 0
		}
	}

	if offset >= remoteStat.Size() {
		return ResumeDownloadResponse{Success: true, SkipBytes: remoteStat.Size(), TotalBytes: remoteStat.Size()}, nil
	}

	_, err = remoteFile.Seek(offset, io.SeekStart)
	if err != nil {
		return ResumeDownloadResponse{Success: false, Error: err.Error()}, nil
	}

	localFile, err := os.OpenFile(req.LocalPath, os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return ResumeDownloadResponse{Success: false, Error: err.Error()}, nil
	}
	defer localFile.Close()

	_, err = localFile.Seek(0, io.SeekEnd)
	if err != nil {
		return ResumeDownloadResponse{Success: false, Error: err.Error()}, nil
	}

	buf := make([]byte, 32768)
	var written int64 = offset
	total := remoteStat.Size()
	var lastEmit time.Time

	for {
		nr, readErr := remoteFile.Read(buf)
		if nr > 0 {
			nw, writeErr := localFile.Write(buf[:nr])
			if writeErr != nil {
				return ResumeDownloadResponse{Success: false, Error: writeErr.Error()}, nil
			}
			written += int64(nw)

			if m.Ctx != nil && total > 0 {
				now := time.Now()
				progress := float64(written) / float64(total) * 100
				if now.Sub(lastEmit) >= 200*time.Millisecond || progress >= 100 || readErr == io.EOF {
					lastEmit = now
					runtime.EventsEmit(m.Ctx, "sftp:download:progress", map[string]interface{}{
						"sessionId":  req.SessionID,
						"remotePath": req.RemotePath,
						"localPath":  req.LocalPath,
						"progress":   progress,
						"written":    written,
						"total":      total,
						"resumed":    true,
					})
				}
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return ResumeDownloadResponse{Success: false, Error: readErr.Error()}, nil
		}
	}

	return ResumeDownloadResponse{Success: true, SkipBytes: offset, TotalBytes: total}, nil
}

type GetTransferStateRequest struct {
	SessionID  string `json:"sessionId"`
	RemotePath string `json:"remotePath"`
	LocalPath  string `json:"localPath"`
	Direction  string `json:"direction"`
}

type GetTransferStateResponse struct {
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
	LocalSize  int64  `json:"localSize,omitempty"`
	RemoteSize int64  `json:"remoteSize,omitempty"`
	CanResume  bool   `json:"canResume,omitempty"`
}

func (m *SFTPManager) GetTransferState(req GetTransferStateRequest) (GetTransferStateResponse, error) {
	m.mu.RLock()
	client, ok := m.clients[req.SessionID]
	m.mu.RUnlock()

	if !ok {
		return GetTransferStateResponse{Success: false, Error: "SFTP session not connected"}, nil
	}

	var localSize int64 = -1
	var remoteSize int64 = -1

	if localStat, err := os.Stat(req.LocalPath); err == nil {
		localSize = localStat.Size()
	}
	if remoteStat, err := client.Stat(req.RemotePath); err == nil {
		remoteSize = remoteStat.Size()
	}

	canResume := false
	if req.Direction == "upload" && localSize > 0 && remoteSize > 0 && remoteSize < localSize {
		canResume = true
	} else if req.Direction == "download" && remoteSize > 0 && localSize > 0 && localSize < remoteSize {
		canResume = true
	}

	return GetTransferStateResponse{
		Success:    true,
		LocalSize:  localSize,
		RemoteSize: remoteSize,
		CanResume:  canResume,
	}, nil
}

type LocalDeleteRequest struct {
	Path string `json:"path"`
}

type LocalDeleteResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *SFTPManager) LocalDelete(req LocalDeleteRequest) (LocalDeleteResponse, error) {
	err := os.RemoveAll(req.Path)
	if err != nil {
		return LocalDeleteResponse{Success: false, Error: err.Error()}, nil
	}
	return LocalDeleteResponse{Success: true}, nil
}

type LocalMkdirRequest struct {
	Path string `json:"path"`
}

type LocalMkdirResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *SFTPManager) LocalMkdir(req LocalMkdirRequest) (LocalMkdirResponse, error) {
	err := os.MkdirAll(req.Path, 0755)
	if err != nil {
		return LocalMkdirResponse{Success: false, Error: err.Error()}, nil
	}
	return LocalMkdirResponse{Success: true}, nil
}

type LocalRenameRequest struct {
	OldPath string `json:"oldPath"`
	NewPath string `json:"newPath"`
}

type LocalRenameResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *SFTPManager) LocalRename(req LocalRenameRequest) (LocalRenameResponse, error) {
	err := os.Rename(req.OldPath, req.NewPath)
	if err != nil {
		return LocalRenameResponse{Success: false, Error: err.Error()}, nil
	}
	return LocalRenameResponse{Success: true}, nil
}
