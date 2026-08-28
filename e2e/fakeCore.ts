import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTempDir } from "./helpers.ts";

export type FakeCoreMode =
  "serve" | "slow-start" | "crash-once" | "always-crash";

export const fakeInspectTemplates = [
  "fakeSplash",
  "fakeGallery",
  "fakeContact",
];

const fakeCoreCliSource = String.raw`const fs = require("node:fs");
const path = require("node:path");

const [command, ...rest] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runDev(args) {
  const http = require("node:http");
  const [siteDir, portFlag, portValue, strictFlag] = args;
  if (!siteDir || portFlag !== "--port" || !portValue || strictFlag !== "--strictPort") {
    fail("fake core: unexpected dev arguments: " + args.join(" "));
  }

  const port = Number(portValue);
  const modePath = path.join(siteDir, ".fake-core-mode");
  const crashMarkerPath = path.join(siteDir, ".fake-core-crashed");

  function readMode() {
    try {
      return fs.readFileSync(modePath, "utf8").trim();
    } catch {
      return "serve";
    }
  }

  const server = http.createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(
      "<!doctype html><html><head><title>Fake Core</title></head><body>" +
        "<h1>Fake Core</h1><p id='request-path'>" +
        request.url +
        "</p></body></html>",
    );
    const mode = readMode();
    if (mode === "always-crash") {
      setTimeout(() => process.exit(1), 20);
      return;
    }
    if (mode === "crash-once" && !fs.existsSync(crashMarkerPath)) {
      fs.writeFileSync(crashMarkerPath, "crashed");
      setTimeout(() => process.exit(1), 20);
    }
  });

  const startDelay = readMode() === "slow-start" ? 1500 : 0;
  setTimeout(() => {
    server.listen(port, () => {
      console.log("fake core listening on " + port);
    });
  }, startDelay);
}

function runInspect(args) {
  const [siteDir, jsonFlag] = args;
  if (!siteDir || jsonFlag !== "--json") {
    fail("fake core: unexpected inspect arguments: " + args.join(" "));
  }
  if (process.env.FAKE_CORE_INSPECT_BEHAVIOR === "fail") {
    fail("fake core: inspect failed on purpose");
  }
  let name = "Fake Site";
  try {
    const config = JSON.parse(
      fs.readFileSync(path.join(siteDir, "nefantaris.json"), "utf8"),
    );
    if (typeof config.name === "string") {
      name = config.name;
    }
  } catch {}
  console.log(
    JSON.stringify({
      contract: 1,
      site: { name, nav: [], plugins: [] },
      templates: ["fakeSplash", "fakeGallery", "fakeContact"],
      directives: ["fakeNote"],
      plugins: [],
    }),
  );
}

function runInit(args) {
  const [siteDir, themeFlag, themeSource] = args;
  if (!siteDir || themeFlag !== "--theme" || !themeSource) {
    fail("fake core: unexpected init arguments: " + args.join(" "));
  }
  if (process.env.FAKE_CORE_INIT_BEHAVIOR === "fail") {
    fs.mkdirSync(path.join(siteDir, "content"), { recursive: true });
    fail("fake core: init failed on purpose");
  }
  fs.mkdirSync(path.join(siteDir, "content", "pages"), { recursive: true });
  fs.mkdirSync(path.join(siteDir, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(siteDir, "nefantaris.json"),
    JSON.stringify(
      {
        name: "Fake Site",
        theme: { source: themeSource, version: "local" },
      },
      null,
      4,
    ) + "\n",
  );
  fs.writeFileSync(
    path.join(siteDir, "content", "pages", "index.md"),
    "---\ntitle: Home\n---\n\nWelcome.\n",
  );
  fs.writeFileSync(path.join(siteDir, "assets", ".gitkeep"), "");
}

if (command === "dev") {
  runDev(rest);
} else if (command === "inspect") {
  runInspect(rest);
} else if (command === "init") {
  runInit(rest);
} else {
  fail("fake core: unexpected command: " + String(command));
}
`;

export async function createFakeCore(): Promise<string> {
  const dir = await createTempDir("nefantaris-fakecore-");
  await mkdir(path.join(dir, "dist", "cli"), { recursive: true });
  await writeFile(path.join(dir, "dist", "cli", "index.js"), fakeCoreCliSource);
  return dir;
}

export async function setFakeCoreMode(
  sitePath: string,
  mode: FakeCoreMode,
): Promise<void> {
  await writeFile(path.join(sitePath, ".fake-core-mode"), mode);
}
