package theme

import (
	"math"
	"regexp"

	"github.com/raulcorreia7/theme-browser-registry/internal/gh"
)

// Ported verbatim from src/detect/strategy.ts. StrategyType constants live in
// internal/detect; here strategies are plain strings.

// Signal is one detection signal: a strategy vote with a score and reason.
type Signal struct {
	Strategy string  `json:"strategy"`
	Score    float64 `json:"score"`
	Reason   string  `json:"reason"`
}

// DetectionResult is the full outcome of DetectFromText.
type DetectionResult struct {
	Detected              string   `json:"detected"`
	Confidence            float64  `json:"confidence"`
	Signals               []Signal `json:"signals"`
	NeedsSourceInspection bool     `json:"needsSourceInspection"`
}

// PartialDetection is the InspectSource outcome (no inspection flag).
type PartialDetection struct {
	Detected   string   `json:"detected"`
	Confidence float64  `json:"confidence"`
	Signals    []Signal `json:"signals"`
}

const (
	highConfidenceThreshold = 0.9
	minConfidenceThreshold  = 0.5
)

var score = map[string]float64{
	"requireLoad":               8,
	"loadPattern":               2,
	"requireSetup":              6,
	"setupOptions":              2,
	"colorschemeUsage":          4,
	"vimGGlobals":               3,
	"fileStrategy":              2,
	"colorsVimOnly":             6,
	"luaModuleWithColors":       4,
	"colorsLuaOnly":             5,
	"pluginWithLua":             3,
	"luaNoColors":               4,
	"bonusLoadOverSetup":        2,
	"bonusSetupOverColorscheme": 3,
}

var re = map[string]*regexp.Regexp{
	"requireLoad":       regexp.MustCompile(`(?i)require\(["'][^"']+["']\)\.load\s*\(`),
	"loadPattern":       regexp.MustCompile(`(?i)\.load\s*\(\s*{?`),
	"requireCall":       regexp.MustCompile(`(?i)require\(`),
	"requireSetup":      regexp.MustCompile(`(?i)require\(["'][^"']+["']\)\.setup\s*\(`),
	"setupOptions":      regexp.MustCompile(`(?i)setup\s*\(\s*\{[\s\S]*?\}\s*\)`),
	"colorschemeCmd":    regexp.MustCompile(`(?i):?colorscheme\s+[a-z0-9_.-]+`),
	"vimCmdColorscheme": regexp.MustCompile(`(?i)vim\.cmd\s*\(\s*["']colorscheme\s+[a-z0-9_.-]+["']\s*\)`),
	"vimCmdDotScheme":   regexp.MustCompile(`(?i)vim\.cmd\.colorscheme\s*\(\s*["'][a-z0-9_.-]+["']\s*\)`),
	"vimGGlobal":        regexp.MustCompile(`(?i)let\s+g:[a-z_]+\s*=`),
	"backgroundMode":    regexp.MustCompile(`(?i)background\s*=\s*["'](dark|light)["']`),
	"customOrdering":    regexp.MustCompile(`(?i)before\s+loading|after\s+loading|must\s+set\s+global`),
	"luaModule":         regexp.MustCompile(`(?i)^lua/[^/]+/init\.lua$`),
	"luaSingle":         regexp.MustCompile(`(?i)^lua/[^/]+\.lua$`),
	"colorsLua":         regexp.MustCompile(`(?i)^colors/.+\.lua$`),
	"colorsVim":         regexp.MustCompile(`(?i)^colors/.+\.vim$`),
	"pluginLua":         regexp.MustCompile(`(?i)^plugin/.+\.lua$`),
}

// computeDetection sums per-strategy scores, applies the two bonuses, and
// derives confidence as min(1, top/10 + delta/10). Ties keep the TS tally
// insertion order (setup, load, colorscheme, file).
func computeDetection(signals []Signal) (string, float64) {
	tallyOrder := []string{"setup", "load", "colorscheme", "file"}
	tally := map[string]float64{}
	for _, k := range tallyOrder {
		tally[k] = 0
	}
	for _, s := range signals {
		tally[s.Strategy] += s.Score
	}

	if tally["load"] > 0 && tally["setup"] > 0 && tally["load"] >= tally["setup"] {
		tally["load"] += score["bonusLoadOverSetup"]
	}
	if tally["setup"] > 0 && tally["colorscheme"] > 0 {
		tally["setup"] += score["bonusSetupOverColorscheme"]
	}

	type rankedEntry struct {
		key string
		val float64
	}
	ranked := make([]rankedEntry, 0, len(tallyOrder))
	for _, k := range tallyOrder { // stable order preserved by construction
		if tally[k] != 0 {
			ranked = append(ranked, rankedEntry{k, tally[k]})
		}
	}
	// stable insertion sort by score desc
	for i := 1; i < len(ranked); i++ {
		for j := i; j > 0 && ranked[j].val > ranked[j-1].val; j-- {
			ranked[j], ranked[j-1] = ranked[j-1], ranked[j]
		}
	}

	var top, second rankedEntry
	if len(ranked) > 0 {
		top = ranked[0]
	}
	if len(ranked) > 1 {
		second = ranked[1]
	}

	if top.val == 0 {
		return "unknown", 0
	}

	delta := math.Max(0, top.val-second.val)
	confidence := math.Min(1, top.val/10+delta/10)
	return top.key, confidence
}

// DetectFromText ports src/detect/strategy.ts detectFromText.
func DetectFromText(readme string) DetectionResult {
	var signals []Signal

	hasRequireCall := re["requireCall"].MatchString(readme)
	colorschemeCmd := re["colorschemeCmd"].MatchString(readme)

	if re["requireLoad"].MatchString(readme) {
		signals = append(signals, Signal{"load", score["requireLoad"], "README contains require(...).load(...)"})
	}
	if re["loadPattern"].MatchString(readme) && hasRequireCall {
		signals = append(signals, Signal{"load", score["loadPattern"], "README shows .load() pattern"})
	}

	if re["requireSetup"].MatchString(readme) {
		signals = append(signals, Signal{"setup", score["requireSetup"], "README contains require(...).setup(...)"})
	}
	if re["setupOptions"].MatchString(readme) {
		signals = append(signals, Signal{"setup", score["setupOptions"], "README shows setup({...}) options block"})
	}

	if colorschemeCmd {
		signals = append(signals, Signal{"colorscheme", score["colorschemeUsage"], "README shows :colorscheme usage"})
	}
	if re["vimCmdColorscheme"].MatchString(readme) {
		signals = append(signals, Signal{"colorscheme", score["colorschemeUsage"], `README shows vim.cmd("colorscheme ...")`})
	}
	if re["vimCmdDotScheme"].MatchString(readme) {
		signals = append(signals, Signal{"colorscheme", score["colorschemeUsage"], "README shows vim.cmd.colorscheme(...)"})
	}

	if re["vimGGlobal"].MatchString(readme) && !hasRequireCall {
		signals = append(signals, Signal{"colorscheme", score["vimGGlobals"], "README shows vim.g globals without require()"})
	}

	if re["backgroundMode"].MatchString(readme) && colorschemeCmd {
		signals = append(signals, Signal{"file", score["fileStrategy"], "README suggests mode-dependent setup + colorscheme"})
	}
	if re["customOrdering"].MatchString(readme) {
		signals = append(signals, Signal{"file", score["fileStrategy"], "README suggests custom init ordering"})
	}

	detected, confidence := computeDetection(signals)
	if signals == nil {
		signals = []Signal{}
	}
	return DetectionResult{
		Detected:              detected,
		Confidence:            confidence,
		Signals:               signals,
		NeedsSourceInspection: detected == "unknown" || confidence < highConfidenceThreshold,
	}
}

func hasMatchingPath(paths []string, pattern *regexp.Regexp) bool {
	for _, p := range paths {
		if pattern.MatchString(p) {
			return true
		}
	}
	return false
}

// InspectSource ports src/detect/strategy.ts inspectSource.
func InspectSource(files []gh.TreeItem) PartialDetection {
	var paths []string
	for _, t := range files {
		if t.Type == "blob" {
			paths = append(paths, t.Path)
		}
	}

	hasLuaModule := hasMatchingPath(paths, re["luaModule"]) || hasMatchingPath(paths, re["luaSingle"])
	hasColorsLua := hasMatchingPath(paths, re["colorsLua"])
	hasColorsVim := hasMatchingPath(paths, re["colorsVim"])
	hasPluginDir := hasMatchingPath(paths, re["pluginLua"])

	var signals []Signal

	if hasColorsVim && !hasLuaModule && !hasColorsLua {
		signals = append(signals, Signal{"colorscheme", score["colorsVimOnly"], "Repo has colors/*.vim without Lua module"})
	}
	if hasLuaModule && hasColorsLua {
		signals = append(signals, Signal{"setup", score["luaModuleWithColors"], "Repo has Lua module + colors/*.lua"})
	}
	if hasColorsLua && !hasLuaModule {
		signals = append(signals, Signal{"colorscheme", score["colorsLuaOnly"], "Repo has colors/*.lua without Lua module"})
	}
	if hasPluginDir && hasLuaModule {
		signals = append(signals, Signal{"setup", score["pluginWithLua"], "Repo has plugin/ dir + Lua module"})
	}
	if hasLuaModule && !hasColorsLua && !hasColorsVim {
		signals = append(signals, Signal{"load", score["luaNoColors"], "Repo has Lua module without colors/"})
	}

	if len(signals) == 0 {
		signals = append(signals, Signal{Strategy: "unknown", Score: 0, Reason: "No clear signals from source"})
	}

	detected, confidence := computeDetection(signals)
	return PartialDetection{Detected: detected, Confidence: confidence, Signals: signals}
}

// MinConfidenceThreshold exposes the detect CONFIG threshold for the stage.
const MinConfidenceThreshold = minConfidenceThreshold
