from __future__ import annotations

import subprocess
from pathlib import Path


class PublishError(RuntimeError):
    pass


def _run(command: list[str], cwd: str) -> str:
    result = subprocess.run(
        command, cwd=cwd, check=False, capture_output=True, text=True
    )
    if result.returncode != 0:
        raise PublishError(
            result.stderr.strip() or result.stdout.strip() or "command failed"
        )
    return result.stdout.strip()


def _has_changes(paths: list[str], cwd: str) -> bool:
    result = subprocess.run(
        ["git", "status", "--porcelain", "--", *paths],
        cwd=cwd,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise PublishError(result.stderr.strip() or "failed to inspect git status")
    return bool(result.stdout.strip())


def publish_artifacts(
    repo_root: str, paths: list[str], message: str, remote: str, branch: str
) -> bool:
    normalized_paths = [str(Path(path)) for path in paths]
    if not _has_changes(normalized_paths, repo_root):
        return False

    _run(["git", "add", "--", *normalized_paths], repo_root)
    _run(["git", "commit", "-m", message], repo_root)
    _run(["git", "push", remote, branch], repo_root)
    return True
