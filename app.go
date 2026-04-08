package main

import (
	"context"
	"log"

	"wsShell/internal/config"
	"wsShell/internal/sftp"
	"wsShell/internal/ssh"
	"wsShell/internal/store"
	"wsShell/internal/vnc"
)

type App struct {
	ctx           context.Context
	sshService    *ssh.SSHService
	sftpManager   *sftp.SFTPManager
	configManager *config.ConfigManager
	vncProxy      *vnc.Proxy
}

func NewApp() *App {
	repo, err := store.NewServerRepository()
	if err != nil {
		log.Fatalf("Failed to initialize server repository: %v", err)
	}

	return &App{
		sshService:    ssh.NewSSHService(),
		sftpManager:   sftp.NewSFTPManager(),
		configManager: config.NewConfigManager(repo),
		vncProxy:      vnc.NewProxy(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.sshService.Ctx = ctx
	a.sftpManager.Ctx = ctx
	a.vncProxy.SetSSHProvider(a.sshService)
	log.Println("wsShell started")
}

func (a *App) GetSSHService() *ssh.SSHService {
	return a.sshService
}

func (a *App) GetSFTPManager() *sftp.SFTPManager {
	return a.sftpManager
}

func (a *App) GetConfigManager() *config.ConfigManager {
	return a.configManager
}

func (a *App) GetVNCProxy() *vnc.Proxy {
	return a.vncProxy
}
