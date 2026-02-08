from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from indexer.config import Config
from indexer.github_client import GitHubClient, GitHubRequestError
from indexer.merge import apply_overrides, load_overrides
from indexer.parser import build_entry, extract_colorschemes
from indexer.state import StateStore


def _safe_repo(repo: str) -> str:
    return repo.strip().removesuffix(".git").strip("/")


def discover_repositories(client: GitHubClient, config: Config) -> dict[str, str]:
    discovered: dict[str, str] = {}

    for topic in config.topics:
        page = 1
        while True:
            items, has_next = client.search_repositories(topic, page, config.per_page)
            if not items:
                break

            for item in items:
                repo = _safe_repo(item.repo)
                if repo and repo not in discovered:
                    discovered[repo] = item.updated_at

            page += 1
            if config.max_pages_per_topic and page > config.max_pages_per_topic:
                break
            if not has_next:
                break

    for repo in config.include_repos:
        normalized = _safe_repo(repo)
        if normalized and normalized not in discovered:
            discovered[normalized] = ""

    return discovered


def _sort_entries(
    entries: list[dict[str, Any]], config: Config
) -> list[dict[str, Any]]:
    reverse = config.sort_order == "desc"

    if config.sort_by == "name":
        key = lambda item: (item.get("name") or "").lower()
    elif config.sort_by == "updated_at":
        key = lambda item: item.get("updated_at") or ""
    else:
        key = lambda item: item.get("stars") or 0

    return sorted(entries, key=key, reverse=reverse)


def _write_json(path: str, payload: Any) -> None:
    out_path = Path(path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8"
    )


def _write_manifest(path: str, output_path: str, entries_count: int) -> None:
    output = Path(output_path)
    raw = output.read_bytes()
    checksum = hashlib.sha256(raw).hexdigest()
    payload = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entries": entries_count,
        "registry_path": output.name,
        "sha256": checksum,
    }
    _write_json(path, payload)


def _build_entry_for_repo(
    client: GitHubClient, config: Config, repo: str
) -> dict[str, Any]:
    repo_payload = client.fetch_repository(repo)
    if not repo_payload:
        raise RuntimeError("repository metadata not found")

    stars = repo_payload.get("stargazers_count")
    if isinstance(stars, int) and stars < config.min_stars:
        raise RuntimeError(f"below min_stars ({stars} < {config.min_stars})")

    if config.skip_archived and repo_payload.get("archived") is True:
        raise RuntimeError("repository archived")

    if config.skip_disabled and repo_payload.get("disabled") is True:
        raise RuntimeError("repository disabled")

    ref = repo_payload.get("default_branch")
    if not isinstance(ref, str) or not ref:
        ref = "HEAD"

    tree_items = client.fetch_repository_tree(repo, ref)
    colors = extract_colorschemes(tree_items)
    return build_entry(repo_payload, colors)


def run_once(config: Config) -> dict[str, int]:
    client = GitHubClient(
        request_delay_ms=config.request_delay_ms, retry_limit=config.retry_limit
    )
    store = StateStore(config.state_db_path)
    stats = {
        "discovered": 0,
        "fetched": 0,
        "cached": 0,
        "errors": 0,
        "written": 0,
    }

    try:
        discovered = discover_repositories(client, config)
        stats["discovered"] = len(discovered)

        entries_by_repo: dict[str, dict[str, Any]] = {}
        for payload in store.list_payloads():
            repo = payload.get("repo")
            if isinstance(repo, str) and repo:
                entries_by_repo[repo] = payload

        for repo, discovered_updated_at in discovered.items():
            if not store.should_refresh(
                repo, discovered_updated_at, config.stale_after_days
            ):
                cached = store.read_repo(repo)
                if cached and isinstance(cached.get("payload"), dict):
                    entries_by_repo[repo] = cached["payload"]
                    stats["cached"] += 1
                continue

            try:
                entry = _build_entry_for_repo(client, config, repo)
                updated_at = (
                    entry.get("updated_at")
                    if isinstance(entry.get("updated_at"), str)
                    else ""
                )
                store.upsert_repo(repo, updated_at, entry, parse_error=None)
                entries_by_repo[repo] = entry
                stats["fetched"] += 1
            except (GitHubRequestError, RuntimeError, ValueError) as error:
                store.upsert_repo(
                    repo,
                    discovered_updated_at or "",
                    {"repo": repo},
                    parse_error=str(error),
                )
                stats["errors"] += 1

        entries = list(entries_by_repo.values())
        overrides, excluded = load_overrides(config.overrides_path)
        merged = apply_overrides(entries, overrides, excluded)
        sorted_entries = _sort_entries(merged, config)

        _write_json(config.output_path, sorted_entries)
        _write_manifest(config.manifest_path, config.output_path, len(sorted_entries))
        stats["written"] = len(sorted_entries)
        return stats
    finally:
        store.close()


def run_loop(config: Config) -> None:
    while True:
        started = time.time()
        stats = run_once(config)
        took = int(time.time() - started)
        print(
            "run complete: "
            f"discovered={stats['discovered']} fetched={stats['fetched']} cached={stats['cached']} "
            f"errors={stats['errors']} written={stats['written']} duration={took}s"
        )
        time.sleep(config.scan_interval_seconds)
