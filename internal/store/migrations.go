package store

import (
	"database/sql"
	"log"
)

func runMigrations(db *sql.DB) error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS servers (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			grp TEXT DEFAULT '',
			host TEXT NOT NULL,
			port INTEGER DEFAULT 22,
			username TEXT DEFAULT '',
			auth_type TEXT DEFAULT 'password',
			password TEXT DEFAULT '',
			private_key TEXT DEFAULT '',
			vnc_enabled INTEGER DEFAULT 0,
			vnc_port INTEGER DEFAULT 5900,
			vnc_password TEXT DEFAULT '',
			vnc_tunnel INTEGER DEFAULT 0,
			favorite INTEGER DEFAULT 0,
			tags TEXT DEFAULT '[]',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS groups (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			sort_order INTEGER DEFAULT 0
		)`,
		`CREATE TABLE IF NOT EXISTS host_keys (
			host TEXT NOT NULL,
			key_type TEXT NOT NULL,
			fingerprint TEXT NOT NULL,
			first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (host, key_type)
		)`,
	}

	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			return err
		}
	}

	alters := []string{
		`ALTER TABLE servers ADD COLUMN connect_timeout INTEGER DEFAULT 0`,
	}

	for _, a := range alters {
		db.Exec(a)
	}

	log.Println("Database migrations completed")
	return nil
}
