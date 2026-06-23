package db

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
)

func Open(connStr string) (*sql.DB, error) {
	d, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("open: %w", err)
	}
	if err := d.Ping(); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}
	return d, nil
}

func WithTx(ctx context.Context, d *sql.DB, fn func(*sql.Tx) error) error {
	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}
