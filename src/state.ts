import { mkdirSync } from "fs";
import { dirname } from "path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { eq, isNull } from "drizzle-orm";
import type { ThemeEntry } from "./types.js";

const repoCache = sqliteTable("repo_cache", {
  repo: text("repo").primaryKey(),
  updatedAt: text("updated_at").notNull(),
  scannedAt: integer("scanned_at").notNull(),
  payloadJson: text("payload_json").notNull(),
  parseError: text("parse_error"),
});

export interface RepoCacheEntry {
  repo: string;
  updated_at: string;
  scanned_at: number;
  payload: ThemeEntry | Record<string, unknown> | null;
  parse_error: string | null;
}

export class StateStore {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.sqlite = new Database(dbPath);
    this.db = drizzle(this.sqlite);
    this.init();
  }

  get raw(): Database.Database {
    return this.sqlite;
  }

  init(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS repo_cache (
        repo TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL,
        scanned_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        parse_error TEXT
      )
    `);
  }

  close(): void {
    this.sqlite.close();
  }

  readRepo(repo: string): RepoCacheEntry | null {
    const rows = this.db
      .select()
      .from(repoCache)
      .where(eq(repoCache.repo, repo))
      .all();

    const row = rows[0];
    if (!row) {
      return null;
    }

    let payload: ThemeEntry | Record<string, unknown> | null = null;
    try {
      const loaded = JSON.parse(row.payloadJson);
      if (typeof loaded === "object" && loaded !== null) {
        payload = loaded;
      }
    } catch {
      payload = null;
    }

    return {
      repo: row.repo,
      updated_at: row.updatedAt,
      scanned_at: row.scannedAt,
      payload,
      parse_error: row.parseError,
    };
  }

  upsertRepo(
    repo: string,
    updatedAt: string,
    payload: ThemeEntry | Record<string, unknown>,
    parseError: string | null = null
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const payloadJson = JSON.stringify(payload);

    this.db
      .insert(repoCache)
      .values({
        repo,
        updatedAt,
        scannedAt: now,
        payloadJson,
        parseError,
      })
      .onConflictDoUpdate({
        target: repoCache.repo,
        set: {
          updatedAt,
          scannedAt: now,
          payloadJson,
          parseError,
        },
      })
      .run();
  }

  shouldRefresh(
    repo: string,
    discoveredUpdatedAt: string,
    staleAfterDays: number
  ): boolean {
    const existing = this.readRepo(repo);
    if (!existing) {
      return true;
    }

    if (existing.parse_error) {
      return true;
    }

    if (discoveredUpdatedAt && existing.updated_at !== discoveredUpdatedAt) {
      return true;
    }

    const staleSeconds = Math.max(1, staleAfterDays) * 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    return now - existing.scanned_at >= staleSeconds;
  }

  listPayloads(): ThemeEntry[] {
    const rows = this.db
      .select({ payloadJson: repoCache.payloadJson })
      .from(repoCache)
      .where(isNull(repoCache.parseError))
      .all();

    const payloads: ThemeEntry[] = [];
    for (const row of rows) {
      try {
        const loaded = JSON.parse(row.payloadJson);
        if (typeof loaded === "object" && loaded !== null) {
          payloads.push(loaded as ThemeEntry);
        }
      } catch {
        continue;
      }
    }
    return payloads;
  }
}
