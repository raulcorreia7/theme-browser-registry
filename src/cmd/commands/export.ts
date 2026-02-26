import { writeFileSync } from "node:fs";
import { loadConfig } from "@/lib/config";
import { RepoCache } from "@/db/sqlite";
import type { CommandResult } from "@/cmd/commands/types";
import { success, failure } from "@/cmd/commands/types";
import type { DbExport, DbExportEntry } from "@/lib/types";

export interface ExportOptions {
  config: string;
  output: string;
}

/** Runs the export command
 *
 * @param options - Command options
 * @returns Command result
 */
export async function exportCommand(options: ExportOptions): Promise<CommandResult> {
  const config = loadConfig(options.config);
  const store = new RepoCache(config.output.cache);

  try {
    const rows = await store.listAll();

    const entries: DbExportEntry[] = rows.map(
      (row): DbExportEntry => ({
        repo: row.repo,
        updated_at: row.updated_at,
        scanned_at: row.scanned_at,
        payload: row.payload,
        parse_error: row.parse_error,
      }),
    );

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
