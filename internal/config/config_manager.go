package config

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"wsShell/internal/crypto"
	"wsShell/internal/store"

	_ "github.com/mattn/go-sqlite3"
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
	VNCTunnel   bool     `json:"vncTunnel"`
	Favorite    bool     `json:"favorite"`
	Tags        []string `json:"tags"`
	CreatedAt   string   `json:"createdAt,omitempty"`
	UpdatedAt   string   `json:"updatedAt,omitempty"`
}

type ConfigManager struct{}

func NewConfigManager() *ConfigManager {
	return &ConfigManager{}
}

func (c *ConfigManager) Startup(ctx context.Context) {
	if err := crypto.InitMasterKey(); err != nil {
		log.Printf("Warning: crypto init failed: %v", err)
	}
}

type GetServersResponse struct {
	Servers []ServerConfig `json:"servers"`
}

func (c *ConfigManager) GetServers() (GetServersResponse, error) {
	db, err := store.GetDB()
	if err != nil {
		return GetServersResponse{}, err
	}

	rows, err := db.Query(`SELECT id, name, grp, host, port, username, auth_type, password, private_key, vnc_enabled, vnc_port, vnc_password, vnc_tunnel, favorite, tags, created_at, updated_at FROM servers ORDER BY favorite DESC, name ASC`)
	if err != nil {
		return GetServersResponse{}, err
	}
	defer rows.Close()

	var servers []ServerConfig
	for rows.Next() {
		var s ServerConfig
		var tagsJSON string
		var vncEnabled, vncTunnel, favorite int
		var createdAt, updatedAt sql.NullString

		err := rows.Scan(&s.ID, &s.Name, &s.Group, &s.Host, &s.Port, &s.Username, &s.AuthType, &s.Password, &s.PrivateKey, &vncEnabled, &s.VNCPort, &s.VNCPassword, &vncTunnel, &favorite, &tagsJSON, &createdAt, &updatedAt)
		if err != nil {
			return GetServersResponse{}, err
		}

		s.VNCEnabled = vncEnabled == 1
		s.VNCTunnel = vncTunnel == 1
		s.Favorite = favorite == 1
		s.CreatedAt = createdAt.String
		s.UpdatedAt = updatedAt.String

		if err := json.Unmarshal([]byte(tagsJSON), &s.Tags); err != nil {
			s.Tags = []string{}
		}

		s.Password, _ = crypto.Decrypt(s.Password)
		s.PrivateKey, _ = crypto.Decrypt(s.PrivateKey)
		s.VNCPassword, _ = crypto.Decrypt(s.VNCPassword)

		servers = append(servers, s)
	}

	if servers == nil {
		servers = []ServerConfig{}
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

func (c *ConfigManager) AddServer(req AddServerRequest) (AddServerResponse, error) {
	db, err := store.GetDB()
	if err != nil {
		return AddServerResponse{Success: false, Error: err.Error()}, nil
	}

	s := req.Server
	if s.ID == "" {
		s.ID = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	if s.Port == 0 {
		s.Port = 22
	}
	if s.VNCPort == 0 {
		s.VNCPort = 5900
	}

	encPass, err := crypto.Encrypt(s.Password)
	if err != nil {
		return AddServerResponse{Success: false, Error: err.Error()}, nil
	}
	encKey, err := crypto.Encrypt(s.PrivateKey)
	if err != nil {
		return AddServerResponse{Success: false, Error: err.Error()}, nil
	}
	encVNCPass, err := crypto.Encrypt(s.VNCPassword)
	if err != nil {
		return AddServerResponse{Success: false, Error: err.Error()}, nil
	}

	tagsJSON, _ := json.Marshal(s.Tags)
	if tagsJSON == nil {
		tagsJSON = []byte("[]")
	}

	vncEnabled := 0
	if s.VNCEnabled {
		vncEnabled = 1
	}
	vncTunnel := 0
	if s.VNCTunnel {
		vncTunnel = 1
	}
	favorite := 0
	if s.Favorite {
		favorite = 1
	}

	_, err = db.Exec(
		`INSERT OR REPLACE INTO servers (id, name, grp, host, port, username, auth_type, password, private_key, vnc_enabled, vnc_port, vnc_password, vnc_tunnel, favorite, tags, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
		s.ID, s.Name, s.Group, s.Host, s.Port, s.Username, s.AuthType, encPass, encKey, vncEnabled, s.VNCPort, encVNCPass, vncTunnel, favorite, string(tagsJSON))

	if err != nil {
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
	db, err := store.GetDB()
	if err != nil {
		return UpdateServerResponse{Success: false, Error: err.Error()}, nil
	}

	s := req.Server
	encPass, err := crypto.Encrypt(s.Password)
	if err != nil {
		return UpdateServerResponse{Success: false, Error: err.Error()}, nil
	}
	encKey, err := crypto.Encrypt(s.PrivateKey)
	if err != nil {
		return UpdateServerResponse{Success: false, Error: err.Error()}, nil
	}
	encVNCPass, err := crypto.Encrypt(s.VNCPassword)
	if err != nil {
		return UpdateServerResponse{Success: false, Error: err.Error()}, nil
	}

	tagsJSON, _ := json.Marshal(s.Tags)
	if tagsJSON == nil {
		tagsJSON = []byte("[]")
	}

	vncEnabled := 0
	if s.VNCEnabled {
		vncEnabled = 1
	}
	vncTunnel := 0
	if s.VNCTunnel {
		vncTunnel = 1
	}
	favorite := 0
	if s.Favorite {
		favorite = 1
	}

	_, err = db.Exec(
		`UPDATE servers SET name=?, grp=?, host=?, port=?, username=?, auth_type=?, password=?, private_key=?, vnc_enabled=?, vnc_port=?, vnc_password=?, vnc_tunnel=?, favorite=?, tags=?, updated_at=datetime('now') WHERE id=?`,
		s.Name, s.Group, s.Host, s.Port, s.Username, s.AuthType, encPass, encKey, vncEnabled, s.VNCPort, encVNCPass, vncTunnel, favorite, string(tagsJSON), s.ID)

	if err != nil {
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
	db, err := store.GetDB()
	if err != nil {
		return DeleteServerResponse{Success: false, Error: err.Error()}, nil
	}

	_, err = db.Exec(`DELETE FROM servers WHERE id=?`, req.ID)
	if err != nil {
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
	db, err := store.GetDB()
	if err != nil {
		return ToggleFavoriteResponse{Success: false, Error: err.Error()}, nil
	}

	_, err = db.Exec(`UPDATE servers SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END, updated_at=datetime('now') WHERE id=?`, req.ID)
	if err != nil {
		return ToggleFavoriteResponse{Success: false, Error: err.Error()}, nil
	}

	return ToggleFavoriteResponse{Success: true}, nil
}
