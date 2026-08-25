package pipeline

// rank.go ports the writeTopThemes scoring from tasks/pipeline.ts. Unlike the
// old bundle.ts scorer it reads top-level Mode on flattened Output rows (the
// meta.mode blind-spot fix called out in the rewrite plan).

import (
	"sort"

	"github.com/raulcorreia7/theme-browser-registry/internal/theme"
)

// themeModes collects top-level plus variant modes.
func themeModes(row theme.Output) map[theme.Mode]bool {
	modes := map[theme.Mode]bool{}
	if row.Mode != "" {
		modes[row.Mode] = true
	}
	for _, v := range row.Variants {
		if v.Mode != "" {
			modes[v.Mode] = true
		}
	}
	return modes
}

func scoreOutput(row theme.Output) float64 {
	score := float64(row.Stars)
	modes := themeModes(row)
	switch {
	case modes[theme.ModeDark] && modes[theme.ModeLight]:
		score *= 1.5
	case modes[theme.ModeDark]:
		score *= 1.2
	}
	if len(row.Variants) > 0 {
		score *= 1.1
	}
	return score
}

// Rank filters rows without stars, scores them (dual-mode *1.5, dark-only
// *1.2, has-variants *1.1), sorts by score desc with stars desc as tiebreak,
// slices to n and finally name-sorts.
func Rank(rows []theme.Output, n int) []theme.Output {
	type scored struct {
		row   theme.Output
		score float64
	}
	var list []scored
	for _, r := range rows {
		if r.Stars != 0 { // TS: typeof theme.stars === "number"; zero stars are omitted by the wire format
			list = append(list, scored{r, scoreOutput(r)})
		}
	}

	sort.SliceStable(list, func(i, j int) bool {
		if list[i].score != list[j].score {
			return list[i].score > list[j].score
		}
		return list[i].row.Stars > list[j].row.Stars
	})
	if n >= 0 && n < len(list) {
		list = list[:n]
	}
	out := make([]theme.Output, 0, len(list))
	for _, s := range list {
		out = append(out, s.row)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}
