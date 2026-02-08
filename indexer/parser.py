from __future__ import annotations

import re
from typing import Any


COLORS_FILE = re.compile(r"^colors/([^/]+)\.(vim|lua)$")


def sanitize_repo_name(repo_name: str) -> str:
    candidate = repo_name.lower().strip()
    suffixes = [
        ".nvim",
        ".vim",
        ".lua",
        "-nvim",
        "_nvim",
        "-vim",
        "_vim",
        "-colorscheme",
    ]
    for suffix in suffixes:
        if candidate.endswith(suffix) and len(candidate) > len(suffix):
            candidate = candidate[: -len(suffix)]
    candidate = candidate.strip("-_")
    return candidate


def normalize_theme_name(full_repo: str) -> str:
    owner, _, repo_name = full_repo.partition("/")
    cleaned_repo = sanitize_repo_name(repo_name)
    if cleaned_repo in {"", "nvim", "vim", "neovim", "theme", "colorscheme"}:
        fallback = sanitize_repo_name(owner)
        if fallback:
            return fallback
    return cleaned_repo or sanitize_repo_name(owner) or "theme"


def extract_colorschemes(tree_items: list[dict[str, Any]]) -> list[str]:
    colors: set[str] = set()
    for item in tree_items:
        if item.get("type") != "blob":
            continue
        path = item.get("path")
        if not isinstance(path, str):
            continue
        match = COLORS_FILE.match(path)
        if not match:
            continue
        colorscheme = match.group(1).strip()
        if colorscheme:
            colors.add(colorscheme)
    return sorted(colors)


def pick_base_colorscheme(theme_name: str, colors: list[str]) -> str:
    if not colors:
        return theme_name

    preferred = {
        theme_name,
        theme_name.replace("-", "_"),
        theme_name.replace("_", "-"),
    }
    for candidate in colors:
        if candidate in preferred:
            return candidate

    for candidate in colors:
        if "-" not in candidate and "_" not in candidate:
            return candidate

    return colors[0]


def build_entry(repo_data: dict[str, Any], colors: list[str]) -> dict[str, Any]:
    full_name = repo_data.get("full_name")
    if not isinstance(full_name, str) or "/" not in full_name:
        raise ValueError("invalid repository payload")

    theme_name = normalize_theme_name(full_name)
    base_colorscheme = pick_base_colorscheme(theme_name, colors)
    variants = [
        {
            "name": value,
            "colorscheme": value,
        }
        for value in colors
        if value != base_colorscheme
    ]

    topics = repo_data.get("topics")
    normalized_topics = []
    if isinstance(topics, list):
        for topic in topics:
            if isinstance(topic, str) and topic:
                normalized_topics.append(topic)

    entry: dict[str, Any] = {
        "name": theme_name,
        "repo": full_name,
        "colorscheme": base_colorscheme,
        "description": repo_data.get("description") or "",
        "stars": repo_data.get("stargazers_count") or 0,
        "topics": normalized_topics,
        "updated_at": repo_data.get("updated_at") or "",
        "archived": bool(repo_data.get("archived")),
        "disabled": bool(repo_data.get("disabled")),
    }

    if variants:
        entry["variants"] = variants

    return entry
