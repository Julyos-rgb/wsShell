package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

type ServerRow struct {
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
	CreatedAt   string   `json:"createdAt,omitempty"`
	UpdatedAt   string   `json:"updatedAt,omitempty"`
}

type ServerRepository interface {
	GetAll() ([]ServerRow, error)
	GetByID(id string) (*ServerRow, error)
	Save(s ServerRow) error
	Update(s ServerRow) error
	Delete(id string) error
	ToggleFavorite(id string) error
}

type sqliteServerRepository struct {
	db *sql.DB
}

func NewServerRepository() (ServerRepository, error) {
	db, err := GetDB()
	if err != nil {
		return nil, err
	}
	return &sqliteServerRepository{db: db}, nil
}

func (r *sqliteServerRepository) GetAll() ([]ServerRow, error) {
	rows, err := r.db.Query(
		`SELECT id, name, grp, host, port, username, auth_type, password, private_key,
		        vnc_enabled, vnc_port, vnc_password, vnc_tunnel, favorite, tags, created_at, updated_at,
		        connect_timeout
		 FROM servers ORDER BY favorite DESC, name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []ServerRow
	for rows.Next() {
		var s ServerRow
		var tagsJSON string
		var vncEnabled, vncTunnel, favorite int
		var createdAt, updatedAt sql.NullString
		var connectTimeout sql.NullInt64

		err := rows.Scan(
			&s.ID, &s.Name, &s.Group, &s.Host, &s.Port, &s.Username, &s.AuthType,
			&s.Password, &s.PrivateKey, &vncEnabled, &s.VNCPort, &s.VNCPassword,
			&vncTunnel, &favorite, &tagsJSON, &createdAt, &updatedAt, &connectTimeout,
		)
		if err != nil {
			return nil, err
		}

		s.VNCEnabled = vncEnabled == 1
		s.VNCTunnel = vncTunnel == 1
		s.Favorite = favorite == 1
		s.CreatedAt = createdAt.String
		s.UpdatedAt = updatedAt.String
		s.ConnectTimeout = int(connectTimeout.Int64)

		if err := json.Unmarshal([]byte(tagsJSON), &s.Tags); err != nil {
			s.Tags = []string{}
		}

		servers = append(servers, s)
	}

	if servers == nil {
		servers = []ServerRow{}
	}

	return servers, nil
}

func (r *sqliteServerRepository) GetByID(id string) (*ServerRow, error) {
	row := r.db.QueryRow(
		`SELECT id, name, grp, host, port, username, auth_type, password, private_key,
		        vnc_enabled, vnc_port, vnc_password, vnc_tunnel, favorite, tags, created_at, updated_at,
		        connect_timeout
		 FROM servers WHERE id = ?`, id)

	var s ServerRow
	var tagsJSON string
	var vncEnabled, vncTunnel, favorite int
	var createdAt, updatedAt sql.NullString
	var connectTimeout sql.NullInt64

	err := row.Scan(
		&s.ID, &s.Name, &s.Group, &s.Host, &s.Port, &s.Username, &s.AuthType,
		&s.Password, &s.PrivateKey, &vncEnabled, &s.VNCPort, &s.VNCPassword,
		&vncTunnel, &favorite, &tagsJSON, &createdAt, &updatedAt, &connectTimeout,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	s.VNCEnabled = vncEnabled == 1
	s.VNCTunnel = vncTunnel == 1
	s.Favorite = favorite == 1
	s.CreatedAt = createdAt.String
	s.UpdatedAt = updatedAt.String
	s.ConnectTimeout = int(connectTimeout.Int64)

	if err := json.Unmarshal([]byte(tagsJSON), &s.Tags); err != nil {
		s.Tags = []string{}
	}

	return &s, nil
}

func (r *sqliteServerRepository) Save(s ServerRow) error {
	if s.ID == "" {
		s.ID = fmt.Sprintf("%d", time.Now().UnixNano())
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

	_, err := r.db.Exec(
		`INSERT OR REPLACE INTO servers
		 (id, name, grp, host, port, username, auth_type, password, private_key,
		  vnc_enabled, vnc_port, vnc_password, vnc_tunnel, favorite, tags, updated_at,
		  connect_timeout)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'),
		         ?)`,
		s.ID, s.Name, s.Group, s.Host, s.Port, s.Username, s.AuthType,
		s.Password, s.PrivateKey, vncEnabled, s.VNCPort, s.VNCPassword,
		vncTunnel, favorite, string(tagsJSON), s.ConnectTimeout,
	)
	return err
}

func (r *sqliteServerRepository) Update(s ServerRow) error {
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

	_, err := r.db.Exec(
		`UPDATE servers SET
		  name=?, grp=?, host=?, port=?, username=?, auth_type=?, password=?,
		  private_key=?, vnc_enabled=?, vnc_port=?, vnc_password=?, vnc_tunnel=?,
		  favorite=?, tags=?, updated_at=datetime('now'),
		  connect_timeout=?
		 WHERE id=?`,
		s.Name, s.Group, s.Host, s.Port, s.Username, s.AuthType,
		s.Password, s.PrivateKey, vncEnabled, s.VNCPort, s.VNCPassword,
		vncTunnel, favorite, string(tagsJSON), s.ConnectTimeout, s.ID,
	)
	return err
}

func (r *sqliteServerRepository) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM servers WHERE id=?`, id)
	return err
}

func (r *sqliteServerRepository) ToggleFavorite(id string) error {
	_, err := r.db.Exec(
		`UPDATE servers SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END, updated_at=datetime('now') WHERE id=?`,
		id,
	)
	return err
}
