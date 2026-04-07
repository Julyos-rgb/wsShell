package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

var (
	db    *sql.DB
	once  sync.Once
	dbErr error
)

func GetDB() (*sql.DB, error) {
	once.Do(func() {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			dbErr = err
			return
		}
		configDir := filepath.Join(homeDir, ".wsShell")
		if err := os.MkdirAll(configDir, 0755); err != nil {
			dbErr = err
			return
		}
		dbPath := filepath.Join(configDir, "wsShell.db")
		db, dbErr = sql.Open("sqlite", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
		if dbErr != nil {
			return
		}
		db.SetMaxOpenConns(1)
		dbErr = runMigrations(db)
	})
	if dbErr != nil {
		return nil, fmt.Errorf("database init failed: %w", dbErr)
	}
	return db, nil
}
