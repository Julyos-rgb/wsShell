package monitor

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	sshcrypto "golang.org/x/crypto/ssh"
)

type MonitorService struct {
	mu        sync.RWMutex
	cancelFns map[string]context.CancelFunc
	Ctx       context.Context
	getClient func(string) *sshcrypto.Client
}

func NewMonitorService(getClient func(string) *sshcrypto.Client) *MonitorService {
	return &MonitorService{
		cancelFns: make(map[string]context.CancelFunc),
		getClient: getClient,
	}
}

type SystemInfo struct {
	Hostname   string `json:"hostname"`
	OS         string `json:"os"`
	Kernel     string `json:"kernel"`
	Arch       string `json:"arch"`
	Uptime     string `json:"uptime"`
	Users      int    `json:"users"`
	CPUCores   int    `json:"cpuCores"`
	CPUModel   string `json:"cpuModel"`
	TotalMemMB int64  `json:"totalMemMB"`
}

type ResourceUsage struct {
	CPUPercent  float64 `json:"cpuPercent"`
	MemPercent  float64 `json:"memPercent"`
	MemUsedMB   int64   `json:"memUsedMB"`
	MemTotalMB  int64   `json:"memTotalMB"`
	DiskPercent float64 `json:"diskPercent"`
	DiskUsedGB  float64 `json:"diskUsedGB"`
	DiskTotalGB float64 `json:"diskTotalGB"`
	Load1       float64 `json:"load1"`
	Load5       float64 `json:"load5"`
	Load15      float64 `json:"load15"`
}

type ProcessInfo struct {
	PID     int     `json:"pid"`
	User    string  `json:"user"`
	CPU     float64 `json:"cpu"`
	Mem     float64 `json:"mem"`
	VSZ     int64   `json:"vsz"`
	RSS     int64   `json:"rss"`
	Command string  `json:"command"`
}

type DockerContainer struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Image    string `json:"image"`
	Status   string `json:"status"`
	Ports    string `json:"ports"`
	State    string `json:"state"`
	CPUPct   string `json:"cpuPct"`
	MemUsage string `json:"memUsage"`
	MemPct   string `json:"memPct"`
	NetIO    string `json:"netIO"`
	BlockIO  string `json:"blockIO"`
}

type StartMonitorRequest struct {
	SessionID string `json:"sessionId"`
	Interval  int    `json:"interval,omitempty"`
}

type StartMonitorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type StopMonitorRequest struct {
	SessionID string `json:"sessionId"`
}

type StopMonitorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *MonitorService) execCommand(sessionID string, cmd string) (string, error) {
	client := m.getClient(sessionID)
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

func (m *MonitorService) execScript(sessionID string, script string) (string, error) {
	client := m.getClient(sessionID)
	if client == nil {
		return "", fmt.Errorf("SSH connection not found")
	}

	session, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	out, err := session.CombinedOutput(script)
	return strings.TrimSpace(string(out)), err
}

func (m *MonitorService) GetSystemInfo(sessionID string) (SystemInfo, error) {
	var info SystemInfo

	script := `echo "HOSTNAME:$(hostname)"
echo "ARCH:$(uname -m)"
echo "KERNEL:$(uname -r)"
echo "OS:$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"'"' -f2)"
echo "UPTIME:$(uptime -p 2>/dev/null || uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}')"
echo "CPUCORES:$(nproc)"
echo "CPUMODEL:$(cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d':' -f2 | xargs)"
echo "MEMTOTAL:$(grep MemTotal /proc/meminfo | awk '{print $2}')"
echo "USERS:$(who | wc -l)"`

	out, err := m.execScript(sessionID, script)
	if err != nil {
		return info, err
	}

	lines := strings.Split(out, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if idx := strings.Index(line, ":"); idx > 0 {
			key := line[:idx]
			val := line[idx+1:]
			switch key {
			case "HOSTNAME":
				info.Hostname = val
			case "ARCH":
				info.Arch = val
			case "KERNEL":
				info.Kernel = val
			case "OS":
				info.OS = val
			case "UPTIME":
				info.Uptime = strings.Replace(val, "up ", "", 1)
			case "CPUCORES":
				info.CPUCores, _ = strconv.Atoi(val)
			case "CPUMODEL":
				info.CPUModel = val
			case "MEMTOTAL":
				v, _ := strconv.ParseInt(val, 10, 64)
				info.TotalMemMB = v / 1024
			case "USERS":
				info.Users, _ = strconv.Atoi(val)
			}
		}
	}

	return info, nil
}

func (m *MonitorService) GetResourceUsage(sessionID string) (ResourceUsage, error) {
	var usage ResourceUsage

	script := `echo "CPU:$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}')"
echo "MEM:$(free -m | grep Mem)"
echo "DISK:$(df -h / | tail -1 | awk '{print $3,$4,$5}')"
echo "LOAD:$(cat /proc/loadavg)"`

	out, err := m.execScript(sessionID, script)
	if err != nil {
		return usage, err
	}

	lines := strings.Split(out, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if idx := strings.Index(line, ":"); idx > 0 {
			key := line[:idx]
			val := strings.TrimSpace(line[idx+1:])
			switch key {
			case "CPU":
				usage.CPUPercent, _ = strconv.ParseFloat(val, 64)
			case "MEM":
				fields := strings.Fields(val)
				if len(fields) >= 3 {
					usage.MemTotalMB, _ = strconv.ParseInt(fields[1], 10, 64)
					usage.MemUsedMB, _ = strconv.ParseInt(fields[2], 10, 64)
					if usage.MemTotalMB > 0 {
						usage.MemPercent = float64(usage.MemUsedMB) / float64(usage.MemTotalMB) * 100
					}
				}
			case "DISK":
				fields := strings.Fields(val)
				if len(fields) >= 3 {
					usage.DiskUsedGB, _ = strconv.ParseFloat(strings.TrimSuffix(fields[0], "G"), 64)
					usage.DiskTotalGB, _ = strconv.ParseFloat(strings.TrimSuffix(fields[1], "G"), 64)
					usage.DiskPercent, _ = strconv.ParseFloat(strings.TrimSuffix(fields[2], "%"), 64)
				}
			case "LOAD":
				fields := strings.Fields(val)
				if len(fields) >= 3 {
					usage.Load1, _ = strconv.ParseFloat(fields[0], 64)
					usage.Load5, _ = strconv.ParseFloat(fields[1], 64)
					usage.Load15, _ = strconv.ParseFloat(fields[2], 64)
				}
			}
		}
	}

	return usage, nil
}

type GetProcessesRequest struct {
	SessionID string `json:"sessionId"`
	Sort      string `json:"sort,omitempty"`
}

type GetProcessesResponse struct {
	Success   bool          `json:"success"`
	Processes []ProcessInfo `json:"processes,omitempty"`
	Error     string        `json:"error,omitempty"`
}

func (m *MonitorService) GetProcesses(req GetProcessesRequest) (GetProcessesResponse, error) {
	sortArg := "-%mem"
	if req.Sort == "cpu" {
		sortArg = "-%cpu"
	}

	cmd := fmt.Sprintf("ps aux --sort=%s | head -51", sortArg)
	out, err := m.execCommand(req.SessionID, cmd)
	if err != nil {
		return GetProcessesResponse{Success: false, Error: err.Error()}, nil
	}

	lines := strings.Split(out, "\n")
	var processes []ProcessInfo
	for i, line := range lines {
		if i == 0 {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 11 {
			continue
		}
		pid, _ := strconv.Atoi(fields[1])
		cpu, _ := strconv.ParseFloat(fields[2], 64)
		mem, _ := strconv.ParseFloat(fields[3], 64)
		vsz, _ := strconv.ParseInt(fields[4], 10, 64)
		rss, _ := strconv.ParseInt(fields[5], 10, 64)

		processes = append(processes, ProcessInfo{
			PID:     pid,
			User:    fields[0],
			CPU:     cpu,
			Mem:     mem,
			VSZ:     vsz,
			RSS:     rss,
			Command: strings.Join(fields[10:], " "),
		})
	}

	return GetProcessesResponse{Success: true, Processes: processes}, nil
}

type KillProcessRequest struct {
	SessionID string `json:"sessionId"`
	PID       int    `json:"pid"`
	Signal    string `json:"signal,omitempty"`
}

type KillProcessResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *MonitorService) KillProcess(req KillProcessRequest) (KillProcessResponse, error) {
	sig := req.Signal
	if sig == "" {
		sig = "TERM"
	}
	cmd := fmt.Sprintf("kill -%s %d", sig, req.PID)
	_, err := m.execCommand(req.SessionID, cmd)
	if err != nil {
		return KillProcessResponse{Success: false, Error: err.Error()}, nil
	}
	return KillProcessResponse{Success: true}, nil
}

type GetDockerRequest struct {
	SessionID string `json:"sessionId"`
}

type GetDockerResponse struct {
	Success    bool              `json:"success"`
	Containers []DockerContainer `json:"containers,omitempty"`
	Error      string            `json:"error,omitempty"`
}

func (m *MonitorService) GetDockerContainers(req GetDockerRequest) (GetDockerResponse, error) {
	out, err := m.execCommand(req.SessionID, "docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.State}}'")
	if err != nil {
		return GetDockerResponse{Success: false, Error: err.Error()}, nil
	}

	var containers []DockerContainer
	lines := strings.Split(out, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Split(line, "|")
		if len(fields) < 6 {
			continue
		}
		containers = append(containers, DockerContainer{
			ID:     fields[0],
			Name:   fields[1],
			Image:  fields[2],
			Status: fields[3],
			Ports:  fields[4],
			State:  fields[5],
		})
	}

	return GetDockerResponse{Success: true, Containers: containers}, nil
}

type DockerStatsRequest struct {
	SessionID string `json:"sessionId"`
}

type DockerStatsResponse struct {
	Success    bool              `json:"success"`
	Containers []DockerContainer `json:"containers,omitempty"`
	Error      string            `json:"error,omitempty"`
}

func (m *MonitorService) GetDockerStats(req DockerStatsRequest) (DockerStatsResponse, error) {
	out, err := m.execCommand(req.SessionID, "docker stats --no-stream --format '{{.Container}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.Name}}'")
	if err != nil {
		return DockerStatsResponse{Success: false, Error: err.Error()}, nil
	}

	var containers []DockerContainer
	lines := strings.Split(out, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Split(line, "|")
		if len(fields) < 7 {
			continue
		}
		containers = append(containers, DockerContainer{
			ID:       fields[0],
			CPUPct:   fields[1],
			MemUsage: fields[2],
			MemPct:   fields[3],
			NetIO:    fields[4],
			BlockIO:  fields[5],
			Name:     fields[6],
		})
	}

	return DockerStatsResponse{Success: true, Containers: containers}, nil
}

type DockerActionRequest struct {
	SessionID string `json:"sessionId"`
	Container string `json:"container"`
	Action    string `json:"action"`
}

type DockerActionResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (m *MonitorService) DockerAction(req DockerActionRequest) (DockerActionResponse, error) {
	var cmd string
	switch req.Action {
	case "start":
		cmd = fmt.Sprintf("docker start %s", req.Container)
	case "stop":
		cmd = fmt.Sprintf("docker stop %s", req.Container)
	case "restart":
		cmd = fmt.Sprintf("docker restart %s", req.Container)
	case "remove":
		cmd = fmt.Sprintf("docker rm -f %s", req.Container)
	default:
		return DockerActionResponse{Success: false, Error: "unknown action"}, nil
	}

	_, err := m.execCommand(req.SessionID, cmd)
	if err != nil {
		return DockerActionResponse{Success: false, Error: err.Error()}, nil
	}
	return DockerActionResponse{Success: true}, nil
}

type DockerLogsRequest struct {
	SessionID string `json:"sessionId"`
	Container string `json:"container"`
	Tail      int    `json:"tail,omitempty"`
}

type DockerLogsResponse struct {
	Success bool   `json:"success"`
	Logs    string `json:"logs,omitempty"`
	Error   string `json:"error,omitempty"`
}

func (m *MonitorService) GetDockerLogs(req DockerLogsRequest) (DockerLogsResponse, error) {
	tail := 100
	if req.Tail > 0 {
		tail = req.Tail
	}
	cmd := fmt.Sprintf("docker logs --tail %d %s 2>&1", tail, req.Container)
	out, err := m.execCommand(req.SessionID, cmd)
	if err != nil {
		return DockerLogsResponse{Success: false, Error: err.Error()}, nil
	}
	return DockerLogsResponse{Success: true, Logs: out}, nil
}

func (m *MonitorService) StartMonitor(req StartMonitorRequest) (StartMonitorResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.cancelFns[req.SessionID]; ok {
		return StartMonitorResponse{Success: true}, nil
	}

	interval := 3
	if req.Interval > 0 {
		interval = req.Interval
	}
	if interval < 1 {
		interval = 1
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.cancelFns[req.SessionID] = cancel

	go func() {
		ticker := time.NewTicker(time.Duration(interval) * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				usage, err := m.GetResourceUsage(req.SessionID)
				if err != nil {
					if m.Ctx != nil {
						runtime.EventsEmit(m.Ctx, "monitor:"+req.SessionID+":error", map[string]interface{}{
							"sessionId": req.SessionID,
							"error":     err.Error(),
						})
					}
					continue
				}
				if m.Ctx != nil {
					runtime.EventsEmit(m.Ctx, "monitor:"+req.SessionID+":usage", usage)
				}
			}
		}
	}()

	log.Printf("Monitor started for session: %s", req.SessionID)
	return StartMonitorResponse{Success: true}, nil
}

func (m *MonitorService) StopMonitor(req StopMonitorRequest) (StopMonitorResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if cancel, ok := m.cancelFns[req.SessionID]; ok {
		cancel()
		delete(m.cancelFns, req.SessionID)
	}
	log.Printf("Monitor stopped for session: %s", req.SessionID)
	return StopMonitorResponse{Success: true}, nil
}
