package theme

import (
	"strings"
)

// Ported verbatim from src/build/index.ts dedupe ladder and
// src/build/themes.ts applyInferredModes.

func isNeovimTheme(repo string) bool {
	return strings.Contains(repo, ".nvim") || strings.Contains(repo, "neovim")
}

// DeduplicateThemes collapses entries whose names collide case-insensitively,
// keeping the winner of the preference chain: preferred repos > neovim repos
// > more stars > more variants. Output preserves first-seen name order.
func DeduplicateThemes(entries []Entry, preferredRepos []string) []Entry {
	preferred := map[string]bool{}
	for _, repo := range preferredRepos {
		trimmed := strings.ToLower(strings.TrimSpace(repo))
		if trimmed != "" {
			preferred[trimmed] = true
		}
	}

	order := []string{}           // lowercased names, first-seen order
	byName := map[string]*Entry{} // lowercased name -> winner
	for i := range entries {
		entry := &entries[i]
		if entry.Name == "" || !IsValidThemeName(entry.Name) {
			continue
		}
		nameLower := strings.ToLower(entry.Name)
		existing, ok := byName[nameLower]
		if !ok {
			byName[nameLower] = entry
			order = append(order, nameLower)
			continue
		}

		existingRepo := existing.Repo
		newRepo := entry.Repo
		existingPreferred := preferred[strings.ToLower(existingRepo)]
		newPreferred := preferred[strings.ToLower(newRepo)]
		existingNeovim := isNeovimTheme(existingRepo)
		newNeovim := isNeovimTheme(newRepo)
		existingStars := existing.Stars
		newStars := entry.Stars
		existingVariants := len(existing.Variants)
		newVariants := len(entry.Variants)

		newIsBetter := false
		switch {
		case newPreferred && !existingPreferred:
			newIsBetter = true
		case !newPreferred && existingPreferred:
			newIsBetter = false
		case newNeovim && !existingNeovim:
			newIsBetter = true
		case !newNeovim && existingNeovim:
			newIsBetter = false
		case newStars > existingStars:
			newIsBetter = true
		case newStars < existingStars:
			newIsBetter = false
		case newVariants > existingVariants:
			newIsBetter = true
		}

		if newIsBetter {
			byName[nameLower] = entry
		}
	}

	out := make([]Entry, 0, len(order))
	for _, name := range order {
		out = append(out, *byName[name])
	}
	return out
}

// ApplyInferredModes fills Meta.Mode from the base colorscheme (falling back
// to any existing meta mode) and each variant's mode from its colorscheme or
// name. Mirrors TS: a fresh meta object is always produced.
func ApplyInferredModes(entries []Entry) []Entry {
	out := make([]Entry, 0, len(entries))
	for _, entry := range entries {
		baseMode := InferModeFromColorscheme(entry.Colorscheme)

		variants := make([]Variant, 0, len(entry.Variants))
		for _, variant := range entry.Variants {
			if variant.Mode == "" {
				source := variant.Colorscheme
				if source == "" {
					source = variant.Name
				}
				if inferred := InferModeFromColorscheme(source); inferred != nil {
					variant.Mode = *inferred
				}
			}
			variants = append(variants, variant)
		}
		if len(variants) == 0 {
			variants = nil
		}

		meta := &Meta{}
		if entry.Meta != nil {
			meta.Strategy = entry.Meta.Strategy
			meta.Mode = entry.Meta.Mode
		}
		if baseMode != nil {
			meta.Mode = *baseMode
		}

		entry.Meta = meta
		entry.Variants = variants
		out = append(out, entry)
	}
	return out
}
