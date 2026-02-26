import readline from "node:readline";

export interface ProgressOptions {
  total: number;
  width?: number;
}

const STATUS_ICONS: Record<string, string> = {
  ok: "\x1b[32m✓\x1b[0m",
  warn: "\x1b[33m↻\x1b[0m",
  error: "\x1b[31m✗\x1b[0m",
  info: "\x1b[34m+\x1b[0m",
};

export function createProgress(opts: ProgressOptions) {
  const width = opts.width ?? 20;
  let lastLine = "";

  function update(
    current: number,
    label: string,
    status: "ok" | "warn" | "error" | "info" = "ok",
  ): void {
    const pct = Math.round((current / opts.total) * 100);
    const filled = Math.floor(pct / 5);
    const bar = "█".repeat(filled) + "░".repeat(width - filled);
    const icon = STATUS_ICONS[status] ?? "?";
    const line = `  [${bar}] ${current}/${opts.total} (${pct}%) ${icon} ${label}`;

    readline.cursorTo(process.stdout, 0);
    process.stdout.write(line);
    lastLine = line;
  }

  function clear(): void {
    if (lastLine) {
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 1);
      lastLine = "";
    }
  }

  return { update, clear };
}
