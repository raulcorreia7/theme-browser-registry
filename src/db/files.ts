import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const REGISTRY_VERSION = "0.1.0";

/**
 * Writes a JSON payload to a file, creating parent directories if needed.
 *
 * @param path - The file path to write to
 * @param payload - The data to serialize and write
 */
export function writeJson(path: string, payload: unknown): void {
  const outPath = path;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

/**
 * Writes a manifest file with checksum information for an output file.
 *
 * @param manifestPath - The path to write the manifest file
 * @param outputPath - The path to the output file to checksum
 * @param entriesCount - The number of entries in the output file
 */
export function writeManifest(
  manifestPath: string,
  outputPath: string,
  entriesCount: number,
): void {
  const raw = readFileSync(outputPath);
  const checksum = createHash("sha256").update(raw).digest("hex");
  const payload = {
    version: REGISTRY_VERSION,
    count: entriesCount,
    generated_at: new Date().toISOString(),
    sha256: checksum,
  };
  writeJson(manifestPath, payload);
}

/**
 * Reads a file and returns its contents as a Buffer.
 *
 * @param path - The file path to read
 * @returns The file contents as a Buffer
 */
export function readFile(path: string): Buffer {
  return readFileSync(path);
}

/**
 * Ensures a directory exists, creating it and any parent directories if needed.
 *
 * @param path - The directory path to ensure exists
 */
export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}
