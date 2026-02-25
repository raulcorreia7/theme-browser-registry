#!/usr/bin/env node
/**
 * Theme Browser Registry CLI
 *
 * Entry point for the theme-registry CLI tool.
 */

import "dotenv/config";
import { createCLI } from "./cli/index.js";

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
