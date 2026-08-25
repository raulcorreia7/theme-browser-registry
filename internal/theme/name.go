package theme

import (
	"regexp"
	"strings"
)

// Ported verbatim from src/sync/parser.ts naming rules and
// src/build/themes.ts isValidThemeName.

var (
	reTrimDashes = regexp.MustCompile(`^[-_]+|[-_]+$`)
	reValidName  = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
)

var suffixesToStrip = []string{
	".nvim", ".vim", ".lua",
	"-nvim", "_nvim", "-vim", "_vim",
	"-colorscheme",
}

var invalidThemeNames = map[string]bool{
	"": true, "nvim": true, "vim": true, "neovim": true,
	"theme": true, "colorscheme": true,
}

const defaultFallbackName = "theme"

func sanitizeRepoName(repoName string) string {
	candidate := strings.ToLower(strings.TrimSpace(repoName))
	for _, suffix := range suffixesToStrip {
		if strings.HasSuffix(candidate, suffix) && len(candidate) > len(suffix) {
			candidate = candidate[:len(candidate)-len(suffix)]
		}
	}
	return reTrimDashes.ReplaceAllString(candidate, "")
}

// NormalizeThemeName derives the theme name from an "owner/repo" full name.
func NormalizeThemeName(fullRepo string) string {
	slashIndex := strings.Index(fullRepo, "/")
	var owner, repoName string
	if slashIndex >= 0 {
		owner, repoName = fullRepo[:slashIndex], fullRepo[slashIndex+1:]
	} else {
		repoName = fullRepo
	}

	cleanedRepo := sanitizeRepoName(repoName)

	if invalidThemeNames[cleanedRepo] {
		if fallback := sanitizeRepoName(owner); fallback != "" {
			return fallback
		}
	}

	if cleanedRepo != "" {
		return cleanedRepo
	}
	if fallback := sanitizeRepoName(owner); fallback != "" {
		return fallback
	}
	return defaultFallbackName
}

const (
	themeNameMinLength = 2
	themeNameMaxLength = 64
)

// IsValidThemeName ports src/build/themes.ts isValidThemeName.
func IsValidThemeName(name string) bool {
	if name == "" {
		return false
	}
	if len(name) < themeNameMinLength || len(name) > themeNameMaxLength {
		return false
	}
	if name[0] == '.' {
		return false
	}
	return reValidName.MatchString(name)
}
