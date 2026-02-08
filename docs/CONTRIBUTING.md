# Contributing

## Scope

This repository only accepts changes for the ORM indexer pipeline and curated override data.

## Typical Changes

- add/fix entries in `overrides.json`
- tune discovery and publish settings in `indexer.config.json`
- improve parser and normalization logic under `indexer/`

## Local Workflow

```bash
export GITHUB_TOKEN=your_token_here
pip install -r requirements-indexer.txt
make index-once
make validate
```

## Publishing

Use `make index-publish` to generate artifacts and push only when artifacts changed.

## PR Expectations

- keep diffs focused and reversible
- include before/after behavior in PR description
- avoid committing local `.state/` files
