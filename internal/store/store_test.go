package store

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

func openTest(t *testing.T) *Cache {
	t.Helper()
	c, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { c.Close() })
	return c
}

func makePayload(name string) map[string]any {
	return map[string]any{"name": name, "repo": "owner/test-theme", "colorscheme": "test"}
}

func strPtr(s string) *string { return &s }

// Ported from tests/db/cache.unit.test.ts

func TestReadRepoNonExistent(t *testing.T) {
	c := openTest(t)
	row, err := c.ReadRepo("nonexistent")
	if err != nil || row != nil {
		t.Fatalf("want nil,nil got %v,%v", row, err)
	}
}

func TestUpsertAndReadRepo(t *testing.T) {
	c := openTest(t)
	payload := makePayload("test-theme")
	if err := c.UpsertRepo("owner/theme", "2024-01-01", payload, nil); err != nil {
		t.Fatal(err)
	}
	row, err := c.ReadRepo("owner/theme")
	if err != nil {
		t.Fatal(err)
	}
	if row == nil || row.Repo != "owner/theme" || row.UpdatedAt != "2024-01-01" ||
		row.ParseError != nil || row.Payload["name"] != "test-theme" {
		t.Fatalf("bad row: %+v", row)
	}
}

func TestUpsertReplacesExisting(t *testing.T) {
	c := openTest(t)
	if err := c.UpsertRepo("owner/theme", "2024-01-01", makePayload("theme-v1"), nil); err != nil {
		t.Fatal(err)
	}
	if err := c.UpsertRepo("owner/theme", "2024-01-02", makePayload("theme-v2"), nil); err != nil {
		t.Fatal(err)
	}
	row, _ := c.ReadRepo("owner/theme")
	if row.UpdatedAt != "2024-01-02" || row.Payload["name"] != "theme-v2" {
		t.Fatalf("update failed: %+v", row)
	}
}

func TestStoresParseError(t *testing.T) {
	c := openTest(t)
	if err := c.UpsertRepo("owner/bad", "2024-01-01", map[string]any{"repo": "owner/bad"}, strPtr("parse failed")); err != nil {
		t.Fatal(err)
	}
	row, _ := c.ReadRepo("owner/bad")
	if row.ParseError == nil || *row.ParseError != "parse failed" {
		t.Fatalf("parse_error lost: %+v", row.ParseError)
	}
}

func TestShouldRefresh(t *testing.T) {
	c := openTest(t)
	if v, _ := c.ShouldRefresh("owner/new", "2024-01-01", 7); !v {
		t.Fatal("new repo must refresh")
	}
	if err := c.UpsertRepo("owner/fresh", "2024-01-01", makePayload("x"), nil); err != nil {
		t.Fatal(err)
	}
	if v, _ := c.ShouldRefresh("owner/fresh", "2024-01-01", 7); v {
		t.Fatal("fresh entry must not refresh")
	}
	if v, _ := c.ShouldRefresh("owner/fresh", "2024-01-02", 7); !v {
		t.Fatal("changed updated_at must refresh")
	}
	if v, _ := c.ShouldRefresh("owner/fresh", "2024-01-01", -1); !v {
		t.Fatal("stale entry (negative days) must refresh")
	}
	if err := c.UpsertRepo("owner/error", "2024-01-01", map[string]any{"repo": "owner/error"}, strPtr("failed")); err != nil {
		t.Fatal(err)
	}
	if v, _ := c.ShouldRefresh("owner/error", "2024-01-01", 7); !v {
		t.Fatal("parse error must refresh")
	}
}

func TestShouldRefreshStaleByAge(t *testing.T) {
	c, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	// Insert with a fresh scanned_at, then pretend time moved 15 days ahead.
	if err := c.UpsertRepo("owner/aged", "2024-01-01", makePayload("x"), nil); err != nil {
		t.Fatal(err)
	}
	c.mu.Lock()
	now := c.nowFunc()
	c.nowFunc = func() int64 { return now + 15*86400 }
	c.mu.Unlock()
	v, err := c.ShouldRefresh("owner/aged", "2024-01-01", 14)
	if err != nil || !v {
		t.Fatalf("15-day-old entry with staleAfterDays=14 must refresh: %v %v", v, err)
	}
	v, _ = c.ShouldRefresh("owner/aged", "2024-01-01", 16)
	if v {
		t.Fatal("15-day-old entry with staleAfterDays=16 is not stale")
	}
}

func TestListPayloads(t *testing.T) {
	c := openTest(t)
	payloads, err := c.ListPayloads()
	if err != nil || len(payloads) != 0 {
		t.Fatalf("empty cache: %v %v", payloads, err)
	}
	e1 := makePayload("t1")
	e1["repo"] = "owner/theme1"
	e2 := makePayload("t2")
	e2["repo"] = "owner/theme2"
	if err := c.UpsertRepo("owner/theme1", "2024-01-01", e1, nil); err != nil {
		t.Fatal(err)
	}
	if err := c.UpsertRepo("owner/theme2", "2024-01-02", e2, nil); err != nil {
		t.Fatal(err)
	}
	if err := c.UpsertRepo("owner/bad", "2024-01-01", map[string]any{"repo": "owner/bad"}, strPtr("error")); err != nil {
		t.Fatal(err)
	}
	payloads, err = c.ListPayloads()
	if err != nil {
		t.Fatal(err)
	}
	if len(payloads) != 2 {
		t.Fatalf("want 2 valid payloads, got %d", len(payloads))
	}
	repos := map[string]bool{}
	for _, p := range payloads {
		repos[p.Repo] = true
	}
	if !repos["owner/theme1"] || !repos["owner/theme2"] {
		t.Fatalf("missing repos: %v", repos)
	}
	var _ []theme.Entry = payloads // type contract check
}

func TestListPayloadsSkipsIncompleteAndUnparsable(t *testing.T) {
	c := openTest(t)
	// Row missing colorscheme key.
	if err := c.UpsertRepo("owner/inc", "2024-01-01", map[string]any{"name": "x", "repo": "y"}, nil); err != nil {
		t.Fatal(err)
	}
	// Unparsable payload_json smuggled in via direct SQL.
	if err := c.ensureSchema(); err != nil {
		t.Fatal(err)
	}
	if _, err := c.db.Exec(`INSERT INTO repo_cache (repo, updated_at, scanned_at, payload_json) VALUES ('owner/junk', '', 0, '{not json')`); err != nil {
		t.Fatal(err)
	}
	payloads, err := c.ListPayloads()
	if err != nil || len(payloads) != 0 {
		t.Fatalf("incomplete rows must be skipped: %v %v", payloads, err)
	}
}

func TestListAll(t *testing.T) {
	c := openTest(t)
	if err := c.UpsertRepo("owner/a", "2024-01-01", makePayload("a"), nil); err != nil {
		t.Fatal(err)
	}
	rows, err := c.ListAll()
	if err != nil || len(rows) != 1 || rows[0].Repo != "owner/a" {
		t.Fatalf("listAll: %+v %v", rows, err)
	}
}

func TestReadmeRoundtrip(t *testing.T) {
	c := openTest(t)
	content, err := c.ReadReadme("owner/r")
	if err != nil || content != nil {
		t.Fatalf("miss should be nil,nil: %v %v", content, err)
	}
	if v, _ := c.ShouldRefreshReadme("owner/r", 7); !v {
		t.Fatal("uncached readme must refresh")
	}
	if err := c.UpsertReadme("owner/r", "# hello"); err != nil {
		t.Fatal(err)
	}
	content, err = c.ReadReadme("owner/r")
	if err != nil || content == nil || *content != "# hello" {
		t.Fatalf("readme roundtrip failed: %v %v", content, err)
	}
	if v, _ := c.ShouldRefreshReadme("owner/r", 7); v {
		t.Fatal("cached readme must not refresh")
	}
	// Upsert over existing repo keeps repo fields but updates readme.
	if err := c.UpsertRepo("owner/r", "2024-02-02", makePayload("r"), nil); err != nil {
		t.Fatal(err)
	}
	if err := c.UpsertReadme("owner/r", "# v2"); err != nil {
		t.Fatal(err)
	}
	row, _ := c.ReadRepo("owner/r")
	if row.UpdatedAt != "2024-02-02" {
		t.Fatalf("upsertReadme must not clobber repo fields: %+v", row)
	}
	if content, _ := c.ReadReadme("owner/r"); content == nil || *content != "# v2" {
		t.Fatalf("readme overwrite failed: %v", content)
	}
}

// Schema byte-compatibility: an existing DB with the legacy shape (no readme
// columns) migrates lazily without data loss; a fresh one has the full shape.
func TestSchemaMigrationFromLegacy(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "legacy.db")

	// Create the pre-readme legacy table by hand.
	raw, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE, 0o644)
	if err != nil {
		t.Fatal(err)
	}
	raw.Close()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.db.Exec(`CREATE TABLE IF NOT EXISTS repo_cache (repo TEXT PRIMARY KEY, updated_at TEXT NOT NULL, scanned_at INTEGER NOT NULL, payload_json TEXT NOT NULL, parse_error TEXT NULL)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.db.Exec(`INSERT INTO repo_cache (repo, updated_at, scanned_at, payload_json) VALUES ('owner/old', '2024-03-03', 42, '{"name":"old"}')`); err != nil {
		t.Fatal(err)
	}
	db.Close()

	// Reopen through the public API: lazy migration must preserve the row.
	c, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	row, err := c.ReadRepo("owner/old")
	if err != nil || row == nil || row.ScannedAt != 42 {
		t.Fatalf("legacy row lost across migration: %+v %v", row, err)
	}
	if err := c.UpsertReadme("owner/old", "readme"); err != nil {
		t.Fatalf("migration did not add readme columns: %v", err)
	}
}

func TestOpenCreatesParentDirsAndFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "nested", "sub", "test.db")
	c, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	// modernc sqlite creates the file lazily; the first schema ensure must.
	if err := c.ensureSchema(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("db file not created: %v", err)
	}
}
