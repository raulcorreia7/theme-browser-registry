import { describe, expect, it } from "vitest";
import {
  inferThemeMode,
  mergeModeHintRecords,
  normalizeModeHintKey,
  resolveModeHint,
} from "../../src/lib/mode";

describe("mode inference", () => {
  it("detects boundary light token", () => {
    const result = inferThemeMode("theme-light");
    expect(result?.mode).toBe("light");
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects dark token with trailing style modifiers", () => {
    const result = inferThemeMode("Eva-Dark-Italic-Bold");
    expect(result?.mode).toBe("dark");
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("ignores compact light words with known false positives", () => {
    expect(inferThemeMode("oasis-twilight")).toBeUndefined();
    expect(inferThemeMode("oasis-starlight")).toBeUndefined();
  });

  it("returns undefined on contradictory weak signals", () => {
    expect(inferThemeMode("highlite-tomorrow-night-bright")).toBeUndefined();
  });

  it("handles base16 naming", () => {
    expect(inferThemeMode("base16-onedark")).toMatchObject({ mode: "dark" });
    expect(inferThemeMode("base16-onedark-light")).toMatchObject({ mode: "light" });
  });
});

describe("mode hint helpers", () => {
  it("normalizes hint keys by stripping separators", () => {
    expect(normalizeModeHintKey("modus-operandi")).toBe("modusoperandi");
    expect(normalizeModeHintKey("modus_operandi")).toBe("modusoperandi");
  });

  it("merges hints using normalized keys", () => {
    const merged = mergeModeHintRecords(
      "owner/theme",
      { "modus-operandi": "light" },
      { modus_operandi: "light" },
    );

    expect(merged["modus-operandi"]).toBe("light");
  });

  it("throws on conflicting normalized hints", () => {
    expect(() =>
      mergeModeHintRecords(
        "owner/theme",
        { "modus-operandi": "light" },
        { modus_operandi: "dark" },
      ),
    ).toThrow("Conflicting mode hints");
  });

  it("resolves hints with normalized matching", () => {
    const hint = resolveModeHint("modus-operandi", {
      modus_operandi: "light",
    });

    expect(hint).toEqual({
      mode: "light",
      matchedKey: "modus_operandi",
      normalizedMatch: true,
    });
  });
});
