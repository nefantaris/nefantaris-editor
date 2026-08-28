import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { createTempDir } from "./helpers.ts";

const execFileAsync = promisify(execFile);
const runningServers: http.Server[] = [];

export async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

function cgiHeadersFromRequest(
  request: http.IncomingMessage,
  repoRoot: string,
  url: URL,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_PROJECT_ROOT: repoRoot,
    GIT_HTTP_EXPORT_ALL: "1",
    PATH_INFO: url.pathname,
    REQUEST_METHOD: request.method ?? "GET",
    QUERY_STRING: url.searchParams.toString(),
    CONTENT_TYPE: request.headers["content-type"] ?? "",
    CONTENT_LENGTH: request.headers["content-length"] ?? "",
    HTTP_CONTENT_ENCODING: request.headers["content-encoding"] ?? "",
    REMOTE_ADDR: "127.0.0.1",
  };
}

function writeCgiResponse(
  headerText: string,
  response: http.ServerResponse,
): void {
  const headers: Record<string, string> = {};
  let status = 200;
  for (const line of headerText.split("\r\n")) {
    const colonAt = line.indexOf(":");
    if (colonAt === -1) {
      continue;
    }
    const name = line.slice(0, colonAt).trim().toLowerCase();
    const value = line.slice(colonAt + 1).trim();
    if (name === "status") {
      status = Number(value.split(" ", 1)[0]);
    } else {
      headers[name] = value;
    }
  }
  response.writeHead(status, headers);
}

function startGitHttpServer(
  repoRoot: string,
): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const backend = spawn("git", ["http-backend"], {
      env: cgiHeadersFromRequest(request, repoRoot, url),
    });
    request.pipe(backend.stdin);
    let headerBuffer = Buffer.alloc(0);
    let isBodyStarted = false;
    backend.stdout.on("data", (chunk: Buffer) => {
      if (isBodyStarted) {
        response.write(chunk);
        return;
      }
      headerBuffer = Buffer.concat([headerBuffer, chunk]);
      const splitAt = headerBuffer.indexOf("\r\n\r\n");
      if (splitAt === -1) {
        return;
      }
      writeCgiResponse(headerBuffer.subarray(0, splitAt).toString(), response);
      isBodyStarted = true;
      const body = headerBuffer.subarray(splitAt + 4);
      if (body.length > 0) {
        response.write(body);
      }
    });
    backend.stdout.on("end", () => response.end());
    backend.on("error", () => {
      response.writeHead(500);
      response.end();
    });
  });
  runningServers.push(server);
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("The git server has no port"));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

export type RemoteRepoFixture = {
  rootPath: string;
  seedPath: string;
  barePath: string;
  remoteUrl: string;
  stopServer: () => Promise<void>;
};

export type GitSiteFixture = RemoteRepoFixture & {
  sitePath: string;
};

async function writeFixtureFiles(
  root: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [relativePath, text] of Object.entries(files)) {
    const absolute = path.join(root, relativePath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, text);
  }
}

export async function createRemoteRepo(
  files: Record<string, string>,
): Promise<RemoteRepoFixture> {
  const rootPath = await createTempDir("nefantaris-gitsite-");
  const barePath = path.join(rootPath, "origin.git");
  await mkdir(barePath);
  await runGit(rootPath, ["init", "--bare", "-b", "main", "origin.git"]);
  await runGit(barePath, ["config", "http.receivepack", "true"]);
  const { server, port } = await startGitHttpServer(rootPath);
  const remoteUrl = `http://127.0.0.1:${port}/origin.git`;

  const seedPath = path.join(rootPath, "seed");
  await runGit(rootPath, ["clone", remoteUrl, "seed"]);
  await runGit(seedPath, ["config", "user.name", "Seed Author"]);
  await runGit(seedPath, ["config", "user.email", "seed@test.local"]);
  await writeFixtureFiles(seedPath, files);
  await runGit(seedPath, ["add", "-A"]);
  await runGit(seedPath, ["commit", "-m", "First version"]);
  await runGit(seedPath, ["push", "origin", "main"]);

  const stopServer = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  return { rootPath, seedPath, barePath, remoteUrl, stopServer };
}

export type EmptyRemoteRoot = {
  rootPath: string;
  urlBase: string;
  barePathFor: (name: string) => string;
};

export async function createEmptyRemoteRoot(
  names: string[],
): Promise<EmptyRemoteRoot> {
  const rootPath = await createTempDir("nefantaris-emptyremote-");
  for (const name of names) {
    const barePath = path.join(rootPath, `${name}.git`);
    await mkdir(barePath);
    await runGit(rootPath, ["init", "--bare", "-b", "main", `${name}.git`]);
    await runGit(barePath, ["config", "http.receivepack", "true"]);
  }
  const { port } = await startGitHttpServer(rootPath);
  return {
    rootPath,
    urlBase: `http://127.0.0.1:${port}`,
    barePathFor: (name: string) => path.join(rootPath, `${name}.git`),
  };
}

export async function createGitSite(
  name: string,
  files: Record<string, string>,
): Promise<GitSiteFixture> {
  const remote = await createRemoteRepo({
    "nefantaris.json": JSON.stringify({ name }),
    ...files,
  });

  const sitePath = path.join(remote.rootPath, "site");
  await runGit(remote.rootPath, ["clone", remote.remoteUrl, "site"]);
  await runGit(sitePath, ["config", "user.name", "Test Author"]);
  await runGit(sitePath, ["config", "user.email", "author@test.local"]);

  return { ...remote, sitePath };
}

export async function pushFromSeed(
  fixture: GitSiteFixture,
  files: Record<string, string | null>,
  message: string,
): Promise<void> {
  await runGit(fixture.seedPath, ["pull"]);
  for (const [relativePath, text] of Object.entries(files)) {
    const absolute = path.join(fixture.seedPath, relativePath);
    await (text === null
      ? rm(absolute)
      : (async () => {
          await mkdir(path.dirname(absolute), { recursive: true });
          await writeFile(absolute, text);
        })());
  }
  await runGit(fixture.seedPath, ["add", "-A"]);
  await runGit(fixture.seedPath, ["commit", "-m", message]);
  await runGit(fixture.seedPath, ["push", "origin", "main"]);
}

export async function bareFileContent(
  fixture: GitSiteFixture,
  relativePath: string,
): Promise<string> {
  return runGit(fixture.barePath, ["show", `main:${relativePath}`]);
}

export async function bareLastMessage(
  fixture: GitSiteFixture,
): Promise<string> {
  return runGit(fixture.barePath, ["log", "-1", "--format=%B", "main"]);
}

export async function bareLastParentCount(
  fixture: GitSiteFixture,
): Promise<number> {
  const parents = await runGit(fixture.barePath, [
    "log",
    "-1",
    "--format=%P",
    "main",
  ]);
  return parents.trim().split(/\s+/).filter(Boolean).length;
}

export async function bareHeadOid(fixture: GitSiteFixture): Promise<string> {
  return (await runGit(fixture.barePath, ["rev-parse", "main"])).trim();
}

export async function workingTreeStatus(sitePath: string): Promise<string> {
  return runGit(sitePath, ["status", "--porcelain"]);
}

export async function siteFileContent(
  sitePath: string,
  relativePath: string,
): Promise<string | null> {
  try {
    return await readFile(path.join(sitePath, relativePath), "utf8");
  } catch {
    return null;
  }
}

export async function closeGitServers(): Promise<void> {
  await Promise.all(
    runningServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        }),
    ),
  );
}
