# Registry Docs

This project now uses the ORM-based indexer only.

## Commands

```bash
make index-once
make index-loop
make index-publish
make validate
```

## Important Files

- `indexer.config.json`: runtime configuration
- `themes.json`: generated registry artifact
- `artifacts/latest.json`: generated manifest (checksum + timestamp)
- `.state/indexer.db`: local SQLAlchemy/SQLite state cache
- `overrides.json`: manual curation and exclusions

## Deployment

- Containerized daemon: `docker-compose.indexer.yml`
- Public publication: `run-once-publish` commits and pushes changed artifacts

## Notes

- Set `GITHUB_TOKEN` to avoid strict unauthenticated API limits.
- Indexer is incremental; unchanged repos are reused from local state.
