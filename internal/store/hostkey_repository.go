package store

import (
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"fmt"
)

type HostKeyRow struct {
	Host        string `json:"host"`
	KeyType     string `json:"keyType"`
	Fingerprint string `json:"fingerprint"`
	PublicKey   string `json:"publicKey"`
	FirstSeen   string `json:"firstSeen"`
}

type HostKeyRepository interface {
	GetByHost(host string) ([]HostKeyRow, error)
	Save(hk HostKeyRow) error
	Delete(host, keyType string) error
}

type sqliteHostKeyRepository struct {
	db *sql.DB
}

func NewHostKeyRepository() (HostKeyRepository, error) {
	db, err := GetDB()
	if err != nil {
		return nil, err
	}
	return &sqliteHostKeyRepository{db: db}, nil
}

func FingerprintSHA256(publicKey []byte) string {
	h := sha256.New()
	h.Write(publicKey)
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func (r *sqliteHostKeyRepository) GetByHost(host string) ([]HostKeyRow, error) {
	rows, err := r.db.Query(
		`SELECT host, key_type, fingerprint, first_seen FROM host_keys WHERE host = ?`, host)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []HostKeyRow
	for rows.Next() {
		var hk HostKeyRow
		if err := rows.Scan(&hk.Host, &hk.KeyType, &hk.Fingerprint, &hk.FirstSeen); err != nil {
			return nil, err
		}
		keys = append(keys, hk)
	}
	if keys == nil {
		keys = []HostKeyRow{}
	}
	return keys, nil
}

func (r *sqliteHostKeyRepository) Save(hk HostKeyRow) error {
	if hk.Fingerprint == "" {
		return fmt.Errorf("fingerprint is required")
	}
	_, err := r.db.Exec(
		`INSERT OR REPLACE INTO host_keys (host, key_type, fingerprint, first_seen) VALUES (?, ?, ?, datetime('now'))`,
		hk.Host, hk.KeyType, hk.Fingerprint,
	)
	return err
}

func (r *sqliteHostKeyRepository) Delete(host, keyType string) error {
	_, err := r.db.Exec(`DELETE FROM host_keys WHERE host = ? AND key_type = ?`, host, keyType)
	return err
}
