import { writeFileSync } from "fs";
import { loadConfig } from "../runner.js";
import { StateStore } from "../state.js";
import type { CommandResult } from "./types.js";
import { success, failure } from "./types.js";
import type { DbExport, DbExportEntry, ThemeEntry } from "../types.js";

export interface ExportOptions {
  config: string;
  output: string;
}

interface RawRepoCacheRow {
  repo: string;
  updated_at: string;
  scanned_at: number;
  payload_json: string;
  parse_error: string | null;
}

export async function exportCommand(options: ExportOptions): Promise<CommandResult> {
  const config = loadConfig(options.config);
  const store = new StateStore(config.state_db_path);

  try {
    const rows = store.raw
      .prepare(
        "SELECT repo, updated_at, scanned_at, payload_json, parse_error FROM repo_cache ORDER BY repo"
      )
      .all() as RawRepoCacheRow[];

    const entries: DbExportEntry[] = rows.map((row): DbExportEntry => {
      let payload: ThemeEntry | Record<string, unknown> | null = null;
      try {
        payload = JSON.parse(row.payload_json) as ThemeEntry | Record<string, unknown>;
      } catch {
        payload = null;
      }

      return {
        repo: row.repo,
        updated_at: row.updated_at,
        scanned_at: row.scanned_at,
        payload,
        parse_error: row.parse_error,
      };
    });

    const exportData: DbExport = {
      exported_at: new Date().toISOString(),
      count: rows.length,
      entries,
    };

    writeFileSync(options.output, JSON.stringify(exportData, null, 2) + "\n", "utf-8");
    return success(`Exported ${rows.length} entries to ${options.output}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failure(`Export failed: ${message}`, 1);
  } finally {
    store.close();
  }
}
