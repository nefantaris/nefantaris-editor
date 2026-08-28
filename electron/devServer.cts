import type { UtilityProcess } from "electron";
import { app, utilityProcess } from "electron";
import { execFile } from "node:child_process";
import net from "node:net";
import path from "node:path";
import type { PreviewStatus } from "./ipcContract.cjs";
import { broadcast } from "./typedIpc.cjs";

const READY_TIMEOUT_MS = 60_000;
const READY_POLL_INTERVAL_MS = 250;
const READY_PROBE_TIMEOUT_MS = 2000;
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_BACKOFF_MS = 500;
const KILL_GRACE_MS = 3000;
const LOG_TAIL_LIMIT_CHARS = 8000;

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

type PreviewServer = {
  child: UtilityProcess | null;
  childPid: number | null;
  status: PreviewStatus;
  logTail: string;
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
    coreDevEntryPath(),
    ["dev", sitePath, "--port", String(port), "--strictPort"],
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
  child.stdout?.on("data", (chunk: Buffer) => appendLog(server, chunk));
  child.stderr?.on("data", (chunk: Buffer) => appendLog(server, chunk));
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
  updateStatus(sitePath, server, { state: "ready", url });
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
