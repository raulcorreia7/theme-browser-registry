#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from indexer.config import load_config
from indexer.publish import PublishError, publish_artifacts
from indexer.runner import run_loop, run_once


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Long-running Neovim theme registry indexer"
    )
    parser.add_argument(
        "mode",
        choices=["run-once", "run-loop", "run-once-publish"],
        help="run once or run continuously",
    )
    parser.add_argument(
        "--config",
        default="indexer.config.json",
        help="path to indexer config file",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config(args.config)

    token_present = bool(os.environ.get("GITHUB_TOKEN", "").strip())
    if not token_present:
        print("warning: GITHUB_TOKEN is not set, API quota is low")

    if args.mode == "run-loop":
        run_loop(config)
        return 0

    stats = run_once(config)
    print(
        "run complete: "
        f"discovered={stats['discovered']} fetched={stats['fetched']} cached={stats['cached']} "
        f"errors={stats['errors']} written={stats['written']}"
    )

    if args.mode == "run-once-publish" or config.publish_enabled:
        try:
            changed = publish_artifacts(
                repo_root=str(PROJECT_ROOT),
                paths=[config.output_path, config.manifest_path],
                message=config.publish_commit_message,
                remote=config.publish_remote,
                branch=config.publish_branch,
            )
        except PublishError as error:
            print(f"publish failed: {error}")
            return 1

        if changed:
            print(
                f"published artifacts to {config.publish_remote}/{config.publish_branch}: "
                f"{config.output_path}, {config.manifest_path}"
            )
        else:
            print("publish skipped: no artifact changes")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
