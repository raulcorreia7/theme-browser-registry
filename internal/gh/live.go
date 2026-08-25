package gh

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/go-github/v70/github"
)

// DefaultRequestDelay is the fixed interval between API requests, matching
// the TS client's default pacing.
const DefaultRequestDelay = 250 * time.Millisecond

// LiveOptions configures the live GitHub adapter.
type LiveOptions struct {
	Token      string                // falls back to GITHUB_TOKEN
	Delay      time.Duration         // default 250ms
	RetryLimit int                   // additional attempts after the first failure
	BaseURL    string                // override for httptest servers
	SleepFn    func(d time.Duration) // injectable for fast tests
}

// LiveClient implements Client against api.github.com with fixed-interval
// pacing and bounded retries (never 404/401).
type LiveClient struct {
	client     *github.Client
	delay      time.Duration
	retryLimit int
	sleep      func(time.Duration)

	mu              sync.Mutex
	nextRequestTime time.Time
}

// NewLiveClient builds the adapter. Token resolution: option, then the
// GITHUB_TOKEN environment variable.
func NewLiveClient(opts LiveOptions) *LiveClient {
	token := opts.Token
	if token == "" {
		token = strings.TrimSpace(os.Getenv("GITHUB_TOKEN"))
	}
	delay := opts.Delay
	if delay <= 0 {
		delay = DefaultRequestDelay
	}
	retryLimit := opts.RetryLimit
	if retryLimit < 0 {
		retryLimit = 0
	}
	sleep := opts.SleepFn
	if sleep == nil {
		sleep = time.Sleep
	}

	client := github.NewClient(nil)
	if token != "" {
		client = client.WithAuthToken(token)
	}
	if opts.BaseURL != "" {
		base, err := url.Parse(opts.BaseURL)
		if err == nil {
			client.BaseURL = base
			// Uploads base must also point at the test server.
			client.UploadURL = base
		}
	}
	return &LiveClient{
		client:     client,
		delay:      delay,
		retryLimit: retryLimit,
		sleep:      sleep,
	}
}

// waitForRateLimit sleeps until the next scheduled request slot.
func (c *LiveClient) waitForRateLimit() {
	c.mu.Lock()
	wait := time.Until(c.nextRequestTime)
	c.mu.Unlock()
	if wait > 0 {
		c.sleep(wait)
	}
}

// markRequest schedules the next request no earlier than delay from now,
// set AFTER each call like the TS client.
func (c *LiveClient) markRequest() {
	c.mu.Lock()
	c.nextRequestTime = time.Now().Add(c.delay)
	c.mu.Unlock()
}

// do executes fn with pacing and retries. 401/404 are never retried; a final
// 404 maps to nil so callers return their empty/absent shapes. Other errors
// are retried up to retryLimit times before being returned.
func (c *LiveClient) do(fn func() (*github.Response, error)) error {
	for attempt := 0; ; attempt++ {
		c.waitForRateLimit()
		resp, err := fn()
		c.markRequest()

		if err == nil {
			if resp != nil && resp.Body != nil {
				resp.Body.Close()
			}
			return nil
		}
		status := statusOf(err)
		switch status {
		case http.StatusNotFound, http.StatusUnauthorized:
			return err // never retried; caller maps 404 to empty
		}
		if attempt >= c.retryLimit {
			return fmt.Errorf("github request failed after %d attempts: %w", attempt+1, err)
		}
	}
}

func statusOf(err error) int {
	if respErr, ok := err.(*github.ErrorResponse); ok {
		return respErr.Response.StatusCode
	}
	return 0
}

// isNotFound reports whether err is a GitHub 404.
func isNotFound(err error) bool { return statusOf(err) == http.StatusNotFound }

func toRepoItem(r *github.Repository) RepoItem {
	item := RepoItem{
		ID:         r.GetID(),
		FullName:   r.GetFullName(),
		Stargazers: r.GetStargazersCount(),
		UpdatedAt:  r.GetUpdatedAt().Format("2006-01-02T15:04:05Z"),
		Archived:   r.GetArchived(),
		Disabled:   r.GetDisabled(),
		HTMLURL:    r.GetHTMLURL(),
		DefaultBr:  r.GetDefaultBranch(),
	}
	if r.Description != nil {
		d := *r.Description
		item.Description = &d
	}
	if topics := r.Topics; len(topics) > 0 {
		item.Topics = append([]string(nil), topics...)
	} else {
		item.Topics = []string{}
	}
	return item
}

// SearchRepositories queries repos by topic with the TS query shape.
func (c *LiveClient) SearchRepositories(ctx context.Context, topic string, page, perPage, minStars int) (RepoPage, error) {
	query := fmt.Sprintf("topic:%s archived:false fork:false stars:>=%d", topic, minStars)
	var out RepoPage
	err := c.do(func() (*github.Response, error) {
		result, resp, err := c.client.Search.Repositories(ctx, query,
			&github.SearchOptions{
				Sort:        "updated",
				Order:       "desc",
				ListOptions: github.ListOptions{Page: page, PerPage: perPage},
			})
		if err != nil {
			return nil, err
		}
		out.Items = make([]RepoItem, 0, len(result.Repositories))
		for _, r := range result.Repositories {
			if r != nil && r.FullName != nil {
				out.Items = append(out.Items, toRepoItem(r))
			}
		}
		out.HasNext = len(out.Items) == perPage
		return resp, nil
	})
	if err != nil {
		if isNotFound(err) {
			return RepoPage{Items: []RepoItem{}}, nil
		}
		return RepoPage{}, fmt.Errorf("search repositories: %w", err)
	}
	return out, nil
}

// Repository fetches one repository's metadata; 404 yields (nil, nil).
func (c *LiveClient) Repository(ctx context.Context, repo string) (*RepoItem, error) {
	parts := strings.SplitN(repo, "/", 3)
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return nil, nil
	}
	owner, name := parts[0], parts[1]
	var item *RepoItem
	err := c.do(func() (*github.Response, error) {
		r, resp, err := c.client.Repositories.Get(ctx, owner, name)
		if err != nil {
			return nil, err
		}
		mapped := toRepoItem(r)
		item = &mapped
		return resp, nil
	})
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("get repository %s: %w", repo, err)
	}
	return item, nil
}

// Tree fetches the full recursive git tree at ref; 404 yields an empty slice.
func (c *LiveClient) Tree(ctx context.Context, repo, ref string) ([]TreeItem, error) {
	parts := strings.SplitN(repo, "/", 3)
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return []TreeItem{}, nil
	}
	owner, name := parts[0], parts[1]
	var items []TreeItem
	err := c.do(func() (*github.Response, error) {
		tree, resp, err := c.client.Git.GetTree(ctx, owner, name, ref, true)
		if err != nil {
			return nil, err
		}
		items = make([]TreeItem, 0, len(tree.Entries))
		for _, e := range tree.Entries {
			t := e.GetType()
			if t != "blob" && t != "tree" && t != "commit" {
				t = "blob"
			}
			items = append(items, TreeItem{Path: e.GetPath(), Type: t})
		}
		return resp, nil
	})
	if err != nil {
		if isNotFound(err) {
			return []TreeItem{}, nil
		}
		return nil, fmt.Errorf("get tree %s@%s: %w", repo, ref, err)
	}
	return items, nil
}

// Readme fetches and base64-decodes a repository README; 404 yields (nil, nil).
func (c *LiveClient) Readme(ctx context.Context, repo string) (*string, error) {
	parts := strings.SplitN(repo, "/", 3)
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return nil, nil
	}
	owner, name := parts[0], parts[1]
	var content *string
	err := c.do(func() (*github.Response, error) {
		rm, resp, err := c.client.Repositories.GetReadme(ctx, owner, name, nil)
		if err != nil {
			return nil, err
		}
		decoded, decErr := rm.GetContent() // handles the base64 decoding
		if decErr != nil {
			return nil, decErr
		}
		if decoded != "" { // empty content maps to nil like the TS client
			content = &decoded
		}
		return resp, nil
	})
	if err != nil {
		if isNotFound(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("get readme %s: %w", repo, err)
	}
	return content, nil
}
