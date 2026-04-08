package monitor

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	sshcrypto "golang.org/x/crypto/ssh"
)

type NetworkService struct {
	mu        sync.RWMutex
	netCancel map[string]func()
	Ctx       context.Context
	getClient func(string) *sshcrypto.Client
}

func NewNetworkService(getClient func(string) *sshcrypto.Client) *NetworkService {
	return &NetworkService{
		netCancel: make(map[string]func()),
		getClient: getClient,
	}
}

func (n *NetworkService) execCommand(sessionID string, cmd string) (string, error) {
	client := n.getClient(sessionID)
	if client == nil {
		return "", fmt.Errorf("SSH connection not found")
	}

	session, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	out, err := session.CombinedOutput(cmd)
	return strings.TrimSpace(string(out)), err
}

type NetInterface struct {
	Name      string `json:"name"`
	RxBytes   int64  `json:"rxBytes"`
	TxBytes   int64  `json:"txBytes"`
	RxPackets int64  `json:"rxPackets"`
	TxPackets int64  `json:"txPackets"`
}

type NetTraffic struct {
	Interfaces []NetInterface `json:"interfaces"`
	Timestamp  int64          `json:"timestamp"`
}

type GetNetTrafficRequest struct {
	SessionID string `json:"sessionId"`
}

type GetNetTrafficResponse struct {
	Success bool       `json:"success"`
	Traffic NetTraffic `json:"traffic,omitempty"`
	Error   string     `json:"error,omitempty"`
}

func (n *NetworkService) GetNetTraffic(req GetNetTrafficRequest) (GetNetTrafficResponse, error) {
	out, err := n.execCommand(req.SessionID, "cat /proc/net/dev")
	if err != nil {
		return GetNetTrafficResponse{Success: false, Error: err.Error()}, nil
	}

	var interfaces []NetInterface
	lines := strings.Split(out, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.Contains(line, ":") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		name := strings.TrimSpace(parts[0])
		if name == "lo" {
			continue
		}
		fields := strings.Fields(strings.TrimSpace(parts[1]))
		if len(fields) < 10 {
			continue
		}
		rxBytes, _ := strconv.ParseInt(fields[0], 10, 64)
		rxPackets, _ := strconv.ParseInt(fields[1], 10, 64)
		txBytes, _ := strconv.ParseInt(fields[8], 10, 64)
		txPackets, _ := strconv.ParseInt(fields[9], 10, 64)

		interfaces = append(interfaces, NetInterface{
			Name:      name,
			RxBytes:   rxBytes,
			TxBytes:   txBytes,
			RxPackets: rxPackets,
			TxPackets: txPackets,
		})
	}

	return GetNetTrafficResponse{
		Success: true,
		Traffic: NetTraffic{
			Interfaces: interfaces,
			Timestamp:  time.Now().UnixMilli(),
		},
	}, nil
}

type NetConnection struct {
	Proto     string `json:"proto"`
	LocalAddr string `json:"localAddr"`
	Foreign   string `json:"foreign"`
	State     string `json:"state"`
	PID       int    `json:"pid"`
}

type GetConnectionsRequest struct {
	SessionID string `json:"sessionId"`
}

type GetConnectionsResponse struct {
	Success     bool           `json:"success"`
	Connections []NetConnection `json:"connections,omitempty"`
	Error       string         `json:"error,omitempty"`
}

func (n *NetworkService) GetConnections(req GetConnectionsRequest) (GetConnectionsResponse, error) {
	out, err := n.execCommand(req.SessionID, "ss -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null")
	if err != nil {
		return GetConnectionsResponse{Success: false, Error: err.Error()}, nil
	}

	var connections []NetConnection
	lines := strings.Split(out, "\n")
	for i, line := range lines {
		if i == 0 {
			continue
		}
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}

		proto := fields[0]
		state := ""
		localAddr := fields[4]
		foreign := ""
		pid := 0

		if len(fields) >= 5 {
			if strings.Contains(proto, "LISTEN") || (len(fields) > 5 && strings.Contains(fields[5], "LISTEN")) {
				state = "LISTEN"
			}
		}

		if len(fields) >= 6 {
			foreign = fields[5]
		}

		for _, f := range fields {
			if strings.Contains(f, "pid=") {
				pidStr := strings.TrimPrefix(f, "pid=")
				pidStr = strings.TrimSuffix(pidStr, ",")
				pid, _ = strconv.Atoi(pidStr)
			}
		}

		connections = append(connections, NetConnection{
			Proto:     proto,
			LocalAddr: localAddr,
			Foreign:   foreign,
			State:     state,
			PID:       pid,
		})
	}

	return GetConnectionsResponse{Success: true, Connections: connections}, nil
}

type PingRequest struct {
	SessionID string `json:"sessionId"`
	Host      string `json:"host"`
	Count     int    `json:"count,omitempty"`
}

type PingResponse struct {
	Success bool     `json:"success"`
	Output  string   `json:"output,omitempty"`
	Stats   PingStat `json:"stats,omitempty"`
	Error   string   `json:"error,omitempty"`
}

type PingStat struct {
	Min    float64 `json:"min"`
	Avg    float64 `json:"avg"`
	Max    float64 `json:"max"`
	Lost   float64 `json:"lost"`
	Count  int     `json:"count"`
}

func (n *NetworkService) Ping(req PingRequest) (PingResponse, error) {
	count := 4
	if req.Count > 0 {
		count = req.Count
	}
	cmd := fmt.Sprintf("ping -c %d -W 5 %s 2>&1", count, req.Host)
	out, err := n.execCommand(req.SessionID, cmd)

	var stats PingStat
	stats.Count = count

	if err == nil && out != "" {
		if idx := strings.LastIndex(out, "min/avg/max/"); idx > 0 {
			statLine := out[idx:]
			fields := strings.Fields(statLine)
			if len(fields) >= 4 {
				timings := strings.Split(fields[3], "/")
				if len(timings) >= 3 {
					stats.Min, _ = strconv.ParseFloat(timings[0], 64)
					stats.Avg, _ = strconv.ParseFloat(timings[1], 64)
					stats.Max, _ = strconv.ParseFloat(timings[2], 64)
				}
			}
		}
		if idx := strings.Index(out, "packet loss"); idx > 0 {
			before := out[:idx]
			if pctIdx := strings.LastIndex(before, "%"); pctIdx > 0 {
				numStart := pctIdx - 1
				for numStart >= 0 && (before[numStart] >= '0' && before[numStart] <= '9' || before[numStart] == '.') {
					numStart--
				}
				stats.Lost, _ = strconv.ParseFloat(before[numStart+1:pctIdx], 64)
			}
		}
	}

	return PingResponse{Success: true, Output: out, Stats: stats}, nil
}

type TracerouteRequest struct {
	SessionID string `json:"sessionId"`
	Host      string `json:"host"`
}

type TracerouteResponse struct {
	Success bool   `json:"success"`
	Output  string `json:"output,omitempty"`
	Error   string `json:"error,omitempty"`
}

func (n *NetworkService) Traceroute(req TracerouteRequest) (TracerouteResponse, error) {
	cmd := fmt.Sprintf("traceroute -m 20 -w 3 %s 2>&1 || tracepath -m 20 %s 2>&1", req.Host, req.Host)
	out, err := n.execCommand(req.SessionID, cmd)
	if err != nil {
		return TracerouteResponse{Success: false, Output: out, Error: err.Error()}, nil
	}
	return TracerouteResponse{Success: true, Output: out}, nil
}

type StartNetMonitorRequest struct {
	SessionID string `json:"sessionId"`
	Interval  int    `json:"interval,omitempty"`
}

type StartNetMonitorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (n *NetworkService) StartNetMonitor(req StartNetMonitorRequest) (StartNetMonitorResponse, error) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if _, ok := n.netCancel[req.SessionID]; ok {
		return StartNetMonitorResponse{Success: true}, nil
	}

	interval := 2
	if req.Interval > 0 {
		interval = req.Interval
	}

	var prevTraffic *NetTraffic

	done := make(chan struct{})
	n.netCancel[req.SessionID] = func() { close(done) }

	go func() {
		ticker := time.NewTicker(time.Duration(interval) * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				resp, _ := n.GetNetTraffic(GetNetTrafficRequest{SessionID: req.SessionID})
				if !resp.Success {
					continue
				}

				if prevTraffic != nil && n.Ctx != nil {
					dt := float64(resp.Traffic.Timestamp-prevTraffic.Timestamp) / 1000.0
					if dt > 0 {
						for _, iface := range resp.Traffic.Interfaces {
							for _, prev := range prevTraffic.Interfaces {
								if iface.Name == prev.Name {
									rxSpeed := float64(iface.RxBytes-prev.RxBytes) / dt
									txSpeed := float64(iface.TxBytes-prev.TxBytes) / dt
									runtime.EventsEmit(n.Ctx, "network:"+req.SessionID+":traffic", map[string]interface{}{
										"sessionId": req.SessionID,
										"interface": iface.Name,
										"rxSpeed":   rxSpeed,
										"txSpeed":   txSpeed,
										"rxBytes":   iface.RxBytes,
										"txBytes":   iface.TxBytes,
									})
								}
							}
						}
					}
				}
				prevTraffic = &resp.Traffic
			}
		}
	}()

	return StartNetMonitorResponse{Success: true}, nil
}

type StopNetMonitorRequest struct {
	SessionID string `json:"sessionId"`
}

type StopNetMonitorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (n *NetworkService) StopNetMonitor(req StopNetMonitorRequest) (StopNetMonitorResponse, error) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if cancel, ok := n.netCancel[req.SessionID]; ok {
		cancel()
		delete(n.netCancel, req.SessionID)
	}
	return StopNetMonitorResponse{Success: true}, nil
}
