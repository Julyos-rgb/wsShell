package sftp

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	sshcrypto "golang.org/x/crypto/ssh"
	"github.com/pkg/sftp"
)

type SFTPManager struct {
	mu         sync.RWMutex
	clients    map[string]*sftp.Client
	sshClients map[string]*sshcrypto.Client
	ctx        context.Context
}

func NewSFTPManager() *SFTPManager {
	return &SFTPManager{
		clients:    make(map[string]*sftp.Client),
		sshClients: make(map[string]*sshcrypto.Client),
	}
}

func (m *SFTPManager) SetContext(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ctx = ctx
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

	config := &sshcrypto.ClientConfig{
		User:            req.Username,
		HostKeyCallback: sshcrypto.InsecureIgnoreHostKey(),
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
		if sc, ok := m.sshClients[sessionID]; ok {
			sc.Close()
		}
	}
	m.clients[sessionID] = sftpClient
	m.sshClients[sessionID] = sshClient
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
	if sc, ok := m.sshClients[sessionID]; ok {
		sc.Close()
		delete(m.sshClients, sessionID)
	}
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

	for {
		nr, readErr := localFile.Read(buf)
		if nr > 0 {
			nw, writeErr := remoteFile.Write(buf[:nr])
			if writeErr != nil {
				return UploadResponse{Success: false, Error: writeErr.Error()}, nil
			}
			written += int64(nw)

			if m.ctx != nil && total > 0 {
				progress := float64(written) / float64(total) * 100
				runtime.EventsEmit(m.ctx, "sftp:upload:progress", map[string]interface{}{
					"sessionId":  req.SessionID,
					"localPath":  req.LocalPath,
					"remotePath": req.RemotePath,
					"progress":   progress,
					"written":    written,
					"total":      total,
				})
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

	for {
		nr, readErr := remoteFile.Read(buf)
		if nr > 0 {
			nw, writeErr := localFile.Write(buf[:nr])
			if writeErr != nil {
				return DownloadResponse{Success: false, Error: writeErr.Error()}, nil
			}
			written += int64(nw)

			if m.ctx != nil && total > 0 {
				progress := float64(written) / float64(total) * 100
				runtime.EventsEmit(m.ctx, "sftp:download:progress", map[string]interface{}{
					"sessionId":  req.SessionID,
					"remotePath": req.RemotePath,
					"localPath":  req.LocalPath,
					"progress":   progress,
					"written":    written,
					"total":      total,
				})
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

		info, err := entry.Info()
		if err != nil {
			continue
		}

		fullPath := filepath.Join(path, entry.Name())

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
