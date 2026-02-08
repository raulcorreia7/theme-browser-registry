from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)  # type: ignore[arg-type]
            continue
        merged[key] = value
    return merged


def load_overrides(path: str) -> tuple[list[dict[str, Any]], set[str]]:
    file_path = Path(path)
    if not file_path.exists():
        return [], set()

    raw = json.loads(file_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return [], set()

    overrides_raw = raw.get("overrides", [])
    excluded_raw = raw.get("excluded", [])

    overrides: list[dict[str, Any]] = []
    if isinstance(overrides_raw, list):
        for item in overrides_raw:
            if isinstance(item, dict):
                overrides.append(item)

    excluded: set[str] = set()
    if isinstance(excluded_raw, list):
        for item in excluded_raw:
            if isinstance(item, str) and item:
                excluded.add(item)

    return overrides, excluded


def apply_overrides(
    entries: list[dict[str, Any]],
    overrides: list[dict[str, Any]],
    excluded: set[str],
) -> list[dict[str, Any]]:
    by_repo: dict[str, dict[str, Any]] = {}
    for entry in entries:
        repo = entry.get("repo")
        if isinstance(repo, str) and repo:
            by_repo[repo] = entry

    for repo in excluded:
        by_repo.pop(repo, None)

    for override in overrides:
        repo = override.get("repo")
        if not isinstance(repo, str) or not repo:
            continue
        base = by_repo.get(repo, {})
        by_repo[repo] = _deep_merge(base, override)

    return list(by_repo.values())
