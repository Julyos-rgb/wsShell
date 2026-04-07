package main

import (
	"context"
	"log"

	"wsShell/internal/config"
	"wsShell/internal/sftp"
	"wsShell/internal/ssh"
)

type App struct {
	ctx            context.Context
	sshService     *ssh.SSHService
	sftpManager    *sftp.SFTPManager
	configManager  *config.ConfigManager
}

func NewApp() *App {
	return &App{
		sshService:    ssh.NewSSHService(),
		sftpManager:   sftp.NewSFTPManager(),
		configManager: config.NewConfigManager(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.sshService.Ctx = ctx
	a.sftpManager.Ctx = ctx
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
