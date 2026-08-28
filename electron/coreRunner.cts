import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveCoreDir } from "./devServer.cjs";

const CORE_COMMAND_TIMEOUT_MS = 60_000;
const CORE_OUTPUT_LIMIT_BYTES = 16 * 1024 * 1024;

export type CoreRunOutcome =
  | { status: "ran"; exitCode: number; stdout: string; stderr: string }
  | { status: "core-missing" };

export function runCoreCommand(args: string[]): Promise<CoreRunOutcome> {
  const entryPath = path.join(resolveCoreDir(), "dist", "cli", "index.js");
  if (!fs.existsSync(entryPath)) {
    return Promise.resolve({ status: "core-missing" });
  }
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [entryPath, ...args],
      {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        timeout: CORE_COMMAND_TIMEOUT_MS,
        maxBuffer: CORE_OUTPUT_LIMIT_BYTES,
      },
      (error, stdout, stderr) => {
        const exitCode =
          error === null ? 0 : typeof error.code === "number" ? error.code : 1;
        resolve({ status: "ran", exitCode, stdout, stderr });
      },
    );
  });
}
