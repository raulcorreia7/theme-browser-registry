from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


def _as_int(
    value: Any, default: int, minimum: int | None = None, maximum: int | None = None
) -> int:
    if isinstance(value, bool):
        return default
    if not isinstance(value, int):
        return default
    if minimum is not None and value < minimum:
        return minimum
    if maximum is not None and value > maximum:
        return maximum
    return value


def _as_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    return default


def _as_str(value: Any, default: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return default


def _as_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(normalized)
    return out


@dataclass(frozen=True)
class Config:
    topics: list[str]
    include_repos: list[str]
    output_path: str
    manifest_path: str
    overrides_path: str
    state_db_path: str
    per_page: int
    max_pages_per_topic: int
    request_delay_ms: int
    retry_limit: int
    scan_interval_seconds: int
    stale_after_days: int
    min_stars: int
    skip_archived: bool
    skip_disabled: bool
    sort_by: str
    sort_order: str
    publish_enabled: bool
    publish_remote: str
    publish_branch: str
    publish_commit_message: str


DEFAULT_CONFIG = Config(
    topics=["neovim-colorscheme", "nvim-theme", "vim-colorscheme"],
    include_repos=[],
    output_path="themes.json",
    manifest_path="artifacts/latest.json",
    overrides_path="overrides.json",
    state_db_path=".state/indexer.db",
    per_page=100,
    max_pages_per_topic=5,
    request_delay_ms=250,
    retry_limit=3,
    scan_interval_seconds=1800,
    stale_after_days=14,
    min_stars=0,
    skip_archived=True,
    skip_disabled=True,
    sort_by="stars",
    sort_order="desc",
    publish_enabled=False,
    publish_remote="origin",
    publish_branch="master",
    publish_commit_message="chore(registry): publish latest index artifacts",
)


def load_config(path: str) -> Config:
    config_path = Path(path)
    raw: dict[str, Any] = {}
    if config_path.exists():
        raw_value = json.loads(config_path.read_text(encoding="utf-8"))
        if isinstance(raw_value, dict):
            raw = raw_value

    sort_by = _as_str(raw.get("sort_by"), DEFAULT_CONFIG.sort_by)
    if sort_by not in {"stars", "updated_at", "name"}:
        sort_by = DEFAULT_CONFIG.sort_by

    sort_order = _as_str(raw.get("sort_order"), DEFAULT_CONFIG.sort_order)
    if sort_order not in {"asc", "desc"}:
        sort_order = DEFAULT_CONFIG.sort_order

    return Config(
        topics=_as_str_list(raw.get("topics")) or list(DEFAULT_CONFIG.topics),
        include_repos=_as_str_list(raw.get("include_repos")),
        output_path=_as_str(raw.get("output_path"), DEFAULT_CONFIG.output_path),
        manifest_path=_as_str(raw.get("manifest_path"), DEFAULT_CONFIG.manifest_path),
        overrides_path=_as_str(
            raw.get("overrides_path"), DEFAULT_CONFIG.overrides_path
        ),
        state_db_path=_as_str(raw.get("state_db_path"), DEFAULT_CONFIG.state_db_path),
        per_page=_as_int(
            raw.get("per_page"), DEFAULT_CONFIG.per_page, minimum=1, maximum=100
        ),
        max_pages_per_topic=_as_int(
            raw.get("max_pages_per_topic"),
            DEFAULT_CONFIG.max_pages_per_topic,
            minimum=0,
            maximum=50,
        ),
        request_delay_ms=_as_int(
            raw.get("request_delay_ms"), DEFAULT_CONFIG.request_delay_ms, minimum=0
        ),
        retry_limit=_as_int(
            raw.get("retry_limit"), DEFAULT_CONFIG.retry_limit, minimum=1, maximum=10
        ),
        scan_interval_seconds=_as_int(
            raw.get("scan_interval_seconds"),
            DEFAULT_CONFIG.scan_interval_seconds,
            minimum=60,
        ),
        stale_after_days=_as_int(
            raw.get("stale_after_days"), DEFAULT_CONFIG.stale_after_days, minimum=1
        ),
        min_stars=_as_int(raw.get("min_stars"), DEFAULT_CONFIG.min_stars, minimum=0),
        skip_archived=_as_bool(raw.get("skip_archived"), DEFAULT_CONFIG.skip_archived),
        skip_disabled=_as_bool(raw.get("skip_disabled"), DEFAULT_CONFIG.skip_disabled),
        sort_by=sort_by,
        sort_order=sort_order,
        publish_enabled=_as_bool(
            raw.get("publish_enabled"), DEFAULT_CONFIG.publish_enabled
        ),
        publish_remote=_as_str(
            raw.get("publish_remote"), DEFAULT_CONFIG.publish_remote
        ),
        publish_branch=_as_str(
            raw.get("publish_branch"), DEFAULT_CONFIG.publish_branch
        ),
        publish_commit_message=_as_str(
            raw.get("publish_commit_message"), DEFAULT_CONFIG.publish_commit_message
        ),
    )
