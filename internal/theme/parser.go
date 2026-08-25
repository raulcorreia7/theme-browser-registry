package theme

import (
	"regexp"
	"sort"
	"strings"

	"github.com/raulcorreia7/theme-browser-registry/internal/gh"
)

// Ported verbatim from src/sync/parser.ts extractColorschemes/buildEntry.

var reColorsFile = regexp.MustCompile(`^colors/([^/]+)\.(vim|lua)$`)

// ExtractColorschemes collects colorscheme base names from a repo git tree:
// blobs matching ^colors/<name>.(vim|lua)$, deduped and sorted.
func ExtractColorschemes(items []gh.TreeItem) []string {
	colors := map[string]bool{}
	for _, item := range items {
		if item.Type != "blob" {
			continue
		}
		m := reColorsFile.FindStringSubmatch(item.Path)
		if m == nil || m[1] == "" {
			continue
		}
		name := strings.TrimSpace(m[1])
		if name != "" {
			colors[name] = true
		}
	}
	out := make([]string, 0, len(colors))
	for name := range colors {
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

func pickBaseColorscheme(themeName string, colors []string) string {
	if len(colors) == 0 {
		return themeName
	}

	preferred := map[string]bool{
		themeName:                               true,
		strings.ReplaceAll(themeName, "-", "_"): true,
		strings.ReplaceAll(themeName, "_", "-"): true,
	}

	for _, candidate := range colors {
		if preferred[candidate] {
			return candidate
		}
	}
	for _, candidate := range colors {
		if !strings.Contains(candidate, "-") && !strings.Contains(candidate, "_") {
			return candidate
		}
	}
	return colors[0]
}

// BuildEntry converts a repository payload plus its tree-derived colorschemes
// into an index Entry. Errors when the full_name is not "owner/repo".
func BuildEntry(repo gh.RepoItem, colorschemes []string) (Entry, error) {
	fullName := repo.FullName
	if !strings.Contains(fullName, "/") {
		return Entry{}, errInvalidRepoPayload
	}

	themeName := NormalizeThemeName(fullName)
	baseColorscheme := pickBaseColorscheme(themeName, colorschemes)

	var variants []Variant
	for _, value := range colorschemes {
		if value == baseColorscheme {
			continue
		}
		v := Variant{Name: value, Colorscheme: value}
		if mode := InferModeFromColorscheme(value); mode != nil {
			v.Mode = *mode
		}
		variants = append(variants, v)
	}

	topics := make([]string, 0, len(repo.Topics))
	for _, t := range repo.Topics {
		if t != "" {
			topics = append(topics, t)
		}
	}
	if len(topics) == 0 {
		topics = nil
	}

	description := ""
	if repo.Description != nil {
		description = *repo.Description
	}

	entry := Entry{
		Name:        themeName,
		Repo:        fullName,
		Colorscheme: baseColorscheme,
		Description: description,
		Stars:       repo.Stargazers,
		Topics:      topics,
		UpdatedAt:   repo.UpdatedAt,
		Archived:    repo.Archived,
		Disabled:    repo.Disabled,
	}
	if len(variants) > 0 {
		entry.Variants = variants
	}
	return entry, nil
}
