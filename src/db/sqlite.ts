/**
 * Repository cache module
 *
 * Provides persistent storage for theme repository metadata using SQLite.
 * This module handles caching of parsed theme entries to avoid redundant
 * API calls and processing.
 */

import { mkdirSync } from "fs";
import { dirname } from "path";
import { Kysely, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import type { ThemeEntry, RepoCacheEntry } from "@/lib/types";

/**
 * Database schema definition for the repo_cache table.
 *
 * @internal
 */
interface DatabaseSchema {
  /** The repo_cache table storing repository metadata */
  repo_cache: RepoCacheTable;
}

/**
 * Schema for a single row in the repo_cache table.
 *
 * @internal
 */
interface RepoCacheTable {
  /** Repository identifier in "owner/name" format */
  repo: string;
  /** ISO 8601 timestamp of when the repository was last updated */
  updated_at: string;
  /** Unix timestamp of when the repository was scanned */
  scanned_at: number;
  /** JSON-serialized theme entry or error data */
  payload_json: string;
  /** Error message if parsing failed, null otherwise */
  parse_error: string | null;
  /** README content for variant detection */
  readme_content: string | null;
  /** Unix timestamp of when README was last fetched */
  readme_scanned_at: number | null;
}

/**
 * Persistent cache for repository metadata.
 *
 * The RepoCache class provides methods for storing and retrieving
 * theme repository data from a SQLite database. It supports:
 * - Caching theme entries to avoid redundant API calls
 * - Tracking scan timestamps to implement stale data detection
 * - Storing parse errors for failed repository processing
 *
 * @example
 * ```typescript
 * const cache = new RepoCache("./data/cache.db");
 *
 * // Store a theme entry
 * await cache.upsertRepo("owner/theme", "2024-01-01", themeEntry);
 *
 * // Check if refresh is needed
 * const shouldRefresh = await cache.shouldRefresh("owner/theme", "2024-01-01", 7);
 *
 * // Read cached entry
 * const entry = await cache.readRepo("owner/theme");
 *
 * // Cleanup
 * cache.close();
 * ```
 */
export class RepoCache {
  private db: Kysely<DatabaseSchema>;
  private schemaInitialized: boolean;

  /**
   * Creates a new RepoCache instance.
   *
   * Automatically creates the database directory and initializes
   * the repo_cache table if they don't exist.
   *
   * @param dbPath - Path to the SQLite database file
   */
  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });

    const sqlite = new Database(dbPath);

    this.db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: sqlite,
      }),
    });

    this.schemaInitialized = false;
  }

  /**
   * Ensures the database schema is initialized.
   *
   * Creates the repo_cache table if it doesn't already exist.
   * This is called lazily on first database operation.
   *
   * @internal
   */
  private async ensureSchema(): Promise<void> {
    if (this.schemaInitialized) {
      return;
    }

    // Create table if not exists
    await this.db.schema
      .createTable("repo_cache")
      .ifNotExists()
      .addColumn("repo", "text", (col) => col.primaryKey())
      .addColumn("updated_at", "text", (col) => col.notNull())
      .addColumn("scanned_at", "integer", (col) => col.notNull())
      .addColumn("payload_json", "text", (col) => col.notNull())
      .addColumn("parse_error", "text")
      .execute();

    // Add readme columns if they don't exist (migration)
    try {
      await this.db.schema.alterTable("repo_cache").addColumn("readme_content", "text").execute();
    } catch {
      // Column already exists
    }

    try {
      await this.db.schema
        .alterTable("repo_cache")
        .addColumn("readme_scanned_at", "integer")
        .execute();
    } catch {
      // Column already exists
    }

    this.schemaInitialized = true;
  }

  /**
   * Closes the database connection.
   *
   * Should be called when done using the cache to release resources.
   */
  close(): void {
    this.db.destroy();
  }

  /**
   * Reads a cached repository entry.
   *
   * @param repo - Repository identifier in "owner/name" format
   * @returns The cached entry, or null if not found
   */
  async readRepo(repo: string): Promise<RepoCacheEntry | null> {
    await this.ensureSchema();

    const row = await this.db
      .selectFrom("repo_cache")
      .selectAll()
      .where("repo", "=", repo)
      .executeTakeFirst();

    if (!row) return null;

    return {
      repo: row.repo,
      updated_at: row.updated_at,
      scanned_at: row.scanned_at,
      payload: this.parsePayload(row.payload_json),
      parse_error: row.parse_error,
    };
  }

  /**
   * Stores or updates a repository entry in the cache.
   *
   * If an entry for the repository already exists, it will be updated
   * with the new values. The scanned_at timestamp is automatically
   * set to the current time.
   *
   * @param repo - Repository identifier in "owner/name" format
   * @param updatedAt - ISO 8601 timestamp of the repository's last update
   * @param payload - The theme entry data or error record
   * @param parseError - Error message if parsing failed, null otherwise
   */
  async upsertRepo(
    repo: string,
    updatedAt: string,
    payload: ThemeEntry | Record<string, unknown>,
    parseError: string | null = null,
  ): Promise<void> {
    await this.ensureSchema();

    const scannedAt = Math.floor(Date.now() / 1000);
    const payloadJson = JSON.stringify(payload);

    await this.db
      .insertInto("repo_cache")
      .values({
        repo,
        updated_at: updatedAt,
        scanned_at: scannedAt,
        payload_json: payloadJson,
        parse_error: parseError,
      })
      .onConflict((oc) =>
        oc.column("repo").doUpdateSet({
          updated_at: updatedAt,
          scanned_at: scannedAt,
          payload_json: payloadJson,
          parse_error: parseError,
        }),
      )
      .execute();
  }

  /**
   * Determines whether a repository should be refreshed.
   *
   * A repository should be refreshed if:
   * - No cached entry exists
   * - The cached entry has a parse error
   * - The repository's updated_at timestamp differs from the cached value
   * - The cached entry is older than the stale threshold
   *
   * @param repo - Repository identifier in "owner/name" format
   * @param discoveredUpdatedAt - The current updated_at timestamp from GitHub
   * @param staleAfterDays - Number of days after which cached data is considered stale
   * @returns True if the repository should be refreshed, false otherwise
   */
  async shouldRefresh(
    repo: string,
    discoveredUpdatedAt: string,
    staleAfterDays: number,
  ): Promise<boolean> {
    await this.ensureSchema();

    const existing = await this.readRepo(repo);

    if (!existing) return true;
    if (existing.parse_error) return true;
    if (discoveredUpdatedAt && existing.updated_at !== discoveredUpdatedAt) return true;

    const staleSeconds = staleAfterDays * 86400;
    const now = Math.floor(Date.now() / 1000);
    return now - existing.scanned_at >= staleSeconds;
  }

  /**
   * Lists all valid theme payloads from the cache.
   *
   * Returns only entries that:
   * - Have no parse errors
   * - Contain valid ThemeEntry data (name, repo, colorscheme fields)
   *
   * @returns Array of valid theme entries
   */
  async listPayloads(): Promise<ThemeEntry[]> {
    await this.ensureSchema();

    const rows = await this.db
      .selectFrom("repo_cache")
      .select("payload_json")
      .where("parse_error", "is", null)
      .execute();

    const payloads: ThemeEntry[] = [];

    for (const row of rows) {
      const parsed = this.parsePayload(row.payload_json);
      if (parsed && "name" in parsed && "repo" in parsed && "colorscheme" in parsed) {
        payloads.push(parsed as ThemeEntry);
      }
    }

    return payloads;
  }

  /**
   * Lists all entries from the cache.
   *
   * @returns Array of all cache entries
   */
  async listAll(): Promise<RepoCacheEntry[]> {
    await this.ensureSchema();

    const rows = await this.db.selectFrom("repo_cache").selectAll().execute();

    return rows.map((row) => ({
      repo: row.repo,
      updated_at: row.updated_at,
      scanned_at: row.scanned_at,
      payload: this.parsePayload(row.payload_json),
      parse_error: row.parse_error,
    }));
  }

  /**
   * Parses a JSON payload string.
   *
   * @param json - JSON string to parse
   * @returns Parsed object, or null if parsing fails
   * @internal
   */
  private parsePayload(json: string): ThemeEntry | Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(json);
      return typeof parsed === "object" && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * Reads cached README content for a repository.
   *
   * @param repo - Repository identifier in "owner/name" format
   * @returns The README content and timestamp, or null if not cached
   */
  async readReadme(repo: string): Promise<{ content: string; scannedAt: number } | null> {
    await this.ensureSchema();

    const row = await this.db
      .selectFrom("repo_cache")
      .select(["readme_content", "readme_scanned_at"])
      .where("repo", "=", repo)
      .executeTakeFirst();

    if (!row || !row.readme_content || !row.readme_scanned_at) {
      return null;
    }

    return {
      content: row.readme_content,
      scannedAt: row.readme_scanned_at,
    };
  }

  /**
   * Stores README content for a repository.
   *
   * @param repo - Repository identifier in "owner/name" format
   * @param content - README content
   */
  async upsertReadme(repo: string, content: string): Promise<void> {
    await this.ensureSchema();

    const scannedAt = Math.floor(Date.now() / 1000);

    await this.db
      .insertInto("repo_cache")
      .values({
        repo,
        updated_at: "",
        scanned_at: 0,
        payload_json: "{}",
        readme_content: content,
        readme_scanned_at: scannedAt,
      })
      .onConflict((oc) =>
        oc.column("repo").doUpdateSet({
          readme_content: content,
          readme_scanned_at: scannedAt,
        }),
      )
      .execute();
  }

  /**
   * Checks if README content should be refreshed.
   *
   * @param repo - Repository identifier in "owner/name" format
   * @param staleAfterDays - Number of days after which data is stale
   * @returns True if README should be refreshed
   */
  async shouldRefreshReadme(repo: string, staleAfterDays: number): Promise<boolean> {
    await this.ensureSchema();

    const row = await this.db
      .selectFrom("repo_cache")
      .select("readme_scanned_at")
      .where("repo", "=", repo)
      .executeTakeFirst();

    if (!row || !row.readme_scanned_at) {
      return true;
    }

    const staleSeconds = staleAfterDays * 86400;
    const now = Math.floor(Date.now() / 1000);
    return now - row.readme_scanned_at >= staleSeconds;
  }
}
