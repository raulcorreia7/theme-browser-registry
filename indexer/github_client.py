from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class GitHubRequestError(RuntimeError):
    pass


@dataclass
class SearchResult:
    repo: str
    updated_at: str


class GitHubClient:
    def __init__(self, request_delay_ms: int, retry_limit: int) -> None:
        self.base_url = "https://api.github.com"
        self.token = os.environ.get("GITHUB_TOKEN", "").strip()
        self.request_delay_ms = request_delay_ms
        self.retry_limit = retry_limit
        self._next_request_time = 0.0

    def _sleep_for_rate(self) -> None:
        now = time.monotonic()
        if now < self._next_request_time:
            time.sleep(self._next_request_time - now)

    def _mark_request(self) -> None:
        self._next_request_time = time.monotonic() + (self.request_delay_ms / 1000.0)

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "theme-browser-registry-indexer/2.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _request_json(
        self, path: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any] | list[Any] | None:
        query = ""
        if params:
            query = "?" + urlencode(params)
        url = f"{self.base_url}{path}{query}"

        last_error = None
        for attempt in range(1, self.retry_limit + 1):
            self._sleep_for_rate()
            request = Request(url, headers=self._headers())
            try:
                with urlopen(request, timeout=30) as response:
                    self._mark_request()
                    body = response.read().decode("utf-8")
                    if not body:
                        return None
                    return json.loads(body)
            except HTTPError as error:
                self._mark_request()
                if error.code == 404:
                    return None

                remaining = error.headers.get("X-RateLimit-Remaining")
                reset_at = error.headers.get("X-RateLimit-Reset")
                if error.code == 403 and remaining == "0" and reset_at:
                    try:
                        sleep_seconds = max(1, int(reset_at) - int(time.time()) + 1)
                    except ValueError:
                        sleep_seconds = 60
                    print(f"rate limit reached; sleeping {sleep_seconds}s")
                    time.sleep(sleep_seconds)
                    continue

                last_error = f"HTTP {error.code} for {url}"
            except Exception as error:  # noqa: BLE001
                self._mark_request()
                last_error = str(error)

            if attempt < self.retry_limit:
                backoff = min(60, 2 ** (attempt - 1))
                time.sleep(backoff)

        raise GitHubRequestError(last_error or f"request failed: {url}")

    def search_repositories(
        self, topic: str, page: int, per_page: int
    ) -> tuple[list[SearchResult], bool]:
        payload = self._request_json(
            "/search/repositories",
            {
                "q": f"topic:{topic} archived:false fork:false",
                "sort": "updated",
                "order": "desc",
                "per_page": per_page,
                "page": page,
            },
        )

        if not isinstance(payload, dict):
            return [], False

        items = payload.get("items")
        if not isinstance(items, list):
            return [], False

        results: list[SearchResult] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            full_name = item.get("full_name")
            updated_at = item.get("updated_at", "")
            if isinstance(full_name, str) and full_name:
                results.append(
                    SearchResult(
                        repo=full_name,
                        updated_at=updated_at if isinstance(updated_at, str) else "",
                    )
                )

        return results, len(items) == per_page

    def fetch_repository(self, repo: str) -> dict[str, Any] | None:
        payload = self._request_json(f"/repos/{repo}")
        if isinstance(payload, dict):
            return payload
        return None

    def fetch_repository_tree(self, repo: str, ref: str) -> list[dict[str, Any]]:
        payload = self._request_json(f"/repos/{repo}/git/trees/{ref}", {"recursive": 1})
        if not isinstance(payload, dict):
            return []
        tree = payload.get("tree")
        if not isinstance(tree, list):
            return []
        return [item for item in tree if isinstance(item, dict)]
