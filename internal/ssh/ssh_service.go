package ssh

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"wsShell/internal/store"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	sshcrypto "golang.org/x/crypto/ssh"
)

type SSHService struct {
	mu           sync.RWMutex
	sessions     map[string]*sshSession
	clients      map[string]*sshcrypto.Client
	latencies    map[string]int64
	shellCounter atomic.Int64
	hostKeyRepo  store.HostKeyRepository
	Ctx          context.Context
}

type sshSession struct {
	session  *sshcrypto.Session
	stdin    chan string
	done     chan struct{}
	stopPing chan struct{}
	closed   sync.Once
}

func NewSSHService() *SSHService {
	repo, err := store.NewHostKeyRepository()
	if err != nil {
		log.Printf("Warning: failed to init host key repo: %v", err)
	}
	return &SSHService{
		sessions:    make(map[string]*sshSession),
		clients:     make(map[string]*sshcrypto.Client),
		latencies:   make(map[string]int64),
		hostKeyRepo: repo,
	}
}

type ConnectRequest struct {
	Host           string `json:"host"`
	Port           int    `json:"port"`
	Username       string `json:"username"`
	Password       string `json:"password"`
	PrivateKey     string `json:"privateKey"`
	AuthType       string `json:"authType"`
	ConnectTimeout int    `json:"connectTimeout"`
}

type ConnectResponse struct {
	Success             bool   `json:"success"`
	Error               string `json:"error,omitempty"`
	SessionID           string `json:"sessionId,omitempty"`
	NeedsHostKeyTrust   bool   `json:"needsHostKeyTrust,omitempty"`
	HostKeyFingerprint  string `json:"hostKeyFingerprint,omitempty"`
	HostKeyType         string `json:"hostKeyType,omitempty"`
	HostKeyHost         string `json:"hostKeyHost,omitempty"`
	HostKeyMismatch     bool   `json:"hostKeyMismatch,omitempty"`
	ExpectedFingerprint string `json:"expectedFingerprint,omitempty"`
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

	timeout := 10 * time.Second
	if req.ConnectTimeout > 0 {
		timeout = time.Duration(req.ConnectTimeout) * time.Second
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout+5*time.Second)
	defer cancel()

	hostKeyCallback := s.createHostKeyCallback(req.Host)

	config := &sshcrypto.ClientConfig{
		User:            req.Username,
		HostKeyCallback: hostKeyCallback,
		Timeout:         timeout,
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

	dialer := &net.Dialer{Timeout: config.Timeout}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		var hkErr *hostKeyError
		if errors.As(err, &hkErr) {
			resp := ConnectResponse{Success: false, Error: hkErr.Error()}
			resp.HostKeyHost = hkErr.Host
			resp.HostKeyType = hkErr.KeyType
			resp.HostKeyFingerprint = hkErr.Fingerprint
			if hkErr.IsMismatch {
				resp.HostKeyMismatch = true
				resp.ExpectedFingerprint = hkErr.ExpectedFingerprint
			} else {
				resp.NeedsHostKeyTrust = true
			}
			return resp, nil
		}
		if ctx.Err() == context.Canceled {
			return ConnectResponse{Success: false, Error: "connection cancelled"}, nil
		}
		return ConnectResponse{Success: false, Error: err.Error()}, nil
	}

	sshConn, chans, reqs, err := sshcrypto.NewClientConn(conn, addr, config)
	if err != nil {
		conn.Close()
		var hkErr *hostKeyError
		if errors.As(err, &hkErr) {
			resp := ConnectResponse{Success: false, Error: hkErr.Error()}
			resp.HostKeyHost = hkErr.Host
			resp.HostKeyType = hkErr.KeyType
			resp.HostKeyFingerprint = hkErr.Fingerprint
			if hkErr.IsMismatch {
				resp.HostKeyMismatch = true
				resp.ExpectedFingerprint = hkErr.ExpectedFingerprint
			} else {
				resp.NeedsHostKeyTrust = true
			}
			return resp, nil
		}
		return ConnectResponse{Success: false, Error: err.Error()}, nil
	}

	client := sshcrypto.NewClient(sshConn, chans, reqs)

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
		session:  session,
		stdin:    make(chan string, 256),
		done:     make(chan struct{}),
		stopPing: make(chan struct{}),
	}

	s.mu.Lock()
	s.sessions[sessionID] = ss
	s.clients[sessionID] = client
	s.mu.Unlock()

	go s.startKeepalive(sessionID, client, ss.stopPing)

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdoutPipe.Read(buf)
			if err != nil {
				close(ss.done)
				if s.Ctx != nil {
					runtime.EventsEmit(s.Ctx, "ssh:"+sessionID+":disconnected", map[string]interface{}{
						"sessionId": sessionID,
						"error":     err.Error(),
					})
				}
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
		ss.closeOnce()
		ss.session.Close()
		delete(s.sessions, sessionID)
	}
	if client, ok := s.clients[sessionID]; ok {
		client.Close()
		delete(s.clients, sessionID)
	}
	delete(s.latencies, sessionID)

	log.Printf("SSH disconnected: %s", sessionID)
	return nil
}

func (ss *sshSession) closeOnce() {
	ss.closed.Do(func() {
		close(ss.stdin)
		close(ss.stopPing)
	})
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

func (s *SSHService) GetHostKeyCallback(host string) sshcrypto.HostKeyCallback {
	return s.createHostKeyCallback(host)
}

type ExecCommandRequest struct {
	SessionID string `json:"sessionId"`
	Command   string `json:"command"`
	Timeout   int    `json:"timeout,omitempty"`
}

type ExecCommandResponse struct {
	Success bool   `json:"success"`
	Output  string `json:"output,omitempty"`
	Error   string `json:"error,omitempty"`
}

func (s *SSHService) ExecuteCommand(req ExecCommandRequest) (ExecCommandResponse, error) {
	client := s.resolveClient(req.SessionID)
	if client == nil {
		return ExecCommandResponse{Success: false, Error: "SSH connection not found"}, nil
	}

	timeout := 10
	if req.Timeout > 0 {
		timeout = req.Timeout
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	session, err := client.NewSession()
	if err != nil {
		return ExecCommandResponse{Success: false, Error: err.Error()}, nil
	}
	defer session.Close()

	type result struct {
		output []byte
		err    error
	}
	done := make(chan result, 1)

	go func() {
		out, e := session.CombinedOutput(req.Command)
		done <- result{output: out, err: e}
	}()

	select {
	case r := <-done:
		if r.err != nil {
			return ExecCommandResponse{Success: false, Output: string(r.output), Error: r.err.Error()}, nil
		}
		return ExecCommandResponse{Success: true, Output: string(r.output)}, nil
	case <-ctx.Done():
		return ExecCommandResponse{Success: false, Error: "command timed out"}, nil
	}
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

	seq := s.shellCounter.Add(1)
	sessionID := fmt.Sprintf("%s#%d", req.BaseSessionID, seq)

	ss := &sshSession{
		session: session,
		stdin:   make(chan string, 256),
		done:    make(chan struct{}),
	}

	s.mu.Lock()
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

func (s *SSHService) startKeepalive(sessionID string, client *sshcrypto.Client, stop chan struct{}) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			start := time.Now()
			_, _, err := client.SendRequest("keepalive@wsshell", true, nil)
			elapsed := time.Since(start).Milliseconds()

			s.mu.Lock()
			if err != nil {
				s.latencies[sessionID] = -1
			} else {
				s.latencies[sessionID] = elapsed
			}
			s.mu.Unlock()

			if s.Ctx != nil {
				if err != nil {
					runtime.EventsEmit(s.Ctx, "ssh:"+sessionID+":keepalive:failed", map[string]interface{}{
						"sessionId": sessionID,
						"error":     err.Error(),
					})
				} else {
					runtime.EventsEmit(s.Ctx, "ssh:"+sessionID+":keepalive", map[string]interface{}{
						"sessionId": sessionID,
						"latency":   elapsed,
					})
				}
			}
		}
	}
}

type GetLatencyRequest struct {
	SessionID string `json:"sessionId"`
}

type GetLatencyResponse struct {
	Success bool  `json:"success"`
	Latency int64 `json:"latency"`
}

func (s *SSHService) GetLatency(req GetLatencyRequest) (GetLatencyResponse, error) {
	s.mu.RLock()
	latency, ok := s.latencies[req.SessionID]
	s.mu.RUnlock()

	if !ok {
		return GetLatencyResponse{Success: false, Latency: 0}, nil
	}

	return GetLatencyResponse{Success: true, Latency: latency}, nil
}

type hostKeyError struct {
	Host                string
	KeyType             string
	Fingerprint         string
	IsMismatch          bool
	ExpectedFingerprint string
}

func (e *hostKeyError) Error() string {
	if e.IsMismatch {
		return fmt.Sprintf("HOST KEY MISMATCH for %s!\nExpected: %s\nGot: %s\nPossible MITM attack!",
			e.Host, e.ExpectedFingerprint, e.Fingerprint)
	}
	return fmt.Sprintf("new host key for %s (%s): %s", e.Host, e.KeyType, e.Fingerprint)
}

func (s *SSHService) createHostKeyCallback(host string) sshcrypto.HostKeyCallback {
	return func(hostname string, remote net.Addr, key sshcrypto.PublicKey) error {
		keyType := key.Type()
		fingerprint := store.FingerprintSHA256(key.Marshal())

		if s.hostKeyRepo == nil {
			log.Printf("Host key check: repo not available, allowing")
			return nil
		}

		knownKeys, err := s.hostKeyRepo.GetByHost(hostname)
		if err != nil {
			log.Printf("Host key check: DB error, allowing: %v", err)
			return nil
		}

		for _, known := range knownKeys {
			if known.KeyType == keyType {
				if known.Fingerprint == fingerprint {
					return nil
				}
				log.Printf("SECURITY: HOST KEY MISMATCH for %s! Expected: %s Got: %s",
					hostname, known.Fingerprint, fingerprint)
				return &hostKeyError{
					Host:                hostname,
					KeyType:             keyType,
					Fingerprint:         fingerprint,
					IsMismatch:          true,
					ExpectedFingerprint: known.Fingerprint,
				}
			}
		}

		return &hostKeyError{
			Host:        hostname,
			KeyType:     keyType,
			Fingerprint: fingerprint,
		}
	}
}

type TrustHostKeyRequest struct {
	Host        string `json:"host"`
	KeyType     string `json:"keyType"`
	Fingerprint string `json:"fingerprint"`
}

type TrustHostKeyResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (s *SSHService) TrustHostKey(req TrustHostKeyRequest) (TrustHostKeyResponse, error) {
	repo, err := store.NewHostKeyRepository()
	if err != nil {
		return TrustHostKeyResponse{Success: false, Error: err.Error()}, nil
	}
	if err := repo.Save(store.HostKeyRow{
		Host:        req.Host,
		KeyType:     req.KeyType,
		Fingerprint: req.Fingerprint,
	}); err != nil {
		return TrustHostKeyResponse{Success: false, Error: err.Error()}, nil
	}
	log.Printf("Host key trusted and saved for %s (%s): %s", req.Host, req.KeyType, req.Fingerprint)
	return TrustHostKeyResponse{Success: true}, nil
}
