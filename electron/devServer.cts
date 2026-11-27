import type { UtilityProcess } from "electron";
import { app, utilityProcess } from "electron";
import { execFile } from "node:child_process";
import net from "node:net";
import path from "node:path";
import type { PreviewProblem, PreviewStatus } from "./ipcContract.cjs";
import { broadcast } from "./typedIpc.cjs";

const READY_TIMEOUT_MS = 60_000;
const READY_POLL_INTERVAL_MS = 250;
const READY_PROBE_TIMEOUT_MS = 2000;
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_BACKOFF_MS = 500;
const KILL_GRACE_MS = 3000;
const LOG_TAIL_LIMIT_CHARS = 8000;
const PROBLEM_DETAIL_LINE_LIMIT = 8;

const ansiPattern = new RegExp(String.raw`\u001B\[[0-9;?]*[A-Za-z]`, "g");
const problemStartPattern =
  /\[vite\] (?:Internal server error|Pre-transform error):\s*(.*)$/;
const problemFilePattern = /^\s*File:\s*(.+?)(?::(\d+)(?::\d+)?)?\s*$/;
const problemDetailEndPattern = /^\s*(?:at\s|Plugin:|File:)/;
const recoveryPattern =
  /\[vite\] (?:\(client\) )?(?:hmr update|page reload)(.*)$/;
const generatedSourceMarker = "/.nefantaris/src/";
const generatedThemeMarker = "/.nefantaris/src/theme/";

const bundledCoreDir: string | null = null;

export function resolveCoreDir(): string {
  const envOverride = process.env.NEFANTARIS_CORE_DIR;
  if (envOverride) {
    return envOverride;
  }
  if (bundledCoreDir !== null) {
    return bundledCoreDir;
  }
  return path.resolve(app.getAppPath(), "..", "nefantaris-core");
}

function coreDevEntryPath(): string {
  return path.join(resolveCoreDir(), "dist", "cli", "index.js");
}

type TrackedProblem = {
  problem: PreviewProblem;
  servedPath: string | null;
  isCollecting: boolean;
};

type PreviewServer = {
  child: UtilityProcess | null;
  childPid: number | null;
  status: PreviewStatus;
  logTail: string;
  partialLine: string;
  tracked: TrackedProblem | null;
  restartAttempts: number;
  isStopping: boolean;
  generation: number;
};

const serversBySitePath = new Map<string, PreviewServer>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function updateStatus(
  sitePath: string,
  server: PreviewServer,
  status: PreviewStatus,
): void {
  server.status = status;
  broadcast("preview:status", { sitePath, status });
}

function appendLog(server: PreviewServer, chunk: Buffer): void {
  server.logTail = (server.logTail + chunk.toString("utf8")).slice(
    -LOG_TAIL_LIMIT_CHARS,
  );
}

function siteFileOf(generatedPath: string): string | null {
  const normalized = generatedPath.split(path.sep).join("/");
  const themeIndex = normalized.indexOf(generatedThemeMarker);
  if (themeIndex !== -1) {
    return normalized.slice(themeIndex + generatedThemeMarker.length);
  }
  return normalized.endsWith(`${generatedSourceMarker}custom.css`)
    ? "custom.css"
    : null;
}

function servedPathOf(generatedPath: string): string | null {
  const normalized = generatedPath.split(path.sep).join("/");
  const sourceIndex = normalized.indexOf(generatedSourceMarker);
  return sourceIndex === -1
    ? null
    : normalized.slice(sourceIndex + generatedSourceMarker.length - 1);
}

function trackedAfterLine(
  tracked: TrackedProblem | null,
  line: string,
): TrackedProblem | null {
  const start = problemStartPattern.exec(line);
  if (start !== null) {
    return {
      problem: { file: null, line: null, detail: start[1].trim() },
      servedPath: null,
      isCollecting: true,
    };
  }
  const recovery = recoveryPattern.exec(line);
  if (recovery !== null) {
    const isRecovered =
      tracked !== null &&
      (tracked.servedPath === null || recovery[1].includes(tracked.servedPath));
    return isRecovered ? null : tracked;
  }
  if (tracked === null || !tracked.isCollecting) {
    return tracked;
  }
  const file = problemFilePattern.exec(line);
  if (file !== null) {
    return {
      problem: {
        ...tracked.problem,
        file: siteFileOf(file[1]),
        line: file[2] === undefined ? null : Number(file[2]),
      },
      servedPath: servedPathOf(file[1]),
      isCollecting: false,
    };
  }
  const detailLines = tracked.problem.detail.split("\n");
  if (
    problemDetailEndPattern.test(line) ||
    line.trim() === "" ||
    detailLines.length >= PROBLEM_DETAIL_LINE_LIMIT
  ) {
    return tracked;
  }
  return {
    ...tracked,
    problem: {
      ...tracked.problem,
      detail: [...detailLines, line.trimEnd()].join("\n"),
    },
  };
}

function currentProblemOf(server: PreviewServer): PreviewProblem | null {
  return server.tracked?.problem ?? null;
}

function trackProblems(
  sitePath: string,
  server: PreviewServer,
  chunk: Buffer,
): void {
  const lines = (server.partialLine + chunk.toString("utf8")).split(/\r?\n/);
  server.partialLine = lines.pop() ?? "";
  const before = currentProblemOf(server);
  for (const line of lines) {
    server.tracked = trackedAfterLine(
      server.tracked,
      line.replaceAll(ansiPattern, ""),
    );
  }
  const after = currentProblemOf(server);
  if (before !== after && server.status.state === "ready") {
    updateStatus(sitePath, server, { ...server.status, problem: after });
  }
}

function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close();
        reject(new Error("Could not allocate a preview port"));
        return;
      }
      const port = address.port;
      probe.close(() => resolve(port));
    });
  });
}

async function probeUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(READY_PROBE_TIMEOUT_MS),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitUntilResponding(
  url: string,
  isStale: () => boolean,
): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline && !isStale()) {
    if (await probeUrl(url)) {
      return true;
    }
    await delay(READY_POLL_INTERVAL_MS);
  }
  return false;
}

function listChildPids(pid: number): Promise<number[]> {
  if (process.platform === "win32") {
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    execFile("pgrep", ["-P", String(pid)], (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }
      resolve(
        stdout
          .split("\n")
          .map((line) => Number(line.trim()))
          .filter((value) => Number.isInteger(value) && value > 0),
      );
    });
  });
}

async function listDescendantPids(pid: number): Promise<number[]> {
  const children = await listChildPids(pid);
  const nested = await Promise.all(
    children.map((childPid) => listDescendantPids(childPid)),
  );
  return [...children, ...nested.flat()];
}

function signalPid(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal);
  } catch {
    return;
  }
}

function waitForExit(
  child: UtilityProcess,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function killChildTree(server: PreviewServer): Promise<void> {
  const child = server.child;
  if (!child) {
    return;
  }
  const pid = server.childPid;
  const descendants = pid === null ? [] : await listDescendantPids(pid);
  child.kill();
  for (const descendant of descendants) {
    signalPid(descendant, "SIGTERM");
  }
  const hasExited = await waitForExit(child, KILL_GRACE_MS);
  if (!hasExited && pid !== null) {
    signalPid(pid, "SIGKILL");
  }
  for (const descendant of descendants) {
    signalPid(descendant, "SIGKILL");
  }
}

async function restartAfterCrash(
  sitePath: string,
  server: PreviewServer,
  exitCode: number,
): Promise<void> {
  if (server.restartAttempts >= MAX_RESTART_ATTEMPTS) {
    updateStatus(sitePath, server, {
      state: "error",
      message: `The preview server keeps stopping (last exit code ${exitCode}).`,
      logTail: server.logTail,
    });
    return;
  }
  server.restartAttempts += 1;
  await delay(RESTART_BACKOFF_MS * server.restartAttempts);
  if (server.isStopping) {
    return;
  }
  await runSpawnCycle(sitePath, server);
}

async function runSpawnCycle(
  sitePath: string,
  server: PreviewServer,
): Promise<void> {
  const generation = ++server.generation;
  const isStale = () =>
    server.generation !== generation ||
    server.isStopping ||
    server.child === null;
  updateStatus(sitePath, server, { state: "starting" });
  const port = await pickFreePort();
  const child = utilityProcess.fork(
    path.join(__dirname, "coreDevHost.cjs"),
    [
      coreDevEntryPath(),
      "dev",
      sitePath,
      "--editor",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      stdio: "pipe",
      serviceName: `nef-dev ${path.basename(sitePath)}`,
    },
  );
  server.child = child;
  server.childPid = null;
  child.once("spawn", () => {
    server.childPid = child.pid ?? null;
  });
  server.partialLine = "";
  server.tracked = null;
  const handleOutput = (chunk: Buffer) => {
    appendLog(server, chunk);
    trackProblems(sitePath, server, chunk);
  };
  child.stdout?.on("data", handleOutput);
  child.stderr?.on("data", handleOutput);
  child.once("exit", (exitCode) => {
    if (server.generation !== generation) {
      return;
    }
    server.child = null;
    server.childPid = null;
    if (server.isStopping) {
      updateStatus(sitePath, server, { state: "stopped" });
      return;
    }
    void restartAfterCrash(sitePath, server, exitCode);
  });
  const url = `http://localhost:${port}/`;
  const isResponding = await waitUntilResponding(url, isStale);
  if (isStale()) {
    return;
  }
  if (!isResponding) {
    appendLog(
      server,
      Buffer.from(
        `\nThe preview server did not respond within ${READY_TIMEOUT_MS / 1000} seconds.\n`,
      ),
    );
    await killChildTree(server);
    return;
  }
  updateStatus(sitePath, server, {
    state: "ready",
    url,
    problem: currentProblemOf(server),
  });
}

export function getPreviewStatus(sitePath: string): PreviewStatus {
  return serversBySitePath.get(sitePath)?.status ?? { state: "stopped" };
}

export function startPreviewServer(sitePath: string): PreviewStatus {
  const existing = serversBySitePath.get(sitePath);
  if (
    existing &&
    (existing.status.state === "starting" || existing.status.state === "ready")
  ) {
    return existing.status;
  }
  const server: PreviewServer = existing ?? {
    child: null,
    childPid: null,
    status: { state: "stopped" },
    logTail: "",
    partialLine: "",
    tracked: null,
    restartAttempts: 0,
    isStopping: false,
    generation: 0,
  };
  serversBySitePath.set(sitePath, server);
  server.isStopping = false;
  server.restartAttempts = 0;
  server.logTail = "";
  void runSpawnCycle(sitePath, server);
  return server.status;
}

export async function stopPreviewServer(sitePath: string): Promise<void> {
  const server = serversBySitePath.get(sitePath);
  if (!server) {
    return;
  }
  server.isStopping = true;
  await killChildTree(server);
  if (server.status.state !== "stopped") {
    updateStatus(sitePath, server, { state: "stopped" });
  }
}

export async function stopAllPreviewServers(): Promise<void> {
  await Promise.all(
    [...serversBySitePath.keys()].map((sitePath) =>
      stopPreviewServer(sitePath),
    ),
  );
}
