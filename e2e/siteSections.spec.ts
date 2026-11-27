import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFakeCore, openSiteWithFakeCore } from "./fakeCore.ts";
import { closeGitServers, createReleasedRepos } from "./gitFixture.ts";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

async function createSectionsSite(name: string): Promise<string> {
  const dir = await createTempDir("nefantaris-sections-");
  await writeFile(
    path.join(dir, "nefantaris.json"),
    `${JSON.stringify({ name }, null, 4)}\n`,
  );
  await mkdir(path.join(dir, "content", "pages"), { recursive: true });
  await writeFile(
    path.join(dir, "content", "pages", "index.md"),
    "---\ntitle: Home\n---\n\nWelcome.\n",
  );
  return dir;
}

async function openSiteIn(
  userDataDir: string,
  fakeCoreDir: string,
  sitePath: string,
): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await launchEditor(userDataDir, {
    NEFANTARIS_CORE_DIR: fakeCoreDir,
  });
  const welcome = await app.firstWindow();
  await stubDirectoryPicker(app, sitePath);
  const siteWindowPromise = app.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  return { app, window: await siteWindowPromise };
}

function railOf(window: Page): Locator {
  return window.getByRole("navigation", { name: "Site sections" });
}

function railButton(window: Page, name: string): Locator {
  return railOf(window).getByRole("button", { name, exact: true });
}

test.afterEach(async () => {
  await cleanupTestArtifacts();
  await closeGitServers();
});

test("the rail switches sections by mouse and keyboard while the preview stays", async () => {
  const released = await createReleasedRepos([]);
  const sitePath = await createSectionsSite("Rail Site");
  const { window } = await openSiteWithFakeCore(sitePath, {
    NEFANTARIS_CLONE_BASE: released.urlBase,
  });
  const sidebar = window.getByRole("complementary", { name: "Site content" });

  const items = railOf(window).getByRole("button");
  await expect(items).toHaveCount(6);
  for (const [index, name] of [
    "Content",
    "Design",
    "Style",
    "Add-ons",
    "Custom code",
    "Site settings",
  ].entries()) {
    await expect(items.nth(index)).toHaveAccessibleName(name);
  }
  await expect(railButton(window, "Content")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(sidebar).toBeVisible();

  await window.getByRole("button", { name: "Home", exact: true }).click();
  await expect(window.locator(".cm-content")).toBeVisible();
  await window.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = window.locator('iframe[title="Site preview"]');
  await expect(preview).toBeVisible({ timeout: 20_000 });

  await railButton(window, "Add-ons").hover();
  await expect(window.getByRole("tooltip")).toHaveText("Add-ons");
  await railButton(window, "Design").click();
  await expect(window.getByRole("heading", { name: "Design" })).toBeVisible();
  await expect(sidebar).toBeHidden();
  await expect(window.locator(".cm-content")).toBeHidden();
  await expect(railButton(window, "Design")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(railButton(window, "Content")).not.toHaveAttribute(
    "aria-current",
  );
  await expect(preview).toBeVisible();
  await window.mouse.move(700, 500);

  await railButton(window, "Content").focus();
  await window.keyboard.press("ArrowDown");
  await expect(railButton(window, "Design")).toBeFocused();
  await expect(window.getByRole("tooltip")).toHaveText("Design");
  await window.keyboard.press("Escape");
  await expect(window.getByRole("tooltip")).toHaveCount(0);

  await window.keyboard.press("ArrowDown");
  await expect(railButton(window, "Style")).toBeFocused();
  await window.keyboard.press("ArrowDown");
  await expect(railButton(window, "Add-ons")).toBeFocused();
  await window.keyboard.press("Enter");
  await expect(
    window.getByRole("heading", { name: "Add-ons", exact: true }),
  ).toBeVisible();
  await expect(railButton(window, "Add-ons")).toHaveAttribute(
    "aria-current",
    "page",
  );

  await window.keyboard.press("End");
  await expect(railButton(window, "Site settings")).toBeFocused();
  await window.keyboard.press(" ");
  await expect(
    window.getByRole("heading", { name: "Site settings" }),
  ).toBeVisible();

  await window.keyboard.press("Home");
  await expect(railButton(window, "Content")).toBeFocused();
  await window.keyboard.press("ArrowUp");
  await expect(railButton(window, "Site settings")).toBeFocused();
  await window.keyboard.press("ArrowDown");
  await expect(railButton(window, "Content")).toBeFocused();
  await window.keyboard.press("Enter");
  await expect(sidebar).toBeVisible();
  await expect(
    window.locator(".cm-line", { hasText: "Welcome." }),
  ).toBeVisible();
  await expect(preview).toBeVisible();
});

test("each site reopens on the section it was last on", async () => {
  const sitePath = await createSectionsSite("Remembering Site");
  const otherSitePath = await createSectionsSite("Other Site");
  const fakeCoreDir = await createFakeCore();
  const userDataDir = await createTempDir("nefantaris-userdata-");

  const first = await openSiteIn(userDataDir, fakeCoreDir, sitePath);
  await railButton(first.window, "Design").click();
  await expect(
    first.window.getByRole("heading", { name: "Design" }),
  ).toBeVisible();
  await first.app.close();

  const again = await openSiteIn(userDataDir, fakeCoreDir, sitePath);
  await expect(railButton(again.window, "Design")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    again.window.getByRole("heading", { name: "Design" }),
  ).toBeVisible();
  await expect(
    again.window.getByRole("complementary", { name: "Site content" }),
  ).toBeHidden();
  await again.app.close();

  const other = await openSiteIn(userDataDir, fakeCoreDir, otherSitePath);
  await expect(railButton(other.window, "Content")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    other.window.getByRole("complementary", { name: "Site content" }),
  ).toBeVisible();
});
