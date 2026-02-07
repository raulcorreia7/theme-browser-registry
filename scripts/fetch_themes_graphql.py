#!/usr/bin/env python3
"""Fetch Neovim themes from GitHub topics using GraphQL and build themes.json registry."""

import argparse
import json
import os
import sys
import time
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


def fetch_github_graphql(query, token=None, variables=None):
    """Fetch data from GitHub GraphQL API with retries and rate limit handling."""
    url = "https://api.github.com/graphql"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "nvim-theme-registry/1.0",
    }

    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = {
        "query": query,
        "variables": variables or {},
    }

    max_retries = 3
    last_error = None

    for attempt in range(max_retries):
        try:
            req = Request(url, headers=headers, data=json.dumps(payload).encode())
            with urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode())
                if "errors" in data:
                    raise Exception(f"GraphQL error: {data['errors']}")
                return data
        except HTTPError as e:
            last_error = f"HTTP error {e.code}: {e.reason}"
            if e.code == 403:
                print(f"Rate limit exceeded. Use a GitHub token for higher limits.")
                print(f"Waiting 60 seconds before retry...")
                time.sleep(60)
                continue
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


GRAPHQL_QUERY = """
query($query: String!, $cursor: String) {
  search(type: REPOSITORY, query: $query, first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on Repository {
        name
        nameWithOwner
        stargazerCount
        description
        homepageUrl
        updatedAt
        isArchived
        repositoryTopics(first: 20) { 
          nodes { topic { name } } 
        }
      }
    }
  }
"""


def search_repos_by_star_buckets(topic, token=None, verbose=False):
    """Fetch all repos by star count buckets to bypass 1000 result limit."""
    star_buckets = [
        "stars:>2000",
        "stars:1000..2000",
        "stars:500..1000",
        "stars:1..500",
    ]

    all_items = []
    seen_repos = set()

    for bucket in star_buckets:
        print(f"\nFetching bucket: {bucket}")

        cursor = None
        bucket_count = 0

        while True:
            query = f"topic:{topic} {bucket}"
            variables = {"query": query, "cursor": cursor}

            response = fetch_github_graphql(GRAPHQL_QUERY, token, variables)
            if not response:
                break

            search_data = response.get("data", {}).get("search", {})
            nodes = search_data.get("nodes", [])
            page_info = search_data.get("pageInfo", {})

            if not nodes:
                break

            for node in nodes:
                repo = node.get("nameWithOwner")
                if repo in seen_repos:
                    continue

                seen_repos.add(repo)
                entry = {
                    "name": normalize_theme_name(node.get("name", "")),
                    "repo": repo,
                    "colorscheme": normalize_theme_name(node.get("name", "")),
                    "stars": node.get("stargazerCount", 0),
                    "description": node.get("description", "") or "",
                    "homepage": node.get("homepageUrl", "") or "",
                    "updated_at": node.get("updatedAt", ""),
                    "topics": [
                        t["topic"]["name"]
                        for t in node.get("repositoryTopics", {}).get("nodes", [])
                    ],
                    "archived": node.get("isArchived", False),
                    "disabled": False,
                }

                all_items.append(entry)
                bucket_count += 1

            if verbose:
                print(
                    f"  Page fetched: {len(nodes)} items (bucket total: {bucket_count}, overall: {len(all_items)})"
                )

            if not page_info.get("hasNextPage"):
                break

            cursor = page_info.get("endCursor")

        print(f"  Bucket '{bucket}': {bucket_count} repos")

    return all_items


def fetch_single_repo(repo_name, token=None, verbose=False):
    """Fetch a single repository by name."""
    query = f"repo:{repo_name}"
    variables = {"query": query, "cursor": None}

    response = fetch_github_graphql(GRAPHQL_QUERY, token, variables)
    if not response:
        return []

    nodes = response.get("data", {}).get("search", {}).get("nodes", [])
    if not nodes:
        return []

    node = nodes[0]
    entry = {
        "name": normalize_theme_name(node.get("name", "")),
        "repo": node.get("nameWithOwner", ""),
        "colorscheme": normalize_theme_name(node.get("name", "")),
        "stars": node.get("stargazerCount", 0),
        "description": node.get("description", "") or "",
        "homepage": node.get("homepageUrl", "") or "",
        "updated_at": node.get("updatedAt", ""),
        "topics": [
            t["topic"]["name"]
            for t in node.get("repositoryTopics", {}).get("nodes", [])
        ],
        "archived": node.get("isArchived", False),
        "disabled": False,
    }

    return [entry]


def normalize_repo_identifier(value):
    """Normalize repo identifier to owner/repo format."""
    if not value:
        return ""
    value = value.strip()
    if value.startswith("http://") or value.startswith("https://"):
        from urllib.parse import urlparse

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


def merge_items(all_items, overrides_data):
    """Merge fetched items with overrides and exclusions."""
    by_repo = {}

    for item in all_items:
        by_repo[item["repo"]] = item

    excluded = set(overrides_data.get("excluded", []))
    overrides = overrides_data.get("overrides", [])

    for repo in excluded:
        normalized = normalize_repo_identifier(repo).lower()
        for item_repo in list(by_repo.keys()):
            if normalize_repo_identifier(item_repo).lower() == normalized:
                del by_repo[item_repo]

    for override in overrides:
        repo = normalize_repo_identifier(override.get("repo", ""))
        if repo:
            for item_repo in list(by_repo.keys()):
                if normalize_repo_identifier(item_repo).lower() == repo.lower():
                    by_repo[item_repo] = override
                    break

    return list(by_repo.values())


def filter_overrides_for_repo(overrides_data, repo_name):
    """Filter overrides data for a specific repo."""
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
        description="Fetch Neovim themes from GitHub topics using GraphQL and build themes.json registry.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  # Use default config
  python3 scripts/fetch_themes_graphql.py

  # Specify custom config
  python3 scripts/fetch_themes_graphql.py --config my-config.json

  # Override topics from command line
  python3 scripts/fetch_themes_graphql.py --topics neovim-colorscheme

  # Dry run without writing output
  python3 scripts/fetch_themes_graphql.py --dry-run

  # Verbose output
  python3 scripts/fetch_themes_graphql.py --verbose
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
        if args.output:
            print(f"  output_path: {args.output}")
        if args.dry_run:
            print(f"  dry_run: True")

    if args.topics:
        config["topics"] = args.topics
    if args.output:
        config["output_path"] = args.output

    overrides_path = config.get("overrides_path", "overrides.json")
    overrides_data = load_json_file(overrides_path) or {"overrides": [], "excluded": []}

    all_items = []
    token = os.environ.get("GITHUB_TOKEN") or config.get("github_token")

    if args.repo:
        repo_name = normalize_repo_identifier(args.repo)
        print(f"Fetching repo: {repo_name}")
        items = fetch_single_repo(repo_name, token, args.verbose)
        if not items:
            print("Error: Failed to fetch repo.")
            sys.exit(1)
        all_items.extend(items)
        overrides_data = filter_overrides_for_repo(overrides_data, repo_name)
    else:
        print(f"Topics: {', '.join(config.get('topics', []))}")
        for topic in config.get("topics", []):
            print(f"\nFetching topic: {topic}")
            try:
                items = search_repos_by_star_buckets(topic, token, args.verbose)
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
