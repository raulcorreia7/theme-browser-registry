import { describe, expect, it } from "vitest";
import { inferModeFromColorscheme } from "../../src/build/themes";

describe("build/themes", () => {
  it("infers high-confidence dark/light variants", () => {
    expect(inferModeFromColorscheme("theme-dark")).toBe("dark");
    expect(inferModeFromColorscheme("theme-light")).toBe("light");
  });

  it("does not infer mode for low-confidence token-only names", () => {
    expect(inferModeFromColorscheme("theme-bright")).toBeNull();
    expect(inferModeFromColorscheme("theme-fog")).toBeNull();
  });

  it("does not infer mode from ambiguous compact names", () => {
    expect(inferModeFromColorscheme("oasis-twilight")).toBeNull();
    expect(inferModeFromColorscheme("oasis-starlight")).toBeNull();
  });
});
