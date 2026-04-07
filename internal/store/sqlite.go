package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "github.com/mattn/go-sqlite3"
)

var (
	db   *sql.DB
	once sync.Once
)

func GetDB() (*sql.DB, error) {
	var initErr error
	once.Do(func() {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			initErr = err
			return
		}
		configDir := filepath.Join(homeDir, ".wsShell")
		if err := os.MkdirAll(configDir, 0755); err != nil {
			initErr = err
			return
		}
		dbPath := filepath.Join(configDir, "wsShell.db")
		db, initErr = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
		if initErr != nil {
			return
		}
		db.SetMaxOpenConns(1)
		if initErr = runMigrations(db); initErr != nil {
			return
		}
	})
	if initErr != nil {
		return nil, fmt.Errorf("database init failed: %w", initErr)
	}
	return db, nil
}
