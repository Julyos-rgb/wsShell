package autocomplete

import (
	"sort"
	"strings"
	"sync"

	sshcrypto "golang.org/x/crypto/ssh"
)

type AutoCompleteService struct {
	mu        sync.RWMutex
	cache     map[string][]string
	getClient func(string) *sshcrypto.Client
}

func NewAutoCompleteService(getClient func(string) *sshcrypto.Client) *AutoCompleteService {
	return &AutoCompleteService{
		cache:     make(map[string][]string),
		getClient: getClient,
	}
}

type FetchCommandsRequest struct {
	SessionID string `json:"sessionId"`
}

type FetchCommandsResponse struct {
	Success  bool     `json:"success"`
	Commands []string `json:"commands,omitempty"`
	Error    string   `json:"error,omitempty"`
}

func (a *AutoCompleteService) FetchCommands(req FetchCommandsRequest) (FetchCommandsResponse, error) {
	client := a.getClient(req.SessionID)
	if client == nil {
		return FetchCommandsResponse{Success: false, Error: "SSH connection not found"}, nil
	}

	session, err := client.NewSession()
	if err != nil {
		return FetchCommandsResponse{Success: false, Error: err.Error()}, nil
	}
	defer session.Close()

	out, err := session.CombinedOutput("bash -c 'compgen -c 2>/dev/null || echo ls cat grep awk sed find ps kill top free df du ping traceroute ssh scp curl wget tar gzip gunzip zip unzip mount umount chmod chown mkdir rmdir rm cp mv ln echo printf head tail wc sort uniq cut tr tee xargs less more vim nano emacs diff patch grep egrep fgrep sed awk perl python python3 ruby node npm pip pip3 gcc g++ make cmake git docker docker-compose systemctl service journalctl crontab date time uptime hostname whoami id uname env export source alias unalias history man info apropos which whereis type file stat ln readlink realpath basename dirname pwd cd pushd popd dirs lsblk lscpu lsmem lsusb lspci dmesg journalctl'")
	if err != nil {
		return FetchCommandsResponse{Success: false, Error: err.Error()}, nil
	}

	cmds := strings.Split(strings.TrimSpace(string(out)), "\n")
	unique := make(map[string]bool)
	var result []string
	for _, cmd := range cmds {
		cmd = strings.TrimSpace(cmd)
		if cmd == "" || unique[cmd] {
			continue
		}
		unique[cmd] = true
		result = append(result, cmd)
	}
	sort.Strings(result)

	a.mu.Lock()
	a.cache[req.SessionID] = result
	a.mu.Unlock()

	return FetchCommandsResponse{Success: true, Commands: result}, nil
}

type CompleteRequest struct {
	SessionID string `json:"sessionId"`
	Prefix    string `json:"prefix"`
}

type CompleteResponse struct {
	Success     bool         `json:"success"`
	Suggestions []Suggestion `json:"suggestions,omitempty"`
	Error       string       `json:"error,omitempty"`
}

type Suggestion struct {
	Command     string `json:"command"`
	Description string `json:"description,omitempty"`
	Type        string `json:"type"`
}

func (a *AutoCompleteService) Complete(req CompleteRequest) (CompleteResponse, error) {
	if req.Prefix == "" {
		return CompleteResponse{Success: true, Suggestions: nil}, nil
	}

	a.mu.RLock()
	commands, ok := a.cache[req.SessionID]
	a.mu.RUnlock()

	if !ok {
		return CompleteResponse{Success: true, Suggestions: nil}, nil
	}

	prefix := strings.ToLower(req.Prefix)
	var suggestions []Suggestion
	for _, cmd := range commands {
		if strings.HasPrefix(strings.ToLower(cmd), prefix) {
			suggestions = append(suggestions, Suggestion{
				Command:     cmd,
				Description: getDescription(cmd),
				Type:        "command",
			})
			if len(suggestions) >= 20 {
				break
			}
		}
	}

	if len(suggestions) == 0 {
		for _, cmd := range commands {
			if strings.Contains(strings.ToLower(cmd), prefix) {
				suggestions = append(suggestions, Suggestion{
					Command:     cmd,
					Description: getDescription(cmd),
					Type:        "command",
				})
				if len(suggestions) >= 10 {
					break
				}
			}
		}
	}

	return CompleteResponse{Success: true, Suggestions: suggestions}, nil
}

func getDescription(cmd string) string {
	descs := map[string]string{
		"ls": "列出目录内容", "cd": "切换目录", "pwd": "显示当前目录",
		"cp": "复制文件", "mv": "移动/重命名文件", "rm": "删除文件",
		"mkdir": "创建目录", "rmdir": "删除空目录", "cat": "显示文件内容",
		"grep": "搜索文本模式", "find": "查找文件", "ps": "显示进程",
		"kill": "终止进程", "top": "系统监控", "free": "内存使用",
		"df": "磁盘使用", "du": "目录大小", "ping": "网络连通测试",
		"ssh": "远程连接", "scp": "远程复制", "curl": "HTTP 请求",
		"wget": "下载文件", "tar": "打包/解包", "gzip": "压缩文件",
		"chmod": "修改权限", "chown": "修改所有者", "docker": "Docker 容器",
		"git": "版本控制", "vim": "文本编辑器", "nano": "文本编辑器",
		"systemctl": "系统服务管理", "journalctl": "系统日志",
		"crontab": "定时任务", "date": "显示日期", "uptime": "运行时间",
		"hostname": "主机名", "whoami": "当前用户", "uname": "系统信息",
		"env": "环境变量", "export": "设置环境变量", "history": "命令历史",
		"man": "帮助手册", "which": "查找命令路径", "tail": "显示文件尾部",
		"head": "显示文件头部", "wc": "统计行数/字数", "sort": "排序",
		"uniq": "去重", "awk": "文本处理", "sed": "流编辑器",
		"less": "分页查看", "more": "分页查看", "diff": "比较文件",
		"make": "构建工具", "gcc": "C 编译器", "python": "Python 解释器",
		"python3": "Python3 解释器", "node": "Node.js", "npm": "Node 包管理",
		"pip": "Python 包管理", "pip3": "Python3 包管理",
		"traceroute": "路由追踪", "netstat": "网络状态",
		"lscpu": "CPU 信息", "lsblk": "块设备信息", "lsusb": "USB 设备",
		"dmesg": "内核日志", "mount": "挂载文件系统", "service": "服务管理",
		"docker-compose": "Docker 编排",
	}
	if d, ok := descs[cmd]; ok {
		return d
	}
	return ""
}

type ClearCacheRequest struct {
	SessionID string `json:"sessionId"`
}

type ClearCacheResponse struct {
	Success bool `json:"success"`
}

func (a *AutoCompleteService) ClearCache(req ClearCacheRequest) (ClearCacheResponse, error) {
	a.mu.Lock()
	delete(a.cache, req.SessionID)
	a.mu.Unlock()
	return ClearCacheResponse{Success: true}, nil
}
