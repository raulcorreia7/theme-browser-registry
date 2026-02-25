import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { publishArtifacts } from "../../src/services/publisher.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "node:child_process";

const GIT_BOT_NAME = "registry-bot";
const GIT_BOT_EMAIL = "bot@theme-browser.local";
const DEFAULT_REMOTE = "origin";
const DEFAULT_BRANCH = "main";
const DEFAULT_COMMIT_MESSAGE = "chore: update registry";
const CUSTOM_COMMIT_MESSAGE = "custom: update artifacts";
const REPO_ROOT = "/repo/root";

const defaultOptions = {
  message: DEFAULT_COMMIT_MESSAGE,
  remote: DEFAULT_REMOTE,
  branch: DEFAULT_BRANCH,
};

function createTestDir(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return join(tmpdir(), `publish-test-${random}-${timestamp}`);
}

function createEmptyArtifact(dir: string, filename = "themes.json"): string {
  const path = join(dir, filename);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify({ themes: [] }));
  return path;
}

describe("publish", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestDir();
    mkdirSync(testDir, { recursive: true });
    vi.mocked(execFileSync).mockReset();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe("publishArtifacts", () => {
    it("returns error when artifact not found", () => {
      vi.mocked(execFileSync).mockReturnValue(REPO_ROOT);

      const result = publishArtifacts(
        [join(testDir, "nonexistent.json")],
        defaultOptions,
        testDir
      );
      expect(result.published).toBe(false);
      expect(result.reason).toContain("artifact not found");
    });

    it("returns no_changes when files unchanged", () => {
      const artifactPath = createEmptyArtifact(testDir);

      vi.mocked(execFileSync)
        .mockReturnValueOnce(REPO_ROOT)
        .mockReturnValueOnce("");

      const result = publishArtifacts([artifactPath], defaultOptions, testDir);
      expect(result.published).toBe(false);
      expect(result.reason).toBe("no_changes");
    });

    it("returns pushed when git operations succeed", () => {
      const artifactPath = createEmptyArtifact(testDir);

      vi.mocked(execFileSync)
        .mockReturnValue(REPO_ROOT)
        .mockReturnValueOnce(REPO_ROOT)
        .mockReturnValueOnce("M themes.json")
        .mockReturnValue("configured")
        .mockReturnValueOnce(DEFAULT_BRANCH)
        .mockReturnValue("")
        .mockReturnValue("")
        .mockReturnValue(`refs/remotes/${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`)
        .mockReturnValue("");

      const result = publishArtifacts([artifactPath], defaultOptions, testDir);
      expect(result.published).toBe(true);
      expect(result.reason).toBe("pushed");
    });

    it("returns committed_no_remote when remote branch missing", () => {
      const artifactPath = createEmptyArtifact(testDir);

      vi.mocked(execFileSync)
        .mockReturnValueOnce(REPO_ROOT)
        .mockReturnValueOnce("M themes.json")
        .mockReturnValueOnce("configured")
        .mockReturnValueOnce("configured")
        .mockReturnValueOnce(DEFAULT_BRANCH)
        .mockReturnValueOnce("")
        .mockReturnValueOnce("")
        .mockImplementationOnce(() => {
          throw new Error("remote not found");
        });

      const result = publishArtifacts([artifactPath], defaultOptions, testDir);
      expect(result.published).toBe(true);
      expect(result.reason).toBe("committed_no_remote");
    });

    it("throws on git command failure", () => {
      const artifactPath = createEmptyArtifact(testDir);

      vi.mocked(execFileSync).mockImplementationOnce(() => {
        throw new Error("git rev-parse failed");
      });

      expect(() =>
        publishArtifacts([artifactPath], defaultOptions, testDir)
      ).toThrow("git rev-parse failed");
    });

    it("calls git with correct commit message", () => {
      const artifactPath = createEmptyArtifact(testDir);

      vi.mocked(execFileSync)
        .mockReturnValue(REPO_ROOT)
        .mockReturnValueOnce(REPO_ROOT)
        .mockReturnValueOnce("M themes.json")
        .mockReturnValue("configured")
        .mockReturnValueOnce(DEFAULT_BRANCH)
        .mockReturnValue("")
        .mockReturnValue("")
        .mockReturnValue(`refs/remotes/${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`)
        .mockReturnValue("");

      publishArtifacts(
        [artifactPath],
        { ...defaultOptions, message: CUSTOM_COMMIT_MESSAGE },
        testDir
      );

      const calls = vi.mocked(execFileSync).mock.calls;
      const commitCall = calls.find((call) => call[1]?.includes?.("commit"));
      expect(commitCall).toBeDefined();
      expect(commitCall?.[1]).toContain("-m");
      expect(commitCall?.[1]).toContain(CUSTOM_COMMIT_MESSAGE);
    });

    it("calls git add with artifact paths", () => {
      const artifactPath = createEmptyArtifact(testDir);

      vi.mocked(execFileSync)
        .mockReturnValue(REPO_ROOT)
        .mockReturnValueOnce(REPO_ROOT)
        .mockReturnValueOnce("M themes.json")
        .mockReturnValue("configured")
        .mockReturnValueOnce(DEFAULT_BRANCH)
        .mockReturnValue("")
        .mockReturnValue("")
        .mockReturnValue(`refs/remotes/${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`)
        .mockReturnValue("");

      publishArtifacts([artifactPath], defaultOptions, testDir);

      const calls = vi.mocked(execFileSync).mock.calls;
      const addCall = calls.find((call) => call[1]?.includes?.("add"));
      expect(addCall).toBeDefined();
    });

    it("calls git push with correct remote and branch", () => {
      const artifactPath = createEmptyArtifact(testDir);

      vi.mocked(execFileSync)
        .mockReturnValue(REPO_ROOT)
        .mockReturnValueOnce(REPO_ROOT)
        .mockReturnValueOnce("M themes.json")
        .mockReturnValue("configured")
        .mockReturnValueOnce(DEFAULT_BRANCH)
        .mockReturnValue("")
        .mockReturnValue("")
        .mockReturnValue(`refs/remotes/${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`)
        .mockReturnValue("");

      publishArtifacts([artifactPath], defaultOptions, testDir);

      const calls = vi.mocked(execFileSync).mock.calls;
      const pushCall = calls.find((call) => call[1]?.includes?.("push"));
      expect(pushCall).toBeDefined();
      expect(pushCall?.[1]).toContain("push");
      expect(pushCall?.[1]).toContain(DEFAULT_REMOTE);
      expect(pushCall?.[1]).toContain(DEFAULT_BRANCH);
    });
  });
});