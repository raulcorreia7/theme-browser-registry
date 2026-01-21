#!/usr/bin/env python3
"""Fetch Neovim themes from GitHub topics and build themes.json registry."""

import argparse
import json
import os
import sys
import time
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

def normalize_theme_name(name):
    """Normalize theme name by removing common suffixes."""
    if not name:
        return ""
    for suffix in [".nvim", ".lua", ".vim"]:
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return name


def load_json_file(path):
    """Load and parse a JSON file."""
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as e:
        print(f"Warning: Failed to parse {path}: {e}")
        return None


def save_json_file(path, data):
    """Save data to a JSON file with formatting."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, sort_keys=True)
    return True


def fetch_github_api(url, token=None):
    """Fetch data from GitHub API with retries and rate limit handling."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "nvim-theme-registry/1.0",
    }

    if token:
        headers["Authorization"] = f"Bearer {token}"

    max_retries = 3
    last_error = None

    for attempt in range(max_retries):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode())
        except HTTPError as e:
            last_error = f"HTTP error {e.code}: {e.reason}"
            if e.code == 403:
                print(f"Rate limit exceeded. Use a GitHub token for higher limits.")
                print(f"Waiting 60 seconds before retry...")
                time.sleep(60)
                continue
            if e.code == 404:
                return None
            if e.code == 401:
                print(f"Invalid token. Please check GITHUB_TOKEN.")
                return None
            print(last_error)
        except URLError as e:
            last_error = f"URL error: {e.reason}"
            print(last_error)
        except Exception as e:
            last_error = f"Request failed: {e}"
            print(last_error)

        if attempt < max_retries - 1:
            wait_time = min(2**attempt, 60)
            print(f"Retry {attempt + 1}/{max_retries} in {wait_time}s...")
            time.sleep(wait_time)
        else:
            print(f"Failed after {max_retries} attempts: {last_error}")
            return None

    return None


def normalize_repo_identifier(value):
    if not value:
        return ""
    value = value.strip()
    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        parts = parsed.path.strip("/").split("/")
        if len(parts) >= 2:
            return f"{parts[0]}/{parts[1]}"
        return ""
    if value.startswith("git@"):
        value = value.replace("git@github.com:", "").replace("github.com:", "")
    value = value.replace("github.com/", "")
    value = value.replace(".git", "")
    return value.strip("/")


def fetch_repo(repo, config):
    token = os.environ.get("GITHUB_TOKEN") or config.get("github_token")
    repo_name = normalize_repo_identifier(repo)
    if not repo_name:
        return []

    url = f"https://api.github.com/repos/{repo_name}"
    item = fetch_github_api(url, token)
    if not item:
        return []

    entry = {
        "name": normalize_theme_name(item.get("name", "")),
        "repo": item.get("full_name", repo_name),
        "colorscheme": normalize_theme_name(item.get("name", "")),
        "stars": item.get("stargazers_count", 0),
        "description": item.get("description") or "",
        "homepage": item.get("homepage") or "",
        "updated_at": item.get("updated_at") or "",
        "topics": item.get("topics", []),
        "archived": item.get("archived", False),
        "disabled": item.get("disabled", False),
    }

    if config.get("detect_variants", True):
        variants = detect_variants(repo_name, token)
        if variants:
            entry["variants"] = variants

    return [entry]


def detect_variants(repo_name, token=None):
    """Detect variants by checking for colors/ directory."""
    try:
        url = f"https://api.github.com/repos/{repo_name}/contents/colors"
        contents = fetch_github_api(url, token)

        if not contents or not isinstance(contents, dict):
            return []

        items = contents.get("items", [])
        if not isinstance(items, list):
            return []

        variants = []
        for item in items:
            if not isinstance(item, dict):
                continue

            if item.get("type") == "file":
                filename = item.get("name", "")
                colorscheme = filename.replace(".vim", "").replace(".lua", "")

                if colorscheme:
                    variants.append({"colorscheme": colorscheme})

        return variants
    except Exception as e:
        print(f"Warning: Failed to detect variants for {repo_name}: {e}")
        return []


def fetch_repos(topic, config):
    """Fetch repositories from GitHub API for a given topic."""
    token = os.environ.get("GITHUB_TOKEN") or config.get("github_token")
    per_page = config.get("per_page", 100)
    max_pages = config.get("max_pages", 0)
    sort_by = config.get("sort_by", "stars")
    sort_order = config.get("sort_order", "desc")
    rate_limit_delay = config.get("rate_limit_delay", 1000)
    detect_variants_enabled = config.get("detect_variants", True)

    all_items = []
    page = 1

    while True:
        if page > 1 and rate_limit_delay > 0:
            time.sleep(rate_limit_delay / 1000)

        url = (
            f"https://api.github.com/search/repositories"
            f"?q=topic:{topic}"
            f"&sort={sort_by}"
            f"&order={sort_order}"
            f"&per_page={per_page}"
            f"&page={page}"
        )

        print(f"Fetching page {page} for topic: {topic}")

        response = fetch_github_api(url, token)
        if not response or "items" not in response:
            print(f"Failed to fetch page {page}")
            break

        items = response.get("items", [])
        if not items:
            break

        for item in items:
            repo_name = item.get("full_name", "")
            entry = {
                "name": normalize_theme_name(item.get("name", "")),
                "repo": repo_name,
                "colorscheme": normalize_theme_name(item.get("name", "")),
                "stars": item.get("stargazers_count", 0),
                "description": item.get("description") or "",
                "homepage": item.get("homepage") or "",
                "updated_at": item.get("updated_at") or "",
                "topics": item.get("topics", []),
                "archived": item.get("archived", False),
                "disabled": item.get("disabled", False),
            }

            if detect_variants_enabled:
                variants = detect_variants(repo_name, token)
                if variants:
                    entry["variants"] = variants

            all_items.append(entry)

        print(f"Fetched {len(items)} repos from page {page}")

        page += 1
        if max_pages and page > max_pages:
            break

    return all_items


def merge_items(all_items, overrides_data):
    """Merge fetched items with overrides and exclusions."""
    by_repo = {}

    for item in all_items:
        by_repo[item["repo"]] = item

    excluded = set(overrides_data.get("excluded", []))
    overrides = overrides_data.get("overrides", [])

    for repo in excluded:
        if repo in by_repo:
            del by_repo[repo]

    for override in overrides:
        repo = override.get("repo")
        if repo:
            by_repo[repo] = override

    return list(by_repo.values())


def filter_overrides_for_repo(overrides_data, repo_name):
    if not overrides_data or not repo_name:
        return overrides_data
    target = normalize_repo_identifier(repo_name).lower()
    if not target:
        return overrides_data
    overrides = []
    for entry in overrides_data.get("overrides", []):
        if normalize_repo_identifier(entry.get("repo", "")).lower() == target:
            overrides.append(entry)
    excluded = []
    for entry in overrides_data.get("excluded", []):
        if normalize_repo_identifier(entry).lower() == target:
            excluded.append(entry)
    return {"overrides": overrides, "excluded": excluded}


def sort_items(items, config):
    """Sort items by configured field and order."""
    sort_by = config.get("sort_by", "stars")
    sort_order = config.get("sort_order", "desc")

    sort_key_map = {"stars": "stars", "updated": "updated_at"}
    sort_key = sort_key_map.get(sort_by, "stars")

    reverse = sort_order == "desc"

    return sorted(items, key=lambda x: x.get(sort_key, 0), reverse=reverse)


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Fetch Neovim themes from GitHub topics and build themes.json registry.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  # Use default config
  python3 scripts/fetch_themes.py

  # Specify custom config
  python3 scripts/fetch_themes.py --config my-config.json

  # Override topics from command line
  python3 scripts/fetch_themes.py --topics neovim-colorscheme

  # Dry run without writing output
  python3 scripts/fetch_themes.py --dry-run

  # Verbose output
  python3 scripts/fetch_themes.py --verbose
        """,
    )

    parser.add_argument(
        "-c",
        "--config",
        default="config.json",
        help="Path to configuration file (default: config.json)",
    )

    parser.add_argument(
        "-o", "--output", help="Output file path (overrides config.output_path)"
    )

    parser.add_argument(
        "-t",
        "--topics",
        nargs="+",
        help="GitHub topics to fetch (overrides config.topics)",
    )

    parser.add_argument(
        "--repo",
        help="Fetch a single repository (owner/repo or full GitHub URL)",
    )

    parser.add_argument(
        "--max-pages",
        type=int,
        help="Maximum pages per topic (overrides config.max_pages)",
    )

    parser.add_argument(
        "--per-page", type=int, help="Results per page (overrides config.per_page)"
    )

    parser.add_argument(
        "--sort-by",
        choices=["stars", "updated"],
        help="Sort field (overrides config.sort_by)",
    )

    parser.add_argument(
        "--sort-order",
        choices=["desc", "asc"],
        help="Sort order (overrides config.sort_order)",
    )

    parser.add_argument(
        "-n",
        "--dry-run",
        action="store_true",
        help="Validate and process without writing output file",
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Verbose output with detailed information",
    )

    parser.add_argument(
        "--no-detect-variants",
        action="store_true",
        help="Disable automatic variant detection from colors/ directory",
    )

    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_args()

    config_path = args.config
    config = load_json_file(config_path)

    if not config:
        print(f"Error: Failed to load config from {config_path}")
        sys.exit(1)

    if args.verbose:
        print(f"Loading config from: {config_path}")
        print(f"Config: {json.dumps(config, indent=2)}")

    if args.verbose:
        print(f"\nCLI Overrides:")
        if args.topics:
            print(f"  topics: {args.topics}")
        if args.max_pages:
            print(f"  max_pages: {args.max_pages}")
        if args.per_page:
            print(f"  per_page: {args.per_page}")
        if args.sort_by:
            print(f"  sort_by: {args.sort_by}")
        if args.sort_order:
            print(f"  sort_order: {args.sort_order}")
        if args.output:
            print(f"  output_path: {args.output}")
        if args.dry_run:
            print(f"  dry_run: True")
        if args.no_detect_variants:
            print(f"  no_detect_variants: True")

    if args.topics:
        config["topics"] = args.topics
    if args.max_pages:
        config["max_pages"] = args.max_pages
    if args.per_page:
        config["per_page"] = args.per_page
    if args.sort_by:
        config["sort_by"] = args.sort_by
    if args.sort_order:
        config["sort_order"] = args.sort_order
    if args.output:
        config["output_path"] = args.output

    if "detect_variants" not in config:
        config["detect_variants"] = True

    if args.no_detect_variants:
        config["detect_variants"] = False

    overrides_path = config.get("overrides_path", "overrides.json")
    overrides_data = load_json_file(overrides_path) or {"overrides": [], "excluded": []}

    all_items = []

    if args.repo:
        repo_name = normalize_repo_identifier(args.repo)
        print(f"Fetching repo: {repo_name}")
        items = fetch_repo(repo_name, config)
        if not items:
            print("Error: Failed to fetch repo.")
            sys.exit(1)
        all_items.extend(items)
        overrides_data = filter_overrides_for_repo(overrides_data, repo_name)
    else:
        print(f"Topics: {', '.join(config.get('topics', []))}")
        print(f"Max pages per topic: {config.get('max_pages', 5)}")
        print(f"Results per page: {config.get('per_page', 100)}")
        print(f"Detect variants: {config.get('detect_variants', True)}")
        for topic in config.get("topics", []):
            print(f"\nFetching topic: {topic}")
            try:
                items = fetch_repos(topic, config)
                if items:
                    all_items.extend(items)
            except Exception as e:
                print(f"Warning: Failed to fetch topic {topic}: {e}")
                continue

    print(f"\nMerging with overrides from: {overrides_path}")
    merged = merge_items(all_items, overrides_data)
    print(f"After merge: {len(merged)} themes")

    merged = sort_items(merged, config)
    print(
        f"After sorting by {config.get('sort_by', 'stars')} {config.get('sort_order', 'desc')}: {len(merged)} themes"
    )

    if args.dry_run:
        print("\nDry run: Skipping output file write")
        print(
            f"Would write {len(merged)} themes to {config.get('output_path', 'themes.json')}"
        )
    else:
        output_path = config.get("output_path", "themes.json")
        save_json_file(output_path, merged)
        print(f"\nSuccessfully wrote {len(merged)} themes to {output_path}")


if __name__ == "__main__":
    main()
