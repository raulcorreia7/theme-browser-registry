// Package version exposes the registry version embedded from the VERSION file.
package version

import _ "embed"

//go:embed VERSION
var raw string

// String returns the registry semantic version (trimmed, e.g. "0.4.5").
func String() string {
	for len(raw) > 0 && (raw[len(raw)-1] == '\n' || raw[len(raw)-1] == ' ' || raw[len(raw)-1] == '\r') {
		raw = raw[:len(raw)-1]
	}
	return raw
}
