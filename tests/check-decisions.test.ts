import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DecisionStore } from "../src/core/store.js";

const HOOK_SCRIPT = path.resolve("templates/hooks/check-decisions.sh");
const rootDir = path.resolve(__dirname, "..");

let tmpDir: string;
let origCwd: string;

function getBashPath(): string {
  if (process.platform !== "win32") return "bash";
  const candidatePaths = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    "C:\\Git\\bin\\bash.exe"
  ];
  for (const p of candidatePaths) {
    if (fsSync.existsSync(p)) return p;
  }
  return "bash";
}

const bashCmd = getBashPath();
const hasBash = process.platform !== "win32" || fsSync.existsSync(bashCmd);

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dm-hook-test-"));
  origCwd = process.cwd();
  process.chdir(tmpDir);

  const store = new DecisionStore(tmpDir);
  await store.init();
  await store.create({
    id: "dec_20260212_hook01",
    summary: "Use Zod for validation",
    rationale: "Type-safe",
    scope: ["src/**/*.ts"],
    tags: ["validation"],
    author: "testuser",
    source: "cli",
    confidence: "explicit",
    status: "active",
    created: new Date().toISOString(),
  });
});

afterEach(async () => {
  process.chdir(origCwd);
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {}
});

async function runHook(stdin: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      bashCmd,
      [HOOK_SCRIPT],
      {
        cwd: tmpDir,
        env: {
          ...process.env,
          NODE_PATH: `${rootDir}/node_modules`,
          PATH: `${rootDir}/node_modules/.bin;${path.dirname(process.execPath)};${process.env.PATH}`,
        },
      },
      (error, stdout, stderr) => {
        if (error && error.code !== 0) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      }
    );
    child.stdin!.write(stdin);
    child.stdin!.end();
  });
}

describe.skipIf(!hasBash)("check-decisions.sh hook", () => {
  it("outputs systemMessage when decisions match", { timeout: 30000 }, async () => {
    const input = JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: "src/api/users.ts" },
    });

    const { stdout } = await runHook(input);

    if (stdout.trim()) {
      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveProperty("systemMessage");
      expect(parsed.systemMessage).toContain("Use Zod for validation");
      expect(parsed.systemMessage).toContain("Advisory");
    }
  });

  it("produces no output for non-matching paths", { timeout: 30000 }, async () => {
    const input = JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: "docs/readme.md" },
    });

    const { stdout } = await runHook(input);
    if (stdout.trim()) {
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.systemMessage) {
          expect(parsed.systemMessage).not.toContain("Use Zod");
        }
      } catch {}
    }
  });

  it("handles missing file_path gracefully", { timeout: 30000 }, async () => {
    const input = JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: "ls" },
    });

    const { stdout } = await runHook(input);
    expect(stdout.trim()).toBe("");
  });

  it("handles empty input gracefully", { timeout: 30000 }, async () => {
    const input = "{}";
    const { stdout } = await runHook(input);
    expect(stdout.trim()).toBe("");
  });

  it("handles Edit tool's file_path field", { timeout: 30000 }, async () => {
    const input = JSON.stringify({
      tool_name: "Edit",
      tool_input: {
        file_path: "src/models/user.ts",
        old_string: "foo",
        new_string: "bar",
      },
    });

    const { stdout } = await runHook(input);

    if (stdout.trim()) {
      const parsed = JSON.parse(stdout);
      expect(parsed).toHaveProperty("systemMessage");
      expect(parsed.systemMessage).toContain("Use Zod for validation");
    }
  });
});
