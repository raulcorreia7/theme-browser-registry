import { describe, expect, it } from "vitest";
import {
  applyVariantHints,
  detectVariantModeFromName,
  detectVariantModesFromNames,
} from "../../src/detect/variant";

describe("detect/variant", () => {
  it("detects high-confidence boundary token variants", () => {
    expect(detectVariantModeFromName("theme-light")).toBe("light");
    expect(detectVariantModeFromName("theme-dark")).toBe("dark");
  });

  it("avoids ambiguous compact words", () => {
    expect(detectVariantModeFromName("oasis-twilight")).toBeUndefined();
    expect(detectVariantModeFromName("oasis-starlight")).toBeUndefined();
  });

  it("returns unknown source for low-confidence matches", () => {
    const [result] = detectVariantModesFromNames([{ name: "theme-bright" }]);
    expect(result?.detectedMode).toBeUndefined();
    expect(result?.source).toBe("unknown");
    expect(result?.confidence).toBeGreaterThan(0);
  });

  it("applies hints with normalized variant names", () => {
    const [result] = applyVariantHints(
      [{ name: "modus-operandi", source: "unknown", confidence: 0 }],
      { modus_operandi: "light" },
    );

    expect(result).toMatchObject({
      detectedMode: "light",
      source: "hint",
      confidence: 1,
    });
    expect(result?.reason).toContain("normalized match");
  });
});
