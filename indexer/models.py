from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class RepoCache(Base):
    __tablename__ = "repo_cache"

    repo: Mapped[str] = mapped_column(String(255), primary_key=True)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    scanned_at: Mapped[int] = mapped_column(Integer, nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    parse_error: Mapped[str | None] = mapped_column(Text, nullable=True)
