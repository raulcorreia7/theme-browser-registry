type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
};

let currentLevel: LogLevel = "INFO";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "object") {
        return JSON.stringify(arg);
      }
      return String(arg);
    })
    .join(" ");
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog("DEBUG")) {
      console.error(`[DEBUG] ${formatArgs(args)}`);
    }
  },
  info: (...args: unknown[]) => {
    if (shouldLog("INFO")) {
      console.error(`[INFO] ${formatArgs(args)}`);
    }
  },
  warn: (...args: unknown[]) => {
    if (shouldLog("WARNING")) {
      console.error(`[WARN] ${formatArgs(args)}`);
    }
  },
  error: (...args: unknown[]) => {
    if (shouldLog("ERROR")) {
      console.error(`[ERROR] ${formatArgs(args)}`);
    }
  },
};
