import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  bareFileContent,
  bareHeadOid,
  bareLastMessage,
  bareLastParentCount,
  closeGitServers,
  createGitSite,
  pushFromSeed,
  siteFileContent,
  workingTreeStatus,
  type GitSiteFixture,
} from "./gitFixture.ts";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

const aboutSeed = "---\ntitle: About\n---\n\nThe original about text.\n";
const indexSeed = "---\ntitle: Home\n---\n\nThe original home text.\n";
const postSeed = "---\ntitle: Hello\ndate: 2026-01-05\n---\n\nHi.\n";
const aboutLocal = "---\ntitle: About\n---\n\nYour local about line.\n";
const aboutOnline = "---\ntitle: About Online\n---\n\nThe online about line.\n";
const indexLocal = "---\ntitle: Home\n---\n\nYour local home line.\n";
const indexOnline = "---\ntitle: Home\n---\n\nThe online home line.\n";

const baseFiles = {
  "content/pages/about.md": aboutSeed,
  "content/pages/index.md": indexSeed,
  "content/posts/hello.md": postSeed,
};

async function openGitSite(
  sitePath: string,
): Promise<{ app: ElectronApplication; window: Page }> {
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const app = await launchEditor(userDataDir);
  const welcome = await app.firstWindow();
  await stubDirectoryPicker(app, sitePath);
  const siteWindowPromise = app.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  const window = await siteWindowPromise;
  return { app, window };
}

function statusBarPublishButton(window: Page): Locator {
  return window
    .getByRole("contentinfo", { name: "Status bar" })
    .getByRole("button", { name: "Publish", exact: true });
}

function syncStatus(window: Page): Locator {
  return window.getByTestId("sync-status");
}

async function editLocalFile(
  fixture: GitSiteFixture,
  relativePath: string,
  text: string,
): Promise<void> {
  await writeFile(path.join(fixture.sitePath, relativePath), text);
}

async function publishThroughDialog(
  window: Page,
  note: string | null,
): Promise<void> {
  await statusBarPublishButton(window).click();
  const dialog = window.getByRole("dialog");
  if (note !== null) {
    await dialog.getByLabel("What changed? (optional)").fill(note);
  }
  await dialog.getByRole("button", { name: "Publish", exact: true }).click();
}

test.afterEach(async () => {
  await cleanupTestArtifacts();
  await closeGitServers();
});

test("publishing commits everything and lands in the online copy with the note", async () => {
  const fixture = await createGitSite("Publish Site", baseFiles);
  await editLocalFile(fixture, "content/pages/about.md", aboutLocal);
  const { window } = await openGitSite(fixture.sitePath);

  await expect(statusBarPublishButton(window)).toBeEnabled();
  await publishThroughDialog(window, "Fixed the about page");

  await expect(window.getByRole("dialog")).toHaveCount(0);
  await expect(syncStatus(window)).toHaveText("Up to date");
  const message = await bareLastMessage(fixture);
  expect(message).toContain("Publish —");
  expect(message).toContain("Fixed the about page");
  expect(await bareFileContent(fixture, "content/pages/about.md")).toBe(
    aboutLocal,
  );
  expect((await workingTreeStatus(fixture.sitePath)).trim()).toBe("");
});

test("with nothing to publish the button is disabled and says everything is live", async () => {
  const fixture = await createGitSite("Idle Site", baseFiles);
  const { window } = await openGitSite(fixture.sitePath);

  await expect(syncStatus(window)).toHaveText("Up to date");
  await expect(statusBarPublishButton(window)).toBeDisabled();
  await expect(statusBarPublishButton(window)).toHaveAttribute(
    "title",
    "Everything is live",
  );
});

test("opening with a newer online version and a clean tree updates silently", async () => {
  const fixture = await createGitSite("Fresh Site", baseFiles);
  await pushFromSeed(
    fixture,
    { "content/pages/about.md": aboutOnline },
    "Online change",
  );
  const { window } = await openGitSite(fixture.sitePath);

  await expect
    .poll(() => siteFileContent(fixture.sitePath, "content/pages/about.md"))
    .toBe(aboutOnline);
  await expect(
    window.getByRole("button", { name: "About Online", exact: true }),
  ).toBeVisible();
  await expect(syncStatus(window)).toHaveText("Up to date");
  expect((await workingTreeStatus(fixture.sitePath)).trim()).toBe("");
});

test("a newer online version with local edits shows the banner and Update merges", async () => {
  const fixture = await createGitSite("Banner Site", baseFiles);
  await editLocalFile(fixture, "content/pages/index.md", indexLocal);
  await pushFromSeed(
    fixture,
    { "content/pages/about.md": aboutOnline },
    "Online change",
  );
  const { window } = await openGitSite(fixture.sitePath);

  const banner = window.getByRole("status");
  await expect(banner).toContainText("A newer version of your site is online.");
  await banner.getByRole("button", { name: "Update", exact: true }).click();

  await expect(banner).toHaveCount(0);
  await expect
    .poll(() => siteFileContent(fixture.sitePath, "content/pages/about.md"))
    .toBe(aboutOnline);
  expect(
    await siteFileContent(fixture.sitePath, "content/pages/index.md"),
  ).toBe(indexLocal);
  await expect(syncStatus(window)).toHaveText("Up to date");
  expect((await workingTreeStatus(fixture.sitePath)).trim()).toBe("");
});

test("conflicting edits surface the conflict view and per-file choices publish correctly", async () => {
  const fixture = await createGitSite("Conflict Site", baseFiles);
  await editLocalFile(fixture, "content/pages/about.md", aboutLocal);
  await editLocalFile(fixture, "content/pages/index.md", indexLocal);
  await pushFromSeed(
    fixture,
    {
      "content/pages/about.md": aboutOnline,
      "content/pages/index.md": indexOnline,
    },
    "Online conflicting change",
  );
  const { window } = await openGitSite(fixture.sitePath);

  await publishThroughDialog(window, null);
  const dialog = window.getByRole("dialog");
  await expect(dialog).toContainText("Choose what to keep");
  await expect(
    dialog.getByRole("list", { name: "Pages to resolve" }).getByRole("button"),
  ).toHaveText(["pages/about.md", "pages/index.md"]);
  await expect(dialog).toContainText("Your local about line.");
  await expect(dialog).toContainText("The online about line.");

  await dialog.getByRole("button", { name: "Keep yours", exact: true }).click();
  await dialog
    .getByRole("button", { name: "pages/index.md", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Keep online version", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Finish publishing", exact: true })
    .click();

  await expect(window.getByRole("dialog")).toHaveCount(0);
  await expect(syncStatus(window)).toHaveText("Up to date");
  expect(await bareFileContent(fixture, "content/pages/about.md")).toBe(
    aboutLocal,
  );
  expect(await bareFileContent(fixture, "content/pages/index.md")).toBe(
    indexOnline,
  );
  expect(
    await siteFileContent(fixture.sitePath, "content/pages/about.md"),
  ).toBe(aboutLocal);
  expect(
    await siteFileContent(fixture.sitePath, "content/pages/index.md"),
  ).toBe(indexOnline);
  for (const relativePath of [
    "content/pages/about.md",
    "content/pages/index.md",
  ]) {
    expect(await siteFileContent(fixture.sitePath, relativePath)).not.toContain(
      "<<<<<<<",
    );
  }
  expect((await workingTreeStatus(fixture.sitePath)).trim()).toBe("");
  expect(await bareLastParentCount(fixture)).toBe(2);

  await window
    .getByRole("contentinfo", { name: "Status bar" })
    .getByRole("button", { name: "Versions", exact: true })
    .click();
  await expect(window.getByRole("dialog")).toContainText("Update from online");
});

test("cancelling the conflict view changes nothing on disk", async () => {
  const fixture = await createGitSite("Cancel Site", baseFiles);
  await editLocalFile(fixture, "content/pages/about.md", aboutLocal);
  await pushFromSeed(
    fixture,
    { "content/pages/about.md": aboutOnline },
    "Online conflicting change",
  );
  const onlineHeadBefore = await bareHeadOid(fixture);
  const { window } = await openGitSite(fixture.sitePath);

  await publishThroughDialog(window, null);
  const dialog = window.getByRole("dialog");
  await expect(dialog).toContainText("Choose what to keep");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

  await expect(window.getByRole("dialog")).toHaveCount(0);
  expect(
    await siteFileContent(fixture.sitePath, "content/pages/about.md"),
  ).toBe(aboutLocal);
  expect((await workingTreeStatus(fixture.sitePath)).trim()).toBe("");
  expect(await siteFileContent(fixture.sitePath, ".git/MERGE_HEAD")).toBeNull();
  expect(await bareHeadOid(fixture)).toBe(onlineHeadBefore);

  await window.getByRole("button", { name: "About", exact: true }).click();
  await expect(window.locator(".cm-content")).toBeVisible();
});

test("offline shows the offline state and publishing fails with friendly copy", async () => {
  const fixture = await createGitSite("Offline Site", baseFiles);
  await fixture.stopServer();
  await editLocalFile(fixture, "content/pages/about.md", aboutLocal);
  const { window } = await openGitSite(fixture.sitePath);

  await expect(syncStatus(window)).toHaveText("Offline");
  await publishThroughDialog(window, null);
  const dialog = window.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("You're offline");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

  await window.getByRole("button", { name: "About", exact: true }).click();
  await expect(window.locator(".cm-content")).toBeVisible();
});

test("the versions list shows publishes with their notes", async () => {
  const fixture = await createGitSite("Versions Site", baseFiles);
  await editLocalFile(fixture, "content/pages/about.md", aboutLocal);
  const { window } = await openGitSite(fixture.sitePath);

  await publishThroughDialog(window, "First publish note");
  await expect(syncStatus(window)).toHaveText("Up to date");
  await expect(window.getByRole("dialog")).toHaveCount(0);

  await window
    .getByRole("contentinfo", { name: "Status bar" })
    .getByRole("button", { name: "Versions", exact: true })
    .click();
  const dialog = window.getByRole("dialog");
  await expect(dialog).toContainText("Publish —");
  await expect(dialog).toContainText("First publish note");
  await expect(dialog).toContainText("Test Author");
  await expect(dialog).toContainText("First version");
  await expect(dialog).toContainText("Seed Author");
});
