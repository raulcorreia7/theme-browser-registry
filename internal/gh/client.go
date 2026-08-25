// Package gh abstracts the GitHub reads the pipeline needs. The live adapter
// wraps go-github with fixed-interval pacing; tests use httptest fakes.
package gh

import "context"

// RepoItem is the normalized repository metadata used across stages.
// Field names match the JSON the TypeScript client produced internally.
type RepoItem struct {
	ID          int64    `json:"id"`
	FullName    string   `json:"full_name"`
	Description *string  `json:"description"`
	Stargazers  int      `json:"stargazers_count"`
	Topics      []string `json:"topics"`
	UpdatedAt   string   `json:"updated_at"`
	Archived    bool     `json:"archived"`
	Disabled    bool     `json:"disabled"`
	HTMLURL     string   `json:"html_url"`
	DefaultBr   string   `json:"default_branch,omitempty"`
}

// TreeItem is one entry of a repo git tree.
type TreeItem struct {
	Path string `json:"path"`
	Type string `json:"type"` // "blob" | "tree"
}

// RepoPage is one page of topic search results. HasNext mirrors the TS
// heuristic: len(items) == perPage.
type RepoPage struct {
	Items   []RepoItem `json:"items"`
	HasNext bool       `json:"hasNext"`
}

// Client is the GitHub read seam for sync and detect. Implementations must:
//   - return (nil, nil) / empty slices for 404s (matching the TS client),
//   - never retry 401 or 404,
//   - pace requests at a fixed interval (default 250ms) regardless of token.
type Client interface {
	SearchRepositories(ctx context.Context, topic string, page, perPage, minStars int) (RepoPage, error)
	Repository(ctx context.Context, repo string) (*RepoItem, error)
	Tree(ctx context.Context, repo, ref string) ([]TreeItem, error)
	Readme(ctx context.Context, repo string) (*string, error)
}
