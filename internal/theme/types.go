// Package theme defines the data spine shared by every pipeline stage.
//
// JSON tags are the cross-repo wire contract: index.json, overrides.json,
// artifacts/themes.json and the published manifest are consumed by
// theme-browser.nvim and must stay byte-compatible with the TypeScript
// implementation this package replaces.
package theme

// Mode is a theme brightness mode. Empty means unknown/omitted.
type Mode string

const (
	ModeDark  Mode = "dark"
	ModeLight Mode = "light"
)

// StrategyRef mirrors meta.strategy on entries and variants.
type StrategyRef struct {
	Type   string `json:"type,omitempty"`
	Module string `json:"module,omitempty"`
	File   string `json:"file,omitempty"`
}

// Meta is the optional metadata block carried through index/override rows.
type Meta struct {
	Strategy *StrategyRef `json:"strategy,omitempty"`
	Mode     Mode         `json:"mode,omitempty"`
}

// Variant is a colorscheme variant attached to an entry (index/cache shape).
type Variant struct {
	Name        string       `json:"name"`
	Colorscheme string       `json:"colorscheme,omitempty"`
	Mode        Mode         `json:"mode,omitempty"`
	Meta        *StrategyRef `json:"meta,omitempty"` // TS serialized variant strategy flat; see OutputVariant
}

// Entry is the ThemeEntry shape used by index.json, overrides and cache payloads.
type Entry struct {
	Name        string    `json:"name"`
	Colorscheme string    `json:"colorscheme"`
	Repo        string    `json:"repo,omitempty"`
	Description string    `json:"description,omitempty"`
	Stars       int       `json:"stars,omitempty"`
	Topics      []string  `json:"topics,omitempty"`
	UpdatedAt   string    `json:"updated_at,omitempty"`
	Archived    bool      `json:"archived,omitempty"`
	Disabled    bool      `json:"disabled,omitempty"`
	Builtin     bool      `json:"builtin,omitempty"`
	Meta        *Meta     `json:"meta,omitempty"`
	Variants    []Variant `json:"variants,omitempty"`
}

// WithMeta is an alias kept for stage-signature readability; Entry already
// carries Meta so both shapes unify here.
type WithMeta = Entry

// OutputVariant is a row of artifacts/themes.json "variants" array.
type OutputVariant struct {
	Name        string `json:"name"`
	Variant     string `json:"variant,omitempty"`
	Colorscheme string `json:"colorscheme,omitempty"`
	Mode        Mode   `json:"mode,omitempty"`
	ModeExempt  bool   `json:"modeExempt,omitempty"`
	Strategy    string `json:"strategy,omitempty"`
	Module      string `json:"module,omitempty"`
}

// Output is one row of artifacts/themes.json: the flattened consumer-facing
// shape. Mode/strategy/module are promoted to the top level exactly like the
// TypeScript builder produced them.
type Output struct {
	Name        string          `json:"name"`
	Colorscheme string          `json:"colorscheme,omitempty"`
	Repo        string          `json:"repo,omitempty"`
	Stars       int             `json:"stars,omitempty"`
	Mode        Mode            `json:"mode,omitempty"`
	Builtin     bool            `json:"builtin,omitempty"`
	Strategy    string          `json:"strategy,omitempty"`
	Module      string          `json:"module,omitempty"`
	Variants    []OutputVariant `json:"variants,omitempty"`
}

// Manifest is the published manifest.json payload shipped beside themes.json.
type Manifest struct {
	Version     string `json:"version"`
	Count       int    `json:"count"`
	GeneratedAt string `json:"generated_at"`
	SHA256      string `json:"sha256"`
}
