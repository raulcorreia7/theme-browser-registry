import type { ThemeMode } from "@/lib/types";

export type StrategyType = "setup" | "load" | "colorscheme" | "file" | "unknown";

export type Strategy = {
  type: StrategyType;
  module?: string;
  file?: string;
};

export type DetectionSignal = {
  strategy: StrategyType;
  score: number;
  reason: string;
};

export type DetectionResult = {
  detected: StrategyType;
  confidence: number;
  signals: DetectionSignal[];
  needsSourceInspection: boolean;
};

export type VariantModeResult = {
  name: string;
  detectedMode?: ThemeMode;
  confidence: number;
  source: "pattern" | "readme" | "hint" | "unknown";
  reason?: string;
};

export type DetectionRow = {
  repo: string;
  themeNames: string[];
  currentStrategy: StrategyType | "missing";
  detectedStrategy: StrategyType;
  confidence: number;
  status: "match" | "mismatch" | "missing-meta" | "error";
  signals: DetectionSignal[];
  error?: string;
};

export const CONFIG = {
  HIGH_CONFIDENCE_THRESHOLD: 0.9,
  MIN_CONFIDENCE_THRESHOLD: 0.5,
} as const;
