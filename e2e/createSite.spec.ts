import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createFakeCore } from "./fakeCore.ts";
import { startFakeGithub, type FakeGithub } from "./fakeGithub.ts";
import {
  closeGitServers,
  createEmptyRemoteRoot,
  runGit,
} from "./gitFixture.ts";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

const unconfiguredGithubEnv = {
  NEFANTARIS_GITHUB_CLIENT_ID: "",
  NEFANTARIS_GITHUB_OAUTH_URL: "",
  NEFANTARIS_GITHUB_API_URL: "",
};

const stoppables: { stop: () => Promise<void> }[] = [];

async function signInFromWelcome(
  welcome: Page,
  fake: FakeGithub,
): Promise<void> {
  await welcome.getByRole("button", { name: "Sign in to GitHub" }).click();
  await expect(welcome.getByRole("dialog")).toContainText(fake.userCode);
  await expect(welcome.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
}

async function fillNameStep(
  app: ElectronApplication,
  welcome: Page,
  siteName: string,
  parentDir: string,
  themeDir: string,
): Promise<Locator> {
  await welcome.getByRole("button", { name: "Create site" }).click();
  const dialog = welcome.getByRole("dialog");
  await dialog.getByLabel("Site name").fill(siteName);
  await stubDirectoryPicker(app, parentDir);
  await dialog.getByRole("button", { name: "Choose where to keep it" }).click();
  await dialog.getByLabel("Theme folder").fill(themeDir);
  return dialog;
}

async function startFlipServer(): Promise<{
  url: string;
  stop: () => Promise<void>;
}> {
  let requestCount = 0;
  const server = http.createServer((_request, response) => {
    requestCount += 1;
    if (requestCount <= 1) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not deployed yet");
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><html><body>live</body></html>");
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The flip server has no port");
  }
  return {
    url: `http://127.0.0.1:${address.port}/`,
    stop: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

test.afterEach(async () => {
  await cleanupTestArtifacts();
  await closeGitServers();
  await Promise.all(stoppables.splice(0).map((server) => server.stop()));
});

test("creating a local-only site scaffolds, names, versions, and opens it", async () => {
  const fakeCoreDir = await createFakeCore();
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const parentDir = await createTempDir("nefantaris-create-parent-");
  const themeDir = await createTempDir("nefantaris-faketheme-");
  const app = await launchEditor(userDataDir, {
    ...unconfiguredGithubEnv,
    NEFANTARIS_CORE_DIR: fakeCoreDir,
  });
  const welcome = await app.firstWindow();

  const dialog = await fillNameStep(
    app,
    welcome,
    "My Test Site",
    parentDir,
    themeDir,
  );
  const sitePath = path.join(parentDir, "my-test-site");
  await expect(dialog).toContainText(`Your site will be saved at ${sitePath}`);
  await dialog.getByRole("button", { name: "Create my site" }).click();

  await expect(dialog).toContainText("Online publishing isn’t set up");
  await dialog.getByRole("button", { name: "Skip for now" }).click();
  await expect(dialog).toContainText("Your site is ready on this computer.");

  const config: unknown = JSON.parse(
    await readFile(path.join(sitePath, "nefantaris.json"), "utf8"),
  );
  expect(config).toMatchObject({
    name: "My Test Site",
    theme: { source: themeDir },
  });
  expect(
    (await runGit(sitePath, ["rev-parse", "--abbrev-ref", "HEAD"])).trim(),
  ).toBe("main");
  expect((await runGit(sitePath, ["log", "-1", "--format=%B"])).trim()).toBe(
    "First version",
  );
  expect(await runGit(sitePath, ["ls-files"])).toContain("nefantaris.json");
  const recentsRaw = await readFile(
    path.join(userDataDir, "recent-sites.json"),
    "utf8",
  );
  expect(recentsRaw).toContain(sitePath);

  const siteWindowPromise = app.waitForEvent("window");
  await dialog.getByRole("button", { name: "Open my site" }).click();
  const siteWindow = await siteWindowPromise;
  await expect(siteWindow.getByTestId("site-name")).toHaveText("My Test Site");
  await expect.poll(() => app.windows().length).toBe(1);
});

test("an existing folder with the derived name blocks creation inline", async () => {
  const fakeCoreDir = await createFakeCore();
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const parentDir = await createTempDir("nefantaris-create-parent-");
  const themeDir = await createTempDir("nefantaris-faketheme-");
  await mkdir(path.join(parentDir, "my-test-site"));
  const app = await launchEditor(userDataDir, {
    ...unconfiguredGithubEnv,
    NEFANTARIS_CORE_DIR: fakeCoreDir,
  });
  const welcome = await app.firstWindow();

  const dialog = await fillNameStep(
    app,
    welcome,
    "My Test Site",
    parentDir,
    themeDir,
  );

  await expect(dialog.getByRole("alert")).toContainText(
    "already a folder named “my-test-site”",
  );
  await expect(
    dialog.getByRole("button", { name: "Create my site" }),
  ).toBeDisabled();
});

test("a failing init shows a friendly error and cleans up the folder", async () => {
  const fakeCoreDir = await createFakeCore();
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const parentDir = await createTempDir("nefantaris-create-parent-");
  const themeDir = await createTempDir("nefantaris-faketheme-");
  const app = await launchEditor(userDataDir, {
    ...unconfiguredGithubEnv,
    NEFANTARIS_CORE_DIR: fakeCoreDir,
    FAKE_CORE_INIT_BEHAVIOR: "fail",
  });
  const welcome = await app.firstWindow();

  const dialog = await fillNameStep(
    app,
    welcome,
    "Doomed Site",
    parentDir,
    themeDir,
  );
  await dialog.getByRole("button", { name: "Create my site" }).click();

  await expect(dialog.getByRole("alert")).toContainText(
    "Your site couldn't be created: fake core: init failed on purpose",
  );
  expect(existsSync(path.join(parentDir, "doomed-site"))).toBe(false);
  await expect(dialog.getByLabel("Site name")).toHaveValue("Doomed Site");
});

test("putting a site online publishes the first version and walks through Cloudflare", async () => {
  test.setTimeout(60_000);
  const fakeCoreDir = await createFakeCore();
  const emptyRemote = await createEmptyRemoteRoot(["blog-2"]);
  const fake = await startFakeGithub({
    takenRepoNames: ["blog"],
    createdCloneUrlBase: emptyRemote.urlBase,
  });
  stoppables.push(fake);
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const parentDir = await createTempDir("nefantaris-create-parent-");
  const themeDir = await createTempDir("nefantaris-faketheme-");
  const app = await launchEditor(userDataDir, {
    ...fake.env,
    NEFANTARIS_CORE_DIR: fakeCoreDir,
  });
  const welcome = await app.firstWindow();
  await signInFromWelcome(welcome, fake);

  const dialog = await fillNameStep(app, welcome, "Blog", parentDir, themeDir);
  await dialog.getByRole("button", { name: "Create my site" }).click();

  const repoNameField = dialog.getByLabel("Name for the online copy");
  await expect(repoNameField).toHaveValue("blog");
  await dialog.getByRole("button", { name: "Put it online" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "That name is already used in your GitHub account.",
  );
  await repoNameField.fill("blog-2");
  await dialog.getByRole("button", { name: "Put it online" }).click();

  await expect(dialog).toContainText("Cloudflare Pages hosts your site");
  expect(fake.createdRepoNames()).toEqual(["blog-2"]);
  const sitePath = path.join(parentDir, "blog");
  expect((await runGit(sitePath, ["remote", "get-url", "origin"])).trim()).toBe(
    `${emptyRemote.urlBase}/blog-2.git`,
  );
  expect(
    (
      await runGit(emptyRemote.barePathFor("blog-2"), [
        "log",
        "-1",
        "--format=%B",
        "main",
      ])
    ).trim(),
  ).toBe("First version");

  await expect(
    dialog.locator("code", { hasText: "npx nef build" }),
  ).toBeVisible();
  await expect(dialog.locator("code", { hasText: /^dist$/ })).toBeVisible();
  const addressField = dialog.getByLabel(/Your site.s address/);
  await expect(addressField).toHaveValue("https://blog-2.pages.dev");

  const flipServer = await startFlipServer();
  stoppables.push(flipServer);
  await addressField.fill(flipServer.url);
  await dialog.getByRole("button", { name: "Check", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Your site is live.", {
    timeout: 20_000,
  });

  const siteWindowPromise = app.waitForEvent("window");
  await dialog.getByRole("button", { name: "Open my site" }).click();
  const siteWindow = await siteWindowPromise;
  await expect(siteWindow.getByTestId("site-name")).toHaveText("Blog");
});
