import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

export function readJson<T>(path: string, schema?: z.ZodSchema<T>): T {
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw);
  if (schema) {
    return schema.parse(data);
  }
  return data;
}

export function writeJson(path: string, data: unknown, indent = 2): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(data, null, indent) + "\n", "utf-8");
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function pathExists(path: string): boolean {
  return existsSync(path);
}

export function resolveRootPath(root: string, ...segments: string[]): string {
  return resolve(root, ...segments);
}
