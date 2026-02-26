/**
 * Unified logging using consola.
 *
 * Exports a configured consola instance for both structured logging
 * and CLI output with colors and spinners.
 */
import consola, { type ConsolaInstance, type LogLevel, LogLevels } from "consola";

export type { ConsolaInstance, LogLevel };
export { LogLevels };

export const logger: ConsolaInstance = consola;

export function setLogLevel(level: LogLevel): void {
  consola.level = level;
}

export function getLogLevel(): LogLevel {
  return consola.level;
}

export default consola;
