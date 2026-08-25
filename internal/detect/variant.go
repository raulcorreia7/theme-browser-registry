package detect

import (
	"fmt"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

// Variant coverage sources (SOURCE constants in src/detect/variant.ts).
const (
	SourcePattern = "pattern"
	SourceHint    = "hint"
	SourceReadme  = "readme"
	SourceUnknown = "unknown"
)

// DetectVariantModesFromNames ports detectVariantModesFromNames: pattern
// detection over variant names via theme.InferThemeMode. Only the name is
// consulted, exactly like the TypeScript implementation.
func DetectVariantModesFromNames(variants []theme.Variant) []VariantModeResult {
	if len(variants) == 0 {
		return []VariantModeResult{}
	}

	results := make([]VariantModeResult, 0, len(variants))
	for _, v := range variants {
		inf := theme.InferThemeMode(v.Name)
		if inf == nil {
			results = append(results, VariantModeResult{
				Name:       v.Name,
				Confidence: 0,
				Source:     SourceUnknown,
			})
			continue
		}

		if inf.Confidence < HighConfidenceThreshold {
			results = append(results, VariantModeResult{
				Name:       v.Name,
				Confidence: inf.Confidence,
				Source:     SourceUnknown,
				Reason:     fmt.Sprintf("Low-confidence pattern match: %s", inf.Reason),
			})
			continue
		}

		results = append(results, VariantModeResult{
			Name:         v.Name,
			DetectedMode: inf.Mode,
			Confidence:   inf.Confidence,
			Source:       SourcePattern,
			Reason:       inf.Reason,
		})
	}
	return results
}

// ApplyVariantHints ports applyVariantHints: manual hints win over pattern
// matches with confidence 1.0.
func ApplyVariantHints(results []VariantModeResult, hints map[string]theme.Mode) []VariantModeResult {
	out := make([]VariantModeResult, len(results))
	copy(out, results)
	for i := range out {
		hint := theme.ResolveModeHint(out[i].Name, hints)
		if hint == nil {
			continue
		}
		reason := "Manual hint override"
		if hint.NormalizedMatch {
			reason = fmt.Sprintf("Manual hint override (normalized match: %s)", hint.MatchedKey)
		}
		out[i].DetectedMode = hint.Mode
		out[i].Confidence = 1.0
		out[i].Source = SourceHint
		out[i].Reason = reason
	}
	return out
}
