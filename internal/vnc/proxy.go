package vnc

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	sshcrypto "golang.org/x/crypto/ssh"
)

type SSHClientProvider interface {
	GetClient(sessionID string) *sshcrypto.Client
}

type Proxy struct {
	mu       sync.RWMutex
	servers  map[string]*proxyServer
	sshProxy SSHClientProvider
	Ctx      interface{}
}

type proxyServer struct {
	server    *http.Server
	listener  net.Listener
	port      int
	target    string
	password  string
	done      chan struct{}
	tunnel    bool
	sshClient *sshcrypto.Client

	connectOnce sync.Once
	connected   bool
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  32 * 1024,
	WriteBufferSize: 32 * 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func NewProxy() *Proxy {
	return &Proxy{
		servers: make(map[string]*proxyServer),
	}
}

func (p *Proxy) SetSSHProvider(provider SSHClientProvider) {
	p.sshProxy = provider
}

type StartProxyRequest struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Password   string `json:"password"`
	Tunnel     bool   `json:"tunnel"`
	SSessionID string `json:"sshSessionId"`
}

type StartProxyResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
	WsURL   string `json:"wsUrl,omitempty"`
}

type StopProxyRequest struct {
	SessionID string `json:"sessionId"`
}

type StopProxyResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type vncErrorMessage struct {
	Type  string `json:"type"`
	Error string `json:"error"`
}

func (p *Proxy) StartProxy(req StartProxyRequest) (StartProxyResponse, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	sessionID := fmt.Sprintf("%s:%d", req.Host, req.Port)
	if ps, exists := p.servers[sessionID]; exists {
		return StartProxyResponse{
			Success: true,
			WsURL:   fmt.Sprintf("ws://127.0.0.1:%d/websockify", ps.port),
		}, nil
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return StartProxyResponse{Success: false, Error: err.Error()}, nil
	}

	localPort := listener.Addr().(*net.TCPAddr).Port
	target := fmt.Sprintf("%s:%d", req.Host, req.Port)

	mux := http.NewServeMux()
	srv := &http.Server{Handler: mux}

	ps := &proxyServer{
		server:   srv,
		listener: listener,
		port:     localPort,
		target:   target,
		password: req.Password,
		done:     make(chan struct{}),
		tunnel:   req.Tunnel,
	}

	if req.Tunnel {
		if p.sshProxy == nil {
			listener.Close()
			return StartProxyResponse{Success: false, Error: "SSH service not available"}, nil
		}
		sshClient := p.sshProxy.GetClient(req.SSessionID)
		if sshClient == nil {
			listener.Close()
			return StartProxyResponse{Success: false, Error: "SSH session not found, please connect first"}, nil
		}
		ps.sshClient = sshClient
	}

	mux.HandleFunc("/websockify", func(w http.ResponseWriter, r *http.Request) {
		ps.handleWebSocket(w, r)
	})

	p.servers[sessionID] = ps

	go func() {
		if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("VNC proxy server error: %v", err)
		}
	}()

	wsURL := fmt.Sprintf("ws://127.0.0.1:%d/websockify", localPort)
	log.Printf("VNC proxy started: %s -> %s (tunnel=%v, ws=%s)", sessionID, target, req.Tunnel, wsURL)

	return StartProxyResponse{
		Success: true,
		WsURL:   wsURL,
	}, nil
}

func (p *Proxy) StopProxy(req StopProxyRequest) (StopProxyResponse, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	ps, exists := p.servers[req.SessionID]
	if !exists {
		return StopProxyResponse{Success: true}, nil
	}

	close(ps.done)
	ps.server.Close()

	delete(p.servers, req.SessionID)
	log.Printf("VNC proxy stopped: %s", req.SessionID)

	return StopProxyResponse{Success: true}, nil
}

func (ps *proxyServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	wsConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("VNC WS upgrade error: %v", err)
		return
	}
	defer wsConn.Close()

	var conn net.Conn
	dialTimeout := 5 * time.Second

	if ps.tunnel && ps.sshClient != nil {
		conn, err = ps.dialSSHWithTimeout(dialTimeout)
	} else {
		conn, err = net.DialTimeout("tcp", ps.target, dialTimeout)
	}
	if err != nil {
		log.Printf("VNC dial error: %v", err)
		errMsg := fmt.Sprintf("无法连接到 VNC 服务器 %s: %v", ps.target, err)
		if ps.tunnel {
			errMsg = fmt.Sprintf("无法通过 SSH 隧道连接到 VNC 服务器 %s，请确认远程服务器上已启动 VNC 服务 (端口 %d)", ps.target, ps.port)
		}
		sendVNCError(wsConn, errMsg)
		time.Sleep(100 * time.Millisecond)
		return
	}
	defer conn.Close()

	var once sync.Once
	done := make(chan struct{})
	closeDone := func() { once.Do(func() { close(done) }) }

	go func() {
		defer closeDone()
		buf := make([]byte, 32*1024)
		for {
			select {
			case <-ps.done:
				return
			default:
			}
			n, err := conn.Read(buf)
			if err != nil {
				return
			}
			if n > 0 {
				if err := wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
					return
				}
			}
		}
	}()

	go func() {
		defer closeDone()
		for {
			select {
			case <-ps.done:
				return
			default:
			}
			_, reader, err := wsConn.NextReader()
			if err != nil {
				return
			}
			if _, err := io.Copy(conn, reader); err != nil {
				return
			}
		}
	}()

	<-done
	log.Printf("VNC connection closed: %s", ps.target)
}

func (ps *proxyServer) dialSSHWithTimeout(timeout time.Duration) (net.Conn, error) {
	type result struct {
		conn net.Conn
		err  error
	}
	ch := make(chan result, 1)

	go func() {
		conn, err := ps.sshClient.Dial("tcp", ps.target)
		ch <- result{conn, err}
	}()

	select {
	case res := <-ch:
		return res.conn, res.err
	case <-time.After(timeout):
		return nil, fmt.Errorf("connection timeout after %v", timeout)
	}
}

func sendVNCError(wsConn *websocket.Conn, message string) {
	errData, _ := json.Marshal(vncErrorMessage{
		Type:  "error",
		Error: message,
	})
	wsConn.WriteMessage(websocket.TextMessage, errData)
}
