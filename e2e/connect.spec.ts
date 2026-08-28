import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { startFakeGithub, type FakeGithub } from "./fakeGithub.ts";
import { closeGitServers, createRemoteRepo } from "./gitFixture.ts";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

const stoppables: { stop: () => Promise<void> }[] = [];

function bulkyPages(): Record<string, string> {
  const pages: Record<string, string> = {};
  for (let index = 0; index < 40; index += 1) {
    const filler = Array.from(
      { length: 800 },
      (_, line) => `Paragraph ${line} of page ${index} — ${Math.sin(line)}`,
    ).join("\n");
    pages[`content/pages/page-${index}.md`] =
      `---\ntitle: Page ${index}\n---\n\n${filler}\n`;
  }
  return pages;
}

async function signInFromWelcome(
  welcome: Page,
  fake: FakeGithub,
): Promise<void> {
  await welcome.getByRole("button", { name: "Sign in to GitHub" }).click();
  await expect(welcome.getByRole("dialog")).toContainText(fake.userCode);
  await expect(welcome.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
}

test.afterEach(async () => {
  await cleanupTestArtifacts();
  await closeGitServers();
  await Promise.all(stoppables.splice(0).map((server) => server.stop()));
});

test("connect existing site lists repos, filters, clones with progress, and opens the site", async () => {
  const remote = await createRemoteRepo({
    "nefantaris.json": JSON.stringify({ name: "Cloned Site" }),
    "content/pages/index.md": "---\ntitle: Home\n---\n\nWelcome home.\n",
    ...bulkyPages(),
  });
  const fake = await startFakeGithub({
    repos: [
      {
        full_name: "octo-adam/cloned-site",
        clone_url: remote.remoteUrl,
        pushed_at: new Date().toISOString(),
      },
      {
        full_name: "octo-adam/knitting-blog",
        clone_url: remote.remoteUrl,
        pushed_at: new Date(Date.now() - 86_400_000 * 40).toISOString(),
      },
    ],
  });
  stoppables.push(fake);
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const parentDir = await createTempDir("nefantaris-clone-parent-");
  const app = await launchEditor(userDataDir, fake.env);
  const welcome = await app.firstWindow();
  await signInFromWelcome(welcome, fake);
  await stubDirectoryPicker(app, parentDir);

  await welcome.getByRole("button", { name: "Connect existing site" }).click();
  const dialog = welcome.getByRole("dialog");
  const repoList = dialog.getByRole("list", { name: "Your sites on GitHub" });
  await expect(repoList.getByRole("button")).toHaveCount(2);
  await expect(repoList).toContainText("octo-adam/knitting-blog");

  await dialog.getByLabel("Filter your sites").fill("cloned");
  await expect(repoList.getByRole("button")).toHaveCount(1);
  await expect(repoList).toContainText("octo-adam/cloned-site");

  const siteWindowPromise = app.waitForEvent("window");
  await repoList
    .getByRole("button", { name: /octo-adam\/cloned-site/ })
    .click();
  await expect(dialog).toContainText("Connecting your site…");
  const siteWindow = await siteWindowPromise;

  await expect(siteWindow.getByTestId("site-name")).toHaveText("Cloned Site");
  const clonedPath = path.join(parentDir, "cloned-site");
  expect(existsSync(path.join(clonedPath, "nefantaris.json"))).toBe(true);

  const recentsRaw = await readFile(
    path.join(userDataDir, "recent-sites.json"),
    "utf8",
  );
  expect(recentsRaw).toContain(clonedPath);

  await siteWindow
    .getByRole("contentinfo", { name: "Status bar" })
    .getByRole("button", { name: "Versions", exact: true })
    .click();
  await expect(siteWindow.getByRole("dialog")).toContainText("First version");
});

test("cloning something that isn't a site explains itself and can clean up", async () => {
  const remote = await createRemoteRepo({ "readme.md": "Just some code.\n" });
  const fake = await startFakeGithub({
    repos: [
      {
        full_name: "octo-adam/not-a-site",
        clone_url: remote.remoteUrl,
        pushed_at: new Date().toISOString(),
      },
    ],
  });
  stoppables.push(fake);
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const parentDir = await createTempDir("nefantaris-clone-parent-");
  const app = await launchEditor(userDataDir, fake.env);
  const welcome = await app.firstWindow();
  await signInFromWelcome(welcome, fake);
  await stubDirectoryPicker(app, parentDir);

  await welcome.getByRole("button", { name: "Connect existing site" }).click();
  const dialog = welcome.getByRole("dialog");
  await dialog.getByRole("button", { name: /octo-adam\/not-a-site/ }).click();

  await expect(dialog).toContainText(
    "This doesn’t look like a Nefantaris site.",
  );
  const clonedPath = path.join(parentDir, "not-a-site");
  expect(existsSync(clonedPath)).toBe(true);

  await dialog.getByRole("button", { name: "Remove the folder" }).click();
  await expect.poll(() => existsSync(clonedPath)).toBe(false);
  await expect(dialog.getByLabel("Filter your sites")).toBeVisible();
});
