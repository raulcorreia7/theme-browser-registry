#!/usr/bin/env node
/**
 * Theme Browser Registry CLI
 *
 * Entry point for the theme-registry CLI tool.
 */

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
config({ path: envPath });

import { createCLI } from "@/cmd/index";

async function main() {
  try {
    const program = createCLI();
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error("Fatal error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
