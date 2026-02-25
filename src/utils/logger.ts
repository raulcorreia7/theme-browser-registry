/**
 * Logging utilities for the theme browser registry.
 * 
 * @module utils/logger
 * 
 * @example
 * ```typescript
 * import { logger, setLogLevel, LogLevel } from "./utils/logger.js";
 * 
 * setLogLevel("DEBUG");
 * logger.debug("Debug message", { data: "value" });
 * logger.info("Information message");
 * logger.warn("Warning message");
 * logger.error("Error message", new Error("Something went wrong"));
 * ```
 */

/**
 * Log level severity types.
 * - DEBUG: Detailed debugging information
 * - INFO: General informational messages
 * - WARNING: Warning messages for potential issues
 * - ERROR: Error messages for failures
 */
export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR";

/**
 * Mapping of log levels to their numeric severity values.
 * Higher values indicate more severe messages.
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
};

/** Current log level threshold - messages below this level are filtered out. */
let currentLevel: LogLevel = "INFO";

/**
 * Sets the minimum log level. Messages with a level less severe than this will be filtered out.
 * 
 * @param level - The minimum log level to display (DEBUG, INFO, WARNING, ERROR)
 * 
 * @example
 * ```typescript
 * setLogLevel("DEBUG");  // Show all messages
 * setLogLevel("ERROR");  // Show only errors
 * ```
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Determines if a message at the given level should be logged based on the current threshold.
 * 
 * @param level - The log level of the message
 * @returns true if the message should be logged, false otherwise
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Formats log arguments into a single string.
 * - Objects are serialized to JSON
 * - Other values are converted to strings
 * - Multiple arguments are joined with spaces
 * 
 * @param args - Array of arguments to format
 * @returns Formatted string representation of all arguments
 */
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

/**
 * Logger interface providing methods for logging at different severity levels.
 * All log output is written to stderr to avoid interfering with stdout output.
 */
export interface Logger {
  /**
   * Logs a debug message. Only visible when log level is set to DEBUG.
   * @param args - Arguments to log (objects will be JSON serialized)
   */
  debug(...args: unknown[]): void;
  
  /**
   * Logs an informational message. Visible when log level is INFO or lower.
   * @param args - Arguments to log (objects will be JSON serialized)
   */
  info(...args: unknown[]): void;
  
  /**
   * Logs a warning message. Visible when log level is WARNING or lower.
   * @param args - Arguments to log (objects will be JSON serialized)
   */
  warn(...args: unknown[]): void;
  
  /**
   * Logs an error message. Always visible (unless log level is set above ERROR).
   * @param args - Arguments to log (objects will be JSON serialized)
   */
  error(...args: unknown[]): void;
}

/**
 * Default logger instance with methods for debug, info, warn, and error logging.
 * All output is written to stderr to avoid interfering with stdout.
 * 
 * @example
 * ```typescript
 * logger.info("Processing theme", themeName);
 * logger.error("Failed to load", error.message);
 * ```
 */
export const logger: Logger = {
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
