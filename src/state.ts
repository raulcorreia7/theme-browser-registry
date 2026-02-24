import { mkdirSync } from "fs";
import { dirname } from "path";
import Database from "better-sqlite3";
import type { ThemeEntry, RepoCacheEntry } from "./types.js";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS repo_cache (
    repo TEXT PRIMARY KEY,
    updated_at TEXT NOT NULL,
    scanned_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    parse_error TEXT
  )
`;

const SELECT_REPO_SQL = "SELECT * FROM repo_cache WHERE repo = ?";
const UPSERT_REPO_SQL = `
  INSERT INTO repo_cache (repo, updated_at, scanned_at, payload_json, parse_error)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(repo) DO UPDATE SET
    updated_at = excluded.updated_at,
    scanned_at = excluded.scanned_at,
    payload_json = excluded.payload_json,
    parse_error = excluded.parse_error
`;
const SELECT_ALL_PAYLOADS_SQL = "SELECT payload_json FROM repo_cache WHERE parse_error IS NULL";

export class StateStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(CREATE_TABLE_SQL);
  }

  get raw(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  readRepo(repo: string): RepoCacheEntry | null {
    const row = this.db.prepare(SELECT_REPO_SQL).get(repo) as {
      repo: string;
      updated_at: string;
      scanned_at: number;
      payload_json: string;
      parse_error: string | null;
    } | undefined;

    if (!row) return null;

    return {
      repo: row.repo,
      updated_at: row.updated_at,
      scanned_at: row.scanned_at,
      payload: this.parsePayload(row.payload_json),
      parse_error: row.parse_error,
    };
  }

  upsertRepo(
    repo: string,
    updatedAt: string,
    payload: ThemeEntry | Record<string, unknown>,
    parseError: string | null = null
  ): void {
    const scannedAt = Math.floor(Date.now() / 1000);
    const payloadJson = JSON.stringify(payload);

    this.db.prepare(UPSERT_REPO_SQL).run(repo, updatedAt, scannedAt, payloadJson, parseError);
  }

  shouldRefresh(repo: string, discoveredUpdatedAt: string, staleAfterDays: number): boolean {
    const existing = this.readRepo(repo);

    if (!existing) return true;
    if (existing.parse_error) return true;
    if (discoveredUpdatedAt && existing.updated_at !== discoveredUpdatedAt) return true;

    const staleSeconds = Math.max(1, staleAfterDays) * 86400;
    const now = Math.floor(Date.now() / 1000);
    return now - existing.scanned_at >= staleSeconds;
  }

  listPayloads(): ThemeEntry[] {
    const rows = this.db.prepare(SELECT_ALL_PAYLOADS_SQL).all() as { payload_json: string }[];
    const payloads: ThemeEntry[] = [];

    for (const row of rows) {
      const parsed = this.parsePayload(row.payload_json);
      if (parsed && "name" in parsed && "repo" in parsed && "colorscheme" in parsed) {
        payloads.push(parsed as ThemeEntry);
      }
    }

    return payloads;
  }

  private parsePayload(json: string): ThemeEntry | Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(json);
      return typeof parsed === "object" && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }
}
