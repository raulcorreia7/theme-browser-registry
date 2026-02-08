from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from indexer.models import Base, RepoCache


class StateStore:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._engine = self._connect(db_path)
        self._ensure_schema()

    def _connect(self, db_path: str):
        db = Path(db_path)
        db.parent.mkdir(parents=True, exist_ok=True)
        return create_engine(f"sqlite:///{db}", future=True)

    def _ensure_schema(self) -> None:
        Base.metadata.create_all(self._engine)

    def should_refresh(
        self, repo: str, discovered_updated_at: str, stale_after_days: int
    ) -> bool:
        existing = self.read_repo(repo)
        if not existing:
            return True

        if existing["parse_error"]:
            return True

        if discovered_updated_at and existing["updated_at"] != discovered_updated_at:
            return True

        stale_seconds = max(1, stale_after_days) * 24 * 60 * 60
        return int(time.time()) - int(existing["scanned_at"]) >= stale_seconds

    def read_repo(self, repo: str) -> dict[str, Any] | None:
        with Session(self._engine) as session:
            row = session.get(RepoCache, repo)
            if row is None:
                return None

        payload: dict[str, Any] | None = None
        try:
            loaded = json.loads(row.payload_json)
            if isinstance(loaded, dict):
                payload = loaded
        except Exception:  # noqa: BLE001
            payload = None

        return {
            "repo": row.repo,
            "updated_at": row.updated_at,
            "scanned_at": row.scanned_at,
            "payload": payload,
            "parse_error": row.parse_error,
        }

    def list_payloads(self) -> list[dict[str, Any]]:
        with Session(self._engine) as session:
            rows = session.scalars(
                select(RepoCache).where(RepoCache.parse_error.is_(None))
            ).all()

        payloads: list[dict[str, Any]] = []
        for row in rows:
            try:
                loaded = json.loads(row.payload_json)
            except Exception:  # noqa: BLE001
                continue
            if isinstance(loaded, dict):
                payloads.append(loaded)
        return payloads

    def upsert_repo(
        self,
        repo: str,
        updated_at: str,
        payload: dict[str, Any],
        parse_error: str | None = None,
    ) -> None:
        now = int(time.time())
        stmt = sqlite_insert(RepoCache).values(
            repo=repo,
            updated_at=updated_at,
            scanned_at=now,
            payload_json=json.dumps(payload, ensure_ascii=True),
            parse_error=parse_error,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[RepoCache.repo],
            set_={
                "updated_at": updated_at,
                "scanned_at": now,
                "payload_json": json.dumps(payload, ensure_ascii=True),
                "parse_error": parse_error,
            },
        )
        with Session(self._engine) as session:
            session.execute(stmt)
            session.commit()

    def close(self) -> None:
        self._engine.dispose()
