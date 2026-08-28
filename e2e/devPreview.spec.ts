import type { ElectronApplication, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFakeCore, setFakeCoreMode } from "./fakeCore.ts";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

async function createDevPreviewSite(name: string): Promise<string> {
  const dir = await createTempDir("nefantaris-devpreview-");
  await writeFile(path.join(dir, "nefantaris.json"), JSON.stringify({ name }));
  await mkdir(path.join(dir, "content", "pages", "docs"), { recursive: true });
  await mkdir(path.join(dir, "content", "posts"), { recursive: true });
  const pages: Record<string, string> = {
    "index.md": "---\ntitle: Home\n---\n\n# Home\n",
    "about.md": "---\ntitle: About\n---\n\n# About\n",
    "docs/index.md": "---\ntitle: Docs\n---\n\n# Docs\n",
    "contact.md": "---\ntitle: Contact\nslug: reach-us\n---\n\n# Contact\n",
    "secret.md": "---\ntitle: Secret\ndraft: true\n---\n\n# Secret\n",
  };
  for (const [file, text] of Object.entries(pages)) {
    await writeFile(path.join(dir, "content", "pages", file), text);
  }
  await writeFile(
    path.join(dir, "content", "posts", "hello-world.md"),
    "---\ntitle: Hello World\ndate: 2026-01-05\n---\n\nHi.\n",
  );
  await writeFile(
    path.join(dir, "content", "posts", "fancy.md"),
    "---\ntitle: Fancy Post\ndate: 2026-01-06\nslug: fancy-custom\n---\n\nHi.\n",
  );
  return dir;
}

async function openPreviewSite(
  sitePath: string,
  fakeCoreDir: string,
): Promise<{ app: ElectronApplication; window: Page }> {
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const app = await launchEditor(userDataDir, {
    NEFANTARIS_CORE_DIR: fakeCoreDir,
  });
  const welcome = await app.firstWindow();
  await stubDirectoryPicker(app, sitePath);
  const siteWindowPromise = app.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  const window = await siteWindowPromise;
  await expect(
    window.getByRole("contentinfo", { name: "Status bar" }),
  ).toBeVisible();
  return { app, window };
}

function previewToggle(window: Page) {
  return window.getByRole("button", { name: "Preview", exact: true });
}

function previewFrame(window: Page) {
  return window.frameLocator('iframe[title="Site preview"]');
}

function echoedPath(window: Page) {
  return previewFrame(window).locator("#request-path");
}

async function previewOrigin(window: Page): Promise<string> {
  const src = await window
    .locator('iframe[title="Site preview"]')
    .getAttribute("src");
  if (src === null) {
    throw new Error("The preview iframe has no src");
  }
  return new URL(src).origin;
}

async function probeServer(url: string): Promise<"alive" | "dead"> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(500) });
    return "alive";
  } catch {
    return "dead";
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

test.afterEach(cleanupTestArtifacts);

test("toggling the preview shows a starting state and then embeds the site", async () => {
  const fakeCoreDir = await createFakeCore();
  const sitePath = await createDevPreviewSite("Starting Site");
  await setFakeCoreMode(sitePath, "slow-start");
  const { window } = await openPreviewSite(sitePath, fakeCoreDir);

  const toggle = previewToggle(window);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(window.getByText("Starting preview…")).toBeVisible();
  await expect(echoedPath(window)).toHaveText("/", { timeout: 20_000 });

  const toggleShortcut = process.platform === "darwin" ? "Meta+e" : "Control+e";
  await window.keyboard.press(toggleShortcut);
  await expect(
    window.getByRole("region", { name: "Site preview" }),
  ).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("the preview follows the open file including slugs and posts", async () => {
  const fakeCoreDir = await createFakeCore();
  const sitePath = await createDevPreviewSite("Route Site");
  const { window } = await openPreviewSite(sitePath, fakeCoreDir);

  await previewToggle(window).click();
  await expect(echoedPath(window)).toHaveText("/", { timeout: 20_000 });

  await window.getByRole("button", { name: "About", exact: true }).click();
  await expect(echoedPath(window)).toHaveText("/about");

  await window.getByRole("button", { name: "Docs", exact: true }).click();
  await expect(echoedPath(window)).toHaveText("/docs");

  await window.getByRole("button", { name: "Contact", exact: true }).click();
  await expect(echoedPath(window)).toHaveText("/reach-us");

  await window.getByRole("button", { name: /^Hello World/ }).click();
  await expect(echoedPath(window)).toHaveText("/blog/hello-world");

  await window.getByRole("button", { name: /^Fancy Post/ }).click();
  await expect(echoedPath(window)).toHaveText("/blog/fancy-custom");
});

test("a draft file shows a note and the preview stays on the previous route", async () => {
  const fakeCoreDir = await createFakeCore();
  const sitePath = await createDevPreviewSite("Draft Site");
  const { window } = await openPreviewSite(sitePath, fakeCoreDir);

  await previewToggle(window).click();
  await expect(echoedPath(window)).toHaveText("/", { timeout: 20_000 });

  await window.getByRole("button", { name: "About", exact: true }).click();
  await expect(echoedPath(window)).toHaveText("/about");

  await window.getByRole("button", { name: "Secret", exact: true }).click();
  await expect(
    window.getByText(/Drafts don.t appear in the preview/),
  ).toBeVisible();
  await expect(echoedPath(window)).toHaveText("/about");
});

test("a crashed preview server restarts automatically and recovers", async () => {
  const fakeCoreDir = await createFakeCore();
  const sitePath = await createDevPreviewSite("Crashy Site");
  await setFakeCoreMode(sitePath, "crash-once");
  const { window } = await openPreviewSite(sitePath, fakeCoreDir);

  await previewToggle(window).click();
  await expect(echoedPath(window)).toHaveText("/", { timeout: 30_000 });
  expect(await fileExists(path.join(sitePath, ".fake-core-crashed"))).toBe(
    true,
  );
});

test("repeated crashes hit the restart cap and retry recovers", async () => {
  test.setTimeout(90_000);
  const fakeCoreDir = await createFakeCore();
  const sitePath = await createDevPreviewSite("Doomed Preview Site");
  await setFakeCoreMode(sitePath, "always-crash");
  const { window } = await openPreviewSite(sitePath, fakeCoreDir);

  await previewToggle(window).click();
  await expect(window.getByText(/The preview couldn.t start\./)).toBeVisible({
    timeout: 45_000,
  });
  await expect(window.getByText(/keeps stopping/)).toBeVisible();
  await expect(window.locator("pre")).toContainText("fake core listening");

  await setFakeCoreMode(sitePath, "serve");
  await window.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(echoedPath(window)).toHaveText("/", { timeout: 30_000 });
});

test("closing the site window kills the preview server", async () => {
  const fakeCoreDir = await createFakeCore();
  const sitePath = await createDevPreviewSite("Closing Site");
  const { app, window } = await openPreviewSite(sitePath, fakeCoreDir);

  await previewToggle(window).click();
  await expect(echoedPath(window)).toHaveText("/", { timeout: 20_000 });

  const origin = await previewOrigin(window);
  expect(await probeServer(origin)).toBe("alive");

  await app.evaluate(({ BrowserWindow }) => {
    for (const openWindow of BrowserWindow.getAllWindows()) {
      openWindow.close();
    }
  });

  await expect
    .poll(() => probeServer(origin), { timeout: 15_000 })
    .toBe("dead");
});

test("hiding the preview keeps the server running for an instant reopen", async () => {
  const fakeCoreDir = await createFakeCore();
  const sitePath = await createDevPreviewSite("Hidden Site");
  const { window } = await openPreviewSite(sitePath, fakeCoreDir);

  const toggle = previewToggle(window);
  await toggle.click();
  await expect(echoedPath(window)).toHaveText("/", { timeout: 20_000 });
  const origin = await previewOrigin(window);

  await toggle.click();
  await expect(
    window.getByRole("region", { name: "Site preview" }),
  ).toBeHidden();
  expect(await probeServer(origin)).toBe("alive");

  await toggle.click();
  await expect(echoedPath(window)).toHaveText("/");
  expect(await previewOrigin(window)).toBe(origin);
});
