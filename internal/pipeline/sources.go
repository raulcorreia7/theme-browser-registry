package pipeline

// sources.go ports src/lib/sources.ts path resolution helpers verbatim.

import (
	"os"
	"path/filepath"
)

// ResolveOverridesPathFromSourcesDir mirrors resolveOverridesPathFromSourcesDir:
// <sourcesDir>/overrides.json when it exists, else <sourcesDir>/../overrides.json.
func ResolveOverridesPathFromSourcesDir(sourcesDir string) string {
	local := filepath.Join(sourcesDir, "overrides.json")
	if fileExists(local) {
		return local
	}
	return filepath.Join(sourcesDir, "..", "overrides.json")
}

// ResolveHintsPathFromOverridesPath mirrors resolveHintsPathFromOverridesPath:
// <dir>/hints.json when it exists, else <dir>/sources/hints.json.
func ResolveHintsPathFromOverridesPath(overridesPath string) string {
	dir := filepath.Dir(overridesPath)
	local := filepath.Join(dir, "hints.json")
	if fileExists(local) {
		return local
	}
	return filepath.Join(dir, "sources", "hints.json")
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
