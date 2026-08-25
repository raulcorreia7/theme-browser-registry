// Package store provides the SQLite repository cache, byte-compatible with
// the TypeScript better-sqlite3 schema so an existing .cache/registry.db
// keeps working across the cutover.
package store

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "modernc.org/sqlite"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

// Cache is the concrete repo_cache over database/sql. A nil *Cache means
// "no cache" at call sites.
type Cache struct {
	db      *sql.DB
	mu      sync.Mutex
	inited  bool
	nowFunc func() int64 // overridable in tests
}

const createSchema = `CREATE TABLE IF NOT EXISTS repo_cache (
	repo TEXT PRIMARY KEY,
	updated_at TEXT NOT NULL,
	scanned_at INTEGER NOT NULL,
	payload_json TEXT NOT NULL,
	parse_error TEXT NULL
)`

// Open opens (creating if needed) the cache database at path and lazily
// ensures the schema on first operation.
func Open(path string) (*Cache, error) {
	if path != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, err
		}
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	// One connection keeps :memory: databases shared across statements.
	db.SetMaxOpenConns(1)
	c := &Cache{db: db, nowFunc: func() int64 { return time.Now().Unix() }}
	return c, nil
}

func (c *Cache) ensureSchema() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.inited {
		return nil
	}
	if _, err := c.db.Exec(createSchema); err != nil {
		return err
	}
	// Tolerate "duplicate column" failures from the readme migrations.
	_, _ = c.db.Exec(`ALTER TABLE repo_cache ADD COLUMN readme_content TEXT`)
	_, _ = c.db.Exec(`ALTER TABLE repo_cache ADD COLUMN readme_scanned_at INTEGER`)
	c.inited = true
	return nil
}

// Close releases the database handle.
func (c *Cache) Close() error { return c.db.Close() }

// CacheRow is one repo_cache row with its parsed payload.
type CacheRow struct {
	Repo       string
	UpdatedAt  string
	ScannedAt  int64
	Payload    map[string]any
	ParseError *string
}

func (c *Cache) parsePayload(jsonStr string) map[string]any {
	var parsed map[string]any
	if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil || parsed == nil {
		return nil
	}
	return parsed
}

// ReadRepo returns the cached row for repo, or nil if absent.
func (c *Cache) ReadRepo(repo string) (*CacheRow, error) {
	if err := c.ensureSchema(); err != nil {
		return nil, err
	}
	var (
		row         CacheRow
		payloadJSON sql.NullString
		parseError  sql.NullString
	)
	err := c.db.QueryRow(
		`SELECT repo, updated_at, scanned_at, payload_json, parse_error FROM repo_cache WHERE repo = ?`,
		repo,
	).Scan(&row.Repo, &row.UpdatedAt, &row.ScannedAt, &payloadJSON, &parseError)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	row.Payload = c.parsePayload(payloadJSON.String)
	if parseError.Valid {
		s := parseError.String
		row.ParseError = &s
	}
	return &row, nil
}

// UpsertRepo stores or updates a repository entry; scanned_at is set to now.
func (c *Cache) UpsertRepo(repo, updatedAt string, payload any, parseError *string) error {
	if err := c.ensureSchema(); err != nil {
		return err
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	scannedAt := c.nowFunc()
	_, err = c.db.Exec(
		`INSERT INTO repo_cache (repo, updated_at, scanned_at, payload_json, parse_error)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(repo) DO UPDATE SET
		   updated_at = excluded.updated_at,
		   scanned_at = excluded.scanned_at,
		   payload_json = excluded.payload_json,
		   parse_error = excluded.parse_error`,
		repo, updatedAt, scannedAt, string(payloadJSON), parseError,
	)
	return err
}

// ShouldRefresh reports whether repo must be re-fetched: absent row,
// parse error, changed updated_at, or age >= staleAfterDays days.
func (c *Cache) ShouldRefresh(repo, discoveredUpdatedAt string, staleAfterDaysDays int) (bool, error) {
	existing, err := c.ReadRepo(repo)
	if err != nil {
		return false, err
	}
	if existing == nil {
		return true, nil
	}
	if existing.ParseError != nil {
		return true, nil
	}
	if discoveredUpdatedAt != "" && existing.UpdatedAt != discoveredUpdatedAt {
		return true, nil
	}
	staleSeconds := int64(staleAfterDaysDays) * 86400
	return c.nowFunc()-existing.ScannedAt >= staleSeconds, nil
}

// ListPayloads returns valid theme entries: rows without a parse error whose
// payload carries name, repo and colorscheme keys.
func (c *Cache) ListPayloads() ([]theme.Entry, error) {
	if err := c.ensureSchema(); err != nil {
		return nil, err
	}
	rows, err := c.db.Query(`SELECT payload_json FROM repo_cache WHERE parse_error IS NULL`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payloads []theme.Entry
	for rows.Next() {
		var payloadJSON string
		if err := rows.Scan(&payloadJSON); err != nil {
			return nil, err
		}
		parsed := c.parsePayload(payloadJSON)
		if parsed == nil {
			continue
		}
		if _, ok := parsed["name"]; !ok {
			continue
		}
		if _, ok := parsed["repo"]; !ok {
			continue
		}
		if _, ok := parsed["colorscheme"]; !ok {
			continue
		}
		var entry theme.Entry
		if err := json.Unmarshal([]byte(payloadJSON), &entry); err != nil {
			continue
		}
		payloads = append(payloads, entry)
	}
	return payloads, rows.Err()
}

// ListAll returns every cache row.
func (c *Cache) ListAll() ([]CacheRow, error) {
	if err := c.ensureSchema(); err != nil {
		return nil, err
	}
	rows, err := c.db.Query(
		`SELECT repo, updated_at, scanned_at, payload_json, parse_error FROM repo_cache`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []CacheRow{}
	for rows.Next() {
		var (
			r           CacheRow
			payloadJSON sql.NullString
			parseError  sql.NullString
		)
		if err := rows.Scan(&r.Repo, &r.UpdatedAt, &r.ScannedAt, &payloadJSON, &parseError); err != nil {
			return nil, err
		}
		r.Payload = c.parsePayload(payloadJSON.String)
		if parseError.Valid {
			s := parseError.String
			r.ParseError = &s
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// ReadReadme returns cached README content for repo; nil means no cached
// README (missing row or missing content/timestamp).
func (c *Cache) ReadReadme(repo string) (*string, error) {
	if err := c.ensureSchema(); err != nil {
		return nil, err
	}
	var (
		content   sql.NullString
		scannedAt sql.NullInt64
	)
	err := c.db.QueryRow(
		`SELECT readme_content, readme_scanned_at FROM repo_cache WHERE repo = ?`, repo,
	).Scan(&content, &scannedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !content.Valid || !scannedAt.Valid {
		return nil, nil
	}
	return &content.String, nil
}

// ShouldRefreshReadme reports whether the README needs refetching.
func (c *Cache) ShouldRefreshReadme(repo string, staleAfterDaysDays int) (bool, error) {
	if err := c.ensureSchema(); err != nil {
		return false, err
	}
	var scannedAt sql.NullInt64
	err := c.db.QueryRow(
		`SELECT readme_scanned_at FROM repo_cache WHERE repo = ?`, repo,
	).Scan(&scannedAt)
	if err == sql.ErrNoRows {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	if !scannedAt.Valid {
		return true, nil
	}
	staleSeconds := int64(staleAfterDaysDays) * 86400
	return c.nowFunc()-scannedAt.Int64 >= staleSeconds, nil
}

// UpsertReadme stores README content for repo. On insert it seeds placeholder
// repo fields exactly like the TS implementation.
func (c *Cache) UpsertReadme(repo, content string) error {
	if err := c.ensureSchema(); err != nil {
		return err
	}
	scannedAt := c.nowFunc()
	_, err := c.db.Exec(
		`INSERT INTO repo_cache (repo, updated_at, scanned_at, payload_json, readme_content, readme_scanned_at)
		 VALUES (?, '', 0, '{}', ?, ?)
		 ON CONFLICT(repo) DO UPDATE SET
		   readme_content = excluded.readme_content,
		   readme_scanned_at = excluded.readme_scanned_at`,
		repo, content, scannedAt,
	)
	return err
}
