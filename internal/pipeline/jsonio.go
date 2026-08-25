package pipeline

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
	"github.com/raulcorreia7/theme-browser-registry/internal/version"
)

// now is the clock seam used by manifest generation. Tests override it to
// freeze generated_at (golden fixtures use 1970-01-01T00:00:00.000Z).
var now = time.Now

// tsISO formats a time exactly like JavaScript Date.prototype.toISOString().
func tsISO(t time.Time) string {
	return t.UTC().Format("2006-01-01T15:04:05.000Z07:00")
}

// writeJSON writes v as MarshalIndent(v, "", "  ") + "\n", creating parent
// directories — the single formatting every stage shares.
func writeJSON(path string, v any) error {
	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create dir %s: %w", dir, err)
		}
	}
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal %s: %w", path, err)
	}
	b = append(b, '\n')
	if err := os.WriteFile(path, b, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

// sha256File returns the hex digest of the file's raw bytes, matching the TS
// createHash("sha256").update(readFileSync(p)) checkpoint writer.
func sha256File(path string) (string, []byte, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", nil, err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), raw, nil
}

// buildManifest is the shared manifest payload used both by the WriteManifest
// stage and the sync batch checkpoints (src/db/files.ts writeManifest).
func buildManifest(manifestPath, outputPath string, count int) (theme.Manifest, error) {
	sum, _, err := sha256File(outputPath)
	if err != nil {
		return theme.Manifest{}, fmt.Errorf("checksum %s: %w", outputPath, err)
	}
	m := theme.Manifest{
		Version:     version.String(),
		Count:       count,
		GeneratedAt: tsISO(now()),
		SHA256:      sum,
	}
	if err := writeJSON(manifestPath, m); err != nil {
		return theme.Manifest{}, err
	}
	return m, nil
}
