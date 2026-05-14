package config

import (
	"fmt"
	"log"
	"time"

	"wsShell/internal/crypto"
	"wsShell/internal/store"
)

type ServerConfig struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Group       string   `json:"group"`
	Host        string   `json:"host"`
	Port        int      `json:"port"`
	Username    string   `json:"username"`
	AuthType    string   `json:"authType"`
	Password    string   `json:"password"`
	PrivateKey  string   `json:"privateKey"`
	VNCEnabled  bool     `json:"vncEnabled"`
	VNCPort     int      `json:"vncPort"`
	VNCPassword string   `json:"vncPassword"`
	VNCTunnel       bool     `json:"vncTunnel"`
	Favorite        bool     `json:"favorite"`
	Tags            []string `json:"tags"`
	ConnectTimeout  int      `json:"connectTimeout"`
	CreatedAt       string   `json:"createdAt,omitempty"`
	UpdatedAt   string   `json:"updatedAt,omitempty"`
}

type ConfigManager struct {
	repo store.ServerRepository
}

func NewConfigManager(repo store.ServerRepository) *ConfigManager {
	if err := crypto.InitMasterKey(); err != nil {
		log.Printf("Warning: crypto init failed: %v", err)
	}
	return &ConfigManager{repo: repo}
}

func rowToDecryptedConfig(row store.ServerRow) ServerConfig {
	password, _ := crypto.Decrypt(row.Password)
	privateKey, _ := crypto.Decrypt(row.PrivateKey)
	vncPassword, _ := crypto.Decrypt(row.VNCPassword)
	return ServerConfig{
		ID:          row.ID,
		Name:        row.Name,
		Group:       row.Group,
		Host:        row.Host,
		Port:        row.Port,
		Username:    row.Username,
		AuthType:    row.AuthType,
		Password:    password,
		PrivateKey:  privateKey,
		VNCEnabled:  row.VNCEnabled,
		VNCPort:     row.VNCPort,
		VNCPassword: vncPassword,
		VNCTunnel:      row.VNCTunnel,
		Favorite:       row.Favorite,
		Tags:           row.Tags,
		ConnectTimeout: row.ConnectTimeout,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

func configToRow(s ServerConfig) store.ServerRow {
	return store.ServerRow{
		ID:          s.ID,
		Name:        s.Name,
		Group:       s.Group,
		Host:        s.Host,
		Port:        s.Port,
		Username:    s.Username,
		AuthType:    s.AuthType,
		Password:    s.Password,
		PrivateKey:  s.PrivateKey,
		VNCEnabled:  s.VNCEnabled,
		VNCPort:     s.VNCPort,
		VNCPassword: s.VNCPassword,
		VNCTunnel:      s.VNCTunnel,
		Favorite:       s.Favorite,
		Tags:           s.Tags,
		ConnectTimeout: s.ConnectTimeout,
		CreatedAt:      s.CreatedAt,
		UpdatedAt:   s.UpdatedAt,
	}
}

type GetServersResponse struct {
	Servers []ServerConfig `json:"servers"`
}

func (c *ConfigManager) GetServers() (GetServersResponse, error) {
	rows, err := c.repo.GetAll()
	if err != nil {
		return GetServersResponse{}, err
	}

	servers := make([]ServerConfig, len(rows))
	for i, row := range rows {
		servers[i] = rowToDecryptedConfig(row)
	}

	return GetServersResponse{Servers: servers}, nil
}

type AddServerRequest struct {
	Server ServerConfig `json:"server"`
}

type AddServerResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func encryptSensitiveFields(s *ServerConfig) error {
	encPass, err := crypto.Encrypt(s.Password)
	if err != nil {
		return fmt.Errorf("encrypt password failed: %w", err)
	}
	encKey, err := crypto.Encrypt(s.PrivateKey)
	if err != nil {
		return fmt.Errorf("encrypt private key failed: %w", err)
	}
	encVNCPass, err := crypto.Encrypt(s.VNCPassword)
	if err != nil {
		return fmt.Errorf("encrypt VNC password failed: %w", err)
	}
	s.Password = encPass
	s.PrivateKey = encKey
	s.VNCPassword = encVNCPass
	return nil
}

func (c *ConfigManager) AddServer(req AddServerRequest) (AddServerResponse, error) {
	s := req.Server
	if s.ID == "" {
		s.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	if err := encryptSensitiveFields(&s); err != nil {
		return AddServerResponse{Success: false, Error: err.Error()}, nil
	}

	if err := c.repo.Save(configToRow(s)); err != nil {
		return AddServerResponse{Success: false, Error: err.Error()}, nil
	}

	return AddServerResponse{Success: true}, nil
}

type UpdateServerRequest struct {
	Server ServerConfig `json:"server"`
}

type UpdateServerResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (c *ConfigManager) UpdateServer(req UpdateServerRequest) (UpdateServerResponse, error) {
	s := req.Server

	existing, err := c.repo.GetByID(s.ID)
	if err != nil || existing == nil {
		return UpdateServerResponse{Success: false, Error: "server not found"}, nil
	}

	if s.Password == "" {
		s.Password = existing.Password
	}
	if s.PrivateKey == "" {
		s.PrivateKey = existing.PrivateKey
	}
	if s.VNCPassword == "" {
		s.VNCPassword = existing.VNCPassword
	}

	if s.Password != existing.Password || s.PrivateKey != existing.PrivateKey || s.VNCPassword != existing.VNCPassword {
		if err := encryptSensitiveFields(&s); err != nil {
			return UpdateServerResponse{Success: false, Error: err.Error()}, nil
		}
	}

	if err := c.repo.Update(configToRow(s)); err != nil {
		return UpdateServerResponse{Success: false, Error: err.Error()}, nil
	}

	return UpdateServerResponse{Success: true}, nil
}

type DeleteServerRequest struct {
	ID string `json:"id"`
}

type DeleteServerResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (c *ConfigManager) DeleteServer(req DeleteServerRequest) (DeleteServerResponse, error) {
	if err := c.repo.Delete(req.ID); err != nil {
		return DeleteServerResponse{Success: false, Error: err.Error()}, nil
	}
	return DeleteServerResponse{Success: true}, nil
}

type ToggleFavoriteRequest struct {
	ID string `json:"id"`
}

type ToggleFavoriteResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (c *ConfigManager) ToggleFavorite(req ToggleFavoriteRequest) (ToggleFavoriteResponse, error) {
	if err := c.repo.ToggleFavorite(req.ID); err != nil {
		return ToggleFavoriteResponse{Success: false, Error: err.Error()}, nil
	}
	return ToggleFavoriteResponse{Success: true}, nil
}

type ExportServersResponse struct {
	Servers []ServerConfig `json:"servers"`
}

func (c *ConfigManager) ExportServers() (ExportServersResponse, error) {
	rows, err := c.repo.GetAll()
	if err != nil {
		return ExportServersResponse{}, err
	}
	servers := make([]ServerConfig, len(rows))
	for i, row := range rows {
		servers[i] = rowToDecryptedConfig(row)
	}
	return ExportServersResponse{Servers: servers}, nil
}

type ImportServersRequest struct {
	Servers []ServerConfig `json:"servers"`
}

type ImportServersResponse struct {
	Success bool   `json:"success"`
	Count   int    `json:"count"`
	Error   string `json:"error,omitempty"`
}

func (c *ConfigManager) ImportServers(req ImportServersRequest) (ImportServersResponse, error) {
	imported := 0
	for _, s := range req.Servers {
		existing, _ := c.repo.GetByID(s.ID)
		if existing != nil {
			continue
		}
		if s.ID == "" {
			s.ID = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		if err := encryptSensitiveFields(&s); err != nil {
			continue
		}
		if err := c.repo.Save(configToRow(s)); err != nil {
			continue
		}
		imported++
	}
	return ImportServersResponse{Success: true, Count: imported}, nil
}
