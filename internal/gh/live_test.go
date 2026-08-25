package gh

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"
)

// fastSleep replaces real sleeping in pacing tests while still recording.
func fastSleep(d time.Duration) {}

func newTestClient(t *testing.T, handler http.Handler) *LiveClient {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	c := NewLiveClient(LiveOptions{Delay: time.Millisecond, RetryLimit: 2, BaseURL: srv.URL + "/", SleepFn: fastSleep})
	return c
}

func writeJSON(t *testing.T, w http.ResponseWriter, v any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func TestSearchRepositoriesQueryAndMapping(t *testing.T) {
	var gotPath, gotQ string
	c := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotQ = r.URL.Query().Get("q")
		if r.URL.Query().Get("sort") != "updated" || r.URL.Query().Get("order") != "desc" ||
			r.URL.Query().Get("per_page") != "2" || r.URL.Query().Get("page") != "1" {
			t.Errorf("unexpected search params: %v", r.URL.RawQuery)
		}
		writeJSON(t, w, map[string]any{
			"total_count": 2,
			"items": []map[string]any{
				{"id": 1, "full_name": "a/b", "stargazers_count": 5, "topics": []string{"x"},
					"updated_at": "2024-05-06T07:08:09Z", "html_url": "u", "default_branch": "main"},
				nil,
			},
		})
	}))
	page, err := c.SearchRepositories(context.Background(), "nvim-theme", 1, 2, 10)
	if err != nil {
		t.Fatal(err)
	}
	if gotPath != "/search/repositories" {
		t.Fatalf("wrong path %q", gotPath)
	}
	wantQ := "topic:nvim-theme archived:false fork:false stars:>=10"
	if gotQ != wantQ {
		t.Fatalf("query: got %q want %q", gotQ, wantQ)
	}
	if len(page.Items) != 1 || page.Items[0].FullName != "a/b" || page.Items[0].ID != 1 ||
		page.Items[0].Stargazers != 5 || page.Items[0].UpdatedAt != "2024-05-06T07:08:09Z" ||
		page.Items[0].DefaultBr != "main" || page.Items[0].Description != nil {
		t.Fatalf("bad mapping: %+v", page.Items)
	}
	// The nil entry is skipped during mapping, so len(items)==1 != perPage:
	// exactly the TS behavior where HasNext uses the mapped slice length.
	if page.HasNext {
		t.Fatal("mapped len < perPage must clear HasNext")
	}
}

func TestSearchHasNextFalse(t *testing.T) {
	c := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, map[string]any{"total_count": 1, "items": []map[string]any{{"id": 1, "full_name": "a/b"}}})
	}))
	page, err := c.SearchRepositories(context.Background(), "t", 1, 30, 10)
	if err != nil || page.HasNext {
		t.Fatalf("partial page must not have next: %+v %v", page, err)
	}
}

func TestRepositoryNotFound(t *testing.T) {
	c := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		writeJSON(t, w, map[string]string{"message": "Not Found"})
	}))
	item, err := c.Repository(context.Background(), "owner/missing")
	if err != nil || item != nil {
		t.Fatalf("404 repository must be nil,nil: %v %v", item, err)
	}
	tree, err := c.Tree(context.Background(), "owner/missing", "main")
	if err != nil || tree == nil || len(tree) != 0 {
		t.Fatalf("404 tree must be empty: %v %v", tree, err)
	}
	rm, err := c.Readme(context.Background(), "owner/missing")
	if err != nil || rm != nil {
		t.Fatalf("404 readme must be nil,nil: %v %v", rm, err)
	}
	page, err := c.SearchRepositories(context.Background(), "x", 1, 10, 10)
	if err != nil || len(page.Items) != 0 || page.HasNext {
		t.Fatalf("404 search must be empty page: %+v %v", page, err)
	}
}

func TestRetryOn500NeverOn404or401(t *testing.T) {
	var mu sync.Mutex
	counts := map[string]int{}
	codes := map[string]int{
		"/repos/o/server-error": http.StatusInternalServerError,
		"/repos/o/not-found":    http.StatusNotFound,
		"/repos/o/unauthorized": http.StatusUnauthorized,
	}
	c := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		counts[r.URL.Path]++
		mu.Unlock()
		code := codes[r.URL.Path]
		if code != 0 {
			w.WriteHeader(code)
			writeJSON(t, w, map[string]string{"message": "err"})
			return
		}
		writeJSON(t, w, map[string]any{"id": 9, "full_name": "o/ok"})
	}))
	ctx := context.Background()

	if _, err := c.Repository(ctx, "o/not-found"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Repository(ctx, "o/unauthorized"); err == nil {
		t.Fatal("401 must surface as error")
	}
	if counts["/repos/o/not-found"] != 1 || counts["/repos/o/unauthorized"] != 1 {
		t.Fatalf("404/401 retried: %v", counts)
	}
	if _, err := c.Repository(ctx, "o/server-error"); err == nil {
		t.Fatal("persistent 500 must error after retries")
	}
	if n := counts["/repos/o/server-error"]; n != 3 { // initial + retryLimit(2)
		t.Fatalf("retryLimit not honored: attempts=%d want=3", n)
	}
	if _, err := c.Repository(ctx, "o/ok"); err != nil {
		t.Fatal(err)
	}
}

func TestPacingSetsNextRequestAfterEachCall(t *testing.T) {
	var mu sync.Mutex
	var gaps []time.Duration
	var last time.Time
	now := time.Now()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cur := time.Now()
		mu.Lock()
		if !last.IsZero() {
			gaps = append(gaps, cur.Sub(last))
		}
		last = cur
		mu.Unlock()
		writeJSON(t, w, map[string]any{"id": 1, "full_name": "o/x"})
	}))
	defer srv.Close()

	delay := 60 * time.Millisecond
	c := NewLiveClient(LiveOptions{Delay: delay, RetryLimit: 0, BaseURL: srv.URL + "/",
		SleepFn: func(d time.Duration) {
			if d > 0 {
				time.Sleep(d)
			}
		}})
	ctx := context.Background()
	start := now
	for i := 0; i < 3; i++ {
		if _, err := c.Repository(ctx, "o/x"); err != nil {
			t.Fatal(err)
		}
	}
	_ = start
	mu.Lock()
	defer mu.Unlock()
	if len(gaps) != 2 {
		t.Fatalf("expected 2 gaps, got %d", len(gaps))
	}
	for i, g := range gaps {
		if g < delay-15*time.Millisecond {
			t.Fatalf("gap %d too small (%v < ~%v): fixed-interval pacing broken", i, g, delay)
		}
	}
}

func TestTokenFromOptionAndEnv(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		writeJSON(t, w, map[string]any{"id": 1, "full_name": "o/x"})
	}))
	defer srv.Close()
	ctx := context.Background()

	t.Setenv("GITHUB_TOKEN", " envtok ")
	c := NewLiveClient(LiveOptions{BaseURL: srv.URL + "/", SleepFn: fastSleep})
	if _, err := c.Repository(ctx, "o/x"); err != nil {
		t.Fatal(err)
	}
	if gotAuth != "Bearer envtok" {
		t.Fatalf("env token (trimmed) not used: %q", gotAuth)
	}

	c = NewLiveClient(LiveOptions{Token: "opttok", BaseURL: srv.URL + "/", SleepFn: fastSleep})
	if _, err := c.Repository(ctx, "o/x"); err != nil {
		t.Fatal(err)
	}
	if gotAuth != "Bearer opttok" {
		t.Fatalf("option token must win: %q", gotAuth)
	}

	c = NewLiveClient(LiveOptions{BaseURL: srv.URL + "/", SleepFn: fastSleep})
	_ = c
	os.Unsetenv("GITHUB_TOKEN") //nolint // no-token case; t.Setenv cannot unset here
	c = NewLiveClient(LiveOptions{BaseURL: srv.URL + "/", SleepFn: fastSleep})
	if _, err := c.Repository(ctx, "o/x"); err != nil {
		t.Fatal(err)
	}
	if gotAuth != "" {
		t.Fatalf("no token expected, got %q", gotAuth)
	}
}

func TestTreeMapping(t *testing.T) {
	c := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if rec := r.URL.Query().Get("recursive"); rec != "true" && rec != "1" {
			t.Errorf("recursive=true required, got %v", r.URL.RawQuery)
		}
		writeJSON(t, w, map[string]any{
			"sha": "s",
			"tree": []map[string]any{
				{"path": "colors/a.vim", "type": "blob"},
				{"path": "colors", "type": "tree"},
				{"path": "weird", "type": "alien"},
			},
			"truncated": false,
		})
	}))
	items, err := c.Tree(context.Background(), "o/r", "HEAD")
	if err != nil {
		t.Fatal(err)
	}
	want := []TreeItem{{"colors/a.vim", "blob"}, {"colors", "tree"}, {"weird", "blob"}}
	if len(items) != 3 {
		t.Fatalf("want 3 items: %+v", items)
	}
	for i, it := range items {
		if it != want[i] {
			t.Fatalf("item %d: got %+v want %+v", i, it, want[i])
		}
	}
}

func TestReadmeBase64Decode(t *testing.T) {
	content := "# My Theme\nsetup here"
	c := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(t, w, map[string]any{
			"name":     "README.md",
			"encoding": "base64",
			"content":  base64.StdEncoding.EncodeToString([]byte(content)),
		})
	}))
	got, err := c.Readme(context.Background(), "o/r")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || *got != content {
		t.Fatalf("decoded readme mismatch: %v vs %q", got, content)
	}
}

func TestMalformedRepoShortCircuits(t *testing.T) {
	c := newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("request made for malformed repo")
	}))
	ctx := context.Background()
	if item, _ := c.Repository(ctx, "noslash"); item != nil {
		t.Fatal("malformed repo should return nil")
	}
	if tree, _ := c.Tree(ctx, "", "x"); len(tree) != 0 {
		t.Fatal("empty repo should return empty tree")
	}
	// TS split("/") keeps only [owner, name]; "a/b/c" therefore requests "a/b".
	c = newTestClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/a/b/readme" {
			t.Errorf("expected a/b request, got %q", r.URL.Path)
		}
		writeJSON(t, w, map[string]any{"id": 1, "full_name": "a/b"})
	}))
	rm, err := c.Readme(ctx, "a/b/c")
	if err != nil || rm != nil {
		t.Fatalf("empty readme content maps to nil: %v %v", rm, err)
	}
}
