/**
 * Services module exports for theme-browser-registry.
 *
 * @module services
 */

// Indexer exports - alphabetical
export {
  chunk,
  type Config,
  DEFAULT_CONFIG,
  loadConfig,
  runLoop,
  runOnce,
  safeRepo,
  selectRepositoriesForRun,
  setLogLevel,
  sortEntries,
  type RunStats,
} from "./indexer.js";

// Merger exports - alphabetical
export {
  applyOverrides,
  loadOverrides,
  type LoadOverridesResult,
} from "./merger.js";

// Parser exports - alphabetical
export {
  buildEntry,
  extractColorschemes,
  normalizeThemeName,
} from "./parser.js";

// Publisher exports - alphabetical
export {
  publishArtifacts,
  type PublishResult,
} from "./publisher.js";
