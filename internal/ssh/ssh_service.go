package ssh

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	sshcrypto "golang.org/x/crypto/ssh"
)

type SSHService struct {
	mu       sync.RWMutex
	sessions map[string]*sshSession
	clients  map[string]*sshcrypto.Client
	Ctx      context.Context
}

type sshSession struct {
	session *sshcrypto.Session
	stdin   chan string
	done    chan struct{}
}

func NewSSHService() *SSHService {
	return &SSHService{
		sessions: make(map[string]*sshSession),
		clients:  make(map[string]*sshcrypto.Client),
	}
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

type CreateSessionRequest struct {
	SessionID string `json:"sessionId"`
}

type CreateSessionResponse struct {
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
	NewSession string `json:"newSession,omitempty"`
}

func (s *SSHService) Connect(req ConnectRequest) (ConnectResponse, error) {
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
			return ConnectResponse{Success: false, Error: fmt.Sprintf("parse private key failed: %v", err)}, nil
		}
		config.Auth = []sshcrypto.AuthMethod{sshcrypto.PublicKeys(signer)}
	} else {
		config.Auth = []sshcrypto.AuthMethod{sshcrypto.Password(req.Password)}
	}

	addr := fmt.Sprintf("%s:%d", req.Host, req.Port)
	client, err := sshcrypto.Dial("tcp", addr, config)
	if err != nil {
		return ConnectResponse{Success: false, Error: err.Error()}, nil
	}

	sessionID := fmt.Sprintf("%s@%s:%d", req.Username, req.Host, req.Port)

	session, err := client.NewSession()
	if err != nil {
		client.Close()
		return ConnectResponse{Success: false, Error: fmt.Sprintf("create session failed: %v", err)}, nil
	}

	stdinPipe, err := session.StdinPipe()
	if err != nil {
		session.Close()
		client.Close()
		return ConnectResponse{Success: false, Error: err.Error()}, nil
	}

	stdoutPipe, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		client.Close()
		return ConnectResponse{Success: false, Error: err.Error()}, nil
	}

	stderrPipe, err := session.StderrPipe()
	if err != nil {
		session.Close()
		client.Close()
		return ConnectResponse{Success: false, Error: err.Error()}, nil
	}

	modes := sshcrypto.TerminalModes{
		sshcrypto.ECHO:          1,
		sshcrypto.TTY_OP_ISPEED: 14400,
		sshcrypto.TTY_OP_OSPEED: 14400,
	}

	if err := session.RequestPty("xterm-256color", 40, 120, modes); err != nil {
		session.Close()
		client.Close()
		return ConnectResponse{Success: false, Error: fmt.Sprintf("request PTY failed: %v", err)}, nil
	}

	if err := session.Shell(); err != nil {
		session.Close()
		client.Close()
		return ConnectResponse{Success: false, Error: fmt.Sprintf("start shell failed: %v", err)}, nil
	}

	ss := &sshSession{
		session: session,
		stdin:   make(chan string, 256),
		done:    make(chan struct{}),
	}

	s.mu.Lock()
	s.sessions[sessionID] = ss
	s.clients[sessionID] = client
	s.mu.Unlock()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdoutPipe.Read(buf)
			if err != nil {
				close(ss.done)
				return
			}
			if n > 0 {
				data := string(buf[:n])
				if s.Ctx != nil {
					runtime.EventsEmit(s.Ctx, "ssh:"+sessionID+":stdout", data)
				}
			}
		}
	}()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stderrPipe.Read(buf)
			if err != nil {
				return
			}
			if n > 0 {
				data := string(buf[:n])
				if s.Ctx != nil {
					runtime.EventsEmit(s.Ctx, "ssh:"+sessionID+":stderr", data)
				}
			}
		}
	}()

	go func() {
		for {
			select {
			case <-ss.done:
				return
			case data, ok := <-ss.stdin:
				if !ok {
					return
				}
				if _, err := stdinPipe.Write([]byte(data)); err != nil {
					log.Printf("stdin write error: %v", err)
					return
				}
			}
		}
	}()

	log.Printf("SSH connected: %s", sessionID)

	return ConnectResponse{
		Success:   true,
		SessionID: sessionID,
	}, nil
}

type WriteRequest struct {
	SessionID string `json:"sessionId"`
	Data      string `json:"data"`
}

type WriteResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (s *SSHService) WriteToSession(req WriteRequest) (WriteResponse, error) {
	s.mu.RLock()
	ss, ok := s.sessions[req.SessionID]
	s.mu.RUnlock()

	if !ok {
		return WriteResponse{Success: false, Error: "session not found"}, nil
	}

	select {
	case ss.stdin <- req.Data:
		return WriteResponse{Success: true}, nil
	default:
		return WriteResponse{Success: false, Error: "stdin buffer full"}, nil
	}
}

type ResizeRequest struct {
	SessionID string `json:"sessionId"`
	Rows      int    `json:"rows"`
	Cols      int    `json:"cols"`
}

type ResizeResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (s *SSHService) ResizeTerminal(req ResizeRequest) (ResizeResponse, error) {
	s.mu.RLock()
	ss, ok := s.sessions[req.SessionID]
	s.mu.RUnlock()

	if !ok {
		return ResizeResponse{Success: false, Error: "session not found"}, nil
	}

	if err := ss.session.WindowChange(req.Rows, req.Cols); err != nil {
		return ResizeResponse{Success: false, Error: err.Error()}, nil
	}

	return ResizeResponse{Success: true}, nil
}

func (s *SSHService) Disconnect(sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ss, ok := s.sessions[sessionID]; ok {
		close(ss.stdin)
		ss.session.Close()
		delete(s.sessions, sessionID)
	}
	if client, ok := s.clients[sessionID]; ok {
		client.Close()
		delete(s.clients, sessionID)
	}

	log.Printf("SSH disconnected: %s", sessionID)
	return nil
}

type IsConnectedResponse struct {
	Connected bool `json:"connected"`
}

func (s *SSHService) IsConnected(sessionID string) (IsConnectedResponse, error) {
	s.mu.RLock()
	_, ok := s.sessions[sessionID]
	s.mu.RUnlock()
	return IsConnectedResponse{Connected: ok}, nil
}

func (s *SSHService) GetClient(sessionID string) *sshcrypto.Client {
	return s.resolveClient(sessionID)
}

type CreateShellRequest struct {
	BaseSessionID string `json:"baseSessionId"`
}

type CreateShellResponse struct {
	Success   bool   `json:"success"`
	Error     string `json:"error,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
}

func (s *SSHService) resolveClient(sessionID string) *sshcrypto.Client {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if client, ok := s.clients[sessionID]; ok {
		return client
	}
	if idx := strings.LastIndex(sessionID, "#"); idx > 0 && idx < len(sessionID)-1 {
		baseID := sessionID[:idx]
		if client, ok := s.clients[baseID]; ok {
			return client
		}
	}
	return nil
}

func (s *SSHService) CreateShell(req CreateShellRequest) (CreateShellResponse, error) {
	client := s.resolveClient(req.BaseSessionID)
	if client == nil {
		return CreateShellResponse{Success: false, Error: "base connection not found"}, nil
	}

	session, err := client.NewSession()
	if err != nil {
		return CreateShellResponse{Success: false, Error: fmt.Sprintf("create session failed: %v", err)}, nil
	}

	stdinPipe, err := session.StdinPipe()
	if err != nil {
		session.Close()
		return CreateShellResponse{Success: false, Error: err.Error()}, nil
	}

	stdoutPipe, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		return CreateShellResponse{Success: false, Error: err.Error()}, nil
	}

	stderrPipe, err := session.StderrPipe()
	if err != nil {
		session.Close()
		return CreateShellResponse{Success: false, Error: err.Error()}, nil
	}

	modes := sshcrypto.TerminalModes{
		sshcrypto.ECHO:          1,
		sshcrypto.TTY_OP_ISPEED: 14400,
		sshcrypto.TTY_OP_OSPEED: 14400,
	}

	if err := session.RequestPty("xterm-256color", 40, 120, modes); err != nil {
		session.Close()
		return CreateShellResponse{Success: false, Error: fmt.Sprintf("request PTY failed: %v", err)}, nil
	}

	if err := session.Shell(); err != nil {
		session.Close()
		return CreateShellResponse{Success: false, Error: fmt.Sprintf("start shell failed: %v", err)}, nil
	}

	s.mu.Lock()
	sessionID := fmt.Sprintf("%s#%d", req.BaseSessionID, len(s.sessions)+1)
	ss := &sshSession{
		session: session,
		stdin:   make(chan string, 256),
		done:    make(chan struct{}),
	}
	s.sessions[sessionID] = ss
	s.mu.Unlock()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdoutPipe.Read(buf)
			if err != nil {
				close(ss.done)
				return
			}
			if n > 0 {
				data := string(buf[:n])
				if s.Ctx != nil {
					runtime.EventsEmit(s.Ctx, "ssh:"+sessionID+":stdout", data)
				}
			}
		}
	}()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stderrPipe.Read(buf)
			if err != nil {
				return
			}
			if n > 0 {
				data := string(buf[:n])
				if s.Ctx != nil {
					runtime.EventsEmit(s.Ctx, "ssh:"+sessionID+":stderr", data)
				}
			}
		}
	}()

	go func() {
		for {
			select {
			case <-ss.done:
				return
			case data, ok := <-ss.stdin:
				if !ok {
					return
				}
				if _, err := stdinPipe.Write([]byte(data)); err != nil {
					log.Printf("stdin write error: %v", err)
					return
				}
			}
		}
	}()

	log.Printf("SSH shell created: %s", sessionID)

	return CreateShellResponse{
		Success:   true,
		SessionID: sessionID,
	}, nil
}
