import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT = resolve(__dirname, "../..");

export const JSON_INDENT = 2;

export const DEFAULT_CONCURRENCY = 6;

export const HIGH_CONFIDENCE_THRESHOLD = 0.9;
export const MIN_CONFIDENCE_THRESHOLD = 0.5;

export const THEME_NAME_MIN_LENGTH = 2;
export const THEME_NAME_MAX_LENGTH = 64;
