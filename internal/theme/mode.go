package theme

import (
	"errors"
	"fmt"
	"sort"
	"strings"
)

// Ported verbatim from src/lib/mode.ts. Heuristics must not drift: the
// golden fixtures under testdata/golden/expected/functions are the oracle.

const AutoApplyModeConfidence = 0.9

// ModeInference is the outcome of inferring a brightness mode from a name.
type ModeInference struct {
	Mode       Mode    `json:"mode"`
	Confidence float64 `json:"confidence"`
	Level      string  `json:"confidenceLevel"` // high | medium | low
	Reason     string  `json:"reason"`
}

// ResolvedHint is a mode-hint lookup result for a variant name.
type ResolvedHint struct {
	Mode            Mode   `json:"mode"`
	MatchedKey      string `json:"matchedKey"`
	NormalizedMatch bool   `json:"normalizedMatch"`
}

type tokenWeight struct {
	token  string
	weight int
}

var lightTokens = []tokenWeight{
	{"light", 3}, {"day", 3}, {"dawn", 3}, {"operandi", 3}, {"latte", 3},
	{"sun", 3}, {"morning", 2}, {"white", 2}, {"paper", 2}, {"cream", 2},
	{"snow", 2}, {"lumi", 1}, {"bright", 1},
}

var darkTokens = []tokenWeight{
	{"dark", 3}, {"night", 3}, {"vivendi", 3}, {"moon", 3}, {"storm", 3},
	{"mocha", 3}, {"frappe", 3}, {"macchiato", 3}, {"shadow", 2},
	{"midnight", 2}, {"abyss", 2}, {"dusk", 2}, {"deep", 1}, {"black", 1},
	{"dragon", 1}, {"wave", 1}, {"ember", 1}, {"fog", 1}, {"moss", 1},
}

var compactLightExclusions = map[string]bool{
	"twilight": true, "starlight": true, "moonlight": true,
	"spotlight": true, "limelight": true, "highlight": true,
}

// stripTrailingStyleModifiers replicates
// /[-_](bold|italic|dim|dimmed|soft|hard|mono|minimal|default|main|opaque|
// transparent|contrast|highcontrast)$/ applied repeatedly.
var styleModifiers = []string{
	"bold", "italic", "dim", "dimmed", "soft", "hard", "mono", "minimal",
	"default", "main", "opaque", "transparent", "contrast", "highcontrast",
}

func stripTrailingStyleModifiers(value string) string {
	for {
		stripped := false
		for _, mod := range styleModifiers {
			suffix := "_" + mod
			if strings.HasSuffix(value, suffix) || strings.HasSuffix(value, "-"+mod) {
				if len(value) > len(suffix) {
					value = value[:len(value)-len(suffix)]
					stripped = true
					break
				}
			}
		}
		if !stripped {
			return value
		}
	}
}

// hasBoundaryToken replicates new RegExp(`(^|[-_])token($|[-_])`).test(text).
func hasBoundaryToken(text, token string) bool {
	for i := 0; ; {
		idx := strings.Index(text[i:], token)
		if idx < 0 {
			return false
		}
		start := i + idx
		end := start + len(token)
		startOK := start == 0 || text[start-1] == '-' || text[start-1] == '_'
		endOK := end == len(text) || text[end] == '-' || text[end] == '_'
		if startOK && endOK {
			return true
		}
		i = start + 1
	}
}

func hasTerminalBoundaryToken(text, token string) bool {
	if !strings.HasSuffix(text, token) {
		return false
	}
	head := text[:len(text)-len(token)]
	return head == "" || head[len(head)-1] == '-' || head[len(head)-1] == '_'
}

func hasCompactTerminalLight(text string) bool {
	if !strings.HasSuffix(text, "light") {
		return false
	}
	if strings.HasSuffix(text, "-light") || strings.HasSuffix(text, "_light") {
		return false
	}
	for excluded := range compactLightExclusions {
		if strings.HasSuffix(text, excluded) {
			return false
		}
	}
	return true
}

func hasCompactTerminalDark(text string) bool {
	if !strings.HasSuffix(text, "dark") {
		return false
	}
	return !strings.HasSuffix(text, "-dark") && !strings.HasSuffix(text, "_dark")
}

type tokenScore struct {
	score             int
	strongestTerminal int
	labels            []string
}

func scoreTokens(text string, tokens []tokenWeight) tokenScore {
	ts := tokenScore{labels: []string{}}
	for _, tw := range tokens {
		if !hasBoundaryToken(text, tw.token) {
			continue
		}
		ts.score += tw.weight
		ts.labels = append(ts.labels, tw.token)
		if hasTerminalBoundaryToken(text, tw.token) && tw.weight > ts.strongestTerminal {
			ts.strongestTerminal = tw.weight
		}
	}
	return ts
}

func confidenceFromScores(dominant, runnerUp int) (float64, string) {
	delta := dominant - runnerUp
	switch {
	case dominant >= 3 && delta >= 2:
		return 0.95, "high"
	case dominant >= 2 && delta >= 1:
		return 0.8, "medium"
	default:
		return 0.65, "low"
	}
}

// InferThemeMode ports src/lib/mode.ts inferThemeMode. Returns nil when the
// TS implementation returned undefined (empty name or no signal at all).
func InferThemeMode(name string) *ModeInference {
	normalized := strings.ToLower(strings.TrimSpace(name))
	if normalized == "" {
		return nil
	}

	const b16 = "base16-"
	isBase16 := strings.HasPrefix(normalized, b16)
	endsLight := strings.HasSuffix(normalized, "-light")
	// /^base16-.+-light$/ : at least one char between prefix and -light.
	if isBase16 && endsLight && len(normalized) > len(b16)+len("-light") {
		return &ModeInference{Mode: ModeLight, Confidence: 1, Level: "high", Reason: "Base16 light variant pattern"}
	}
	// /^base16-(?!.*-light$).+$/ : non-empty remainder that does not end -light.
	if isBase16 && !endsLight && len(normalized) > len(b16) {
		return &ModeInference{Mode: ModeDark, Confidence: 0.95, Level: "high", Reason: "Base16 dark variant pattern"}
	}

	stripped := stripTrailingStyleModifiers(normalized)
	light := scoreTokens(stripped, lightTokens)
	dark := scoreTokens(stripped, darkTokens)

	if hasCompactTerminalLight(stripped) {
		light.score += 2
		if light.strongestTerminal < 2 {
			light.strongestTerminal = 2
		}
		light.labels = append(light.labels, "light(compact)")
	}
	if hasCompactTerminalDark(stripped) {
		dark.score += 2
		if dark.strongestTerminal < 2 {
			dark.strongestTerminal = 2
		}
		dark.labels = append(dark.labels, "dark(compact)")
	}

	if light.score == 0 && dark.score == 0 {
		return nil
	}

	if light.score > 0 && dark.score > 0 {
		terminalDelta := light.strongestTerminal - dark.strongestTerminal
		if terminalDelta >= 2 {
			conf, level := confidenceFromScores(light.score, dark.score)
			return &ModeInference{
				Mode: ModeLight, Confidence: conf, Level: level,
				Reason: fmt.Sprintf("Light tokens dominate (%s)", strings.Join(light.labels, ", ")),
			}
		}
		if terminalDelta <= -2 {
			conf, level := confidenceFromScores(dark.score, light.score)
			return &ModeInference{
				Mode: ModeDark, Confidence: conf, Level: level,
				Reason: fmt.Sprintf("Dark tokens dominate (%s)", strings.Join(dark.labels, ", ")),
			}
		}
		return nil
	}

	mode := ModeDark
	if light.score > dark.score {
		mode = ModeLight
	}
	dominant, runnerUp := dark, light
	if mode == ModeLight {
		dominant, runnerUp = light, dark
	}
	conf, level := confidenceFromScores(dominant.score, runnerUp.score)
	label := "Dark"
	if mode == ModeLight {
		label = "Light"
	}
	return &ModeInference{
		Mode: mode, Confidence: conf, Level: level,
		Reason: fmt.Sprintf("%s tokens matched (%s)", label, strings.Join(dominant.labels, ", ")),
	}
}

// NormalizeModeHintKey lowercases and keeps only [a-z0-9].
func NormalizeModeHintKey(name string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(name)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// MergeModeHintRecords folds incoming hints into existing, keyed by their
// normalized form. Conflicting modes for the same normalized key are an error.
func MergeModeHintRecords(repo string, existing, incoming map[string]Mode) (map[string]Mode, error) {
	merged := make(map[string]Mode, len(existing)+len(incoming))
	index := make(map[string]string, len(existing)+len(incoming))
	for k, v := range existing {
		merged[k] = v
		index[NormalizeModeHintKey(k)] = k
	}

	keys := make([]string, 0, len(incoming))
	for k := range incoming {
		keys = append(keys, k)
	}
	sort.Strings(keys) // deterministic conflict order

	for _, k := range keys {
		mode := incoming[k]
		normalized := NormalizeModeHintKey(k)
		existingKey, hit := index[normalized]
		if !hit {
			merged[k] = mode
			index[normalized] = k
			continue
		}
		if merged[existingKey] != mode {
			return nil, fmt.Errorf("Conflicting mode hints for %s/%s: %s vs %s", repo, k, merged[existingKey], mode)
		}
	}
	return merged, nil
}

// ResolveModeHint looks up an exact hint first, then a normalized match.
func ResolveModeHint(variantName string, hints map[string]Mode) *ResolvedHint {
	if mode, ok := hints[variantName]; ok {
		return &ResolvedHint{Mode: mode, MatchedKey: variantName, NormalizedMatch: false}
	}
	normalized := NormalizeModeHintKey(variantName)
	if normalized == "" {
		return nil
	}
	keys := make([]string, 0, len(hints))
	for k := range hints {
		keys = append(keys, k)
	}
	sort.Strings(keys) // deterministic match order
	for _, k := range keys {
		if NormalizeModeHintKey(k) == normalized {
			return &ResolvedHint{Mode: hints[k], MatchedKey: k, NormalizedMatch: true}
		}
	}
	return nil
}

var errInvalidRepoPayload = errors.New("invalid repository payload")

// InferModeFromColorscheme returns nil below the auto-apply threshold (0.9).
func InferModeFromColorscheme(colorscheme string) *Mode {
	inference := InferThemeMode(colorscheme)
	if inference == nil || inference.Confidence < AutoApplyModeConfidence {
		return nil
	}
	mode := inference.Mode
	return &mode
}
