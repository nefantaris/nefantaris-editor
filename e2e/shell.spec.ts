import { expect, test } from "@playwright/test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

async function createFixtureSite(name: string): Promise<string> {
  const dir = await createTempDir("nefantaris-site-");
  await writeFile(path.join(dir, "nefantaris.json"), JSON.stringify({ name }));
  await mkdir(path.join(dir, "pages"));
  await mkdir(path.join(dir, "assets"));
  return dir;
}

test.afterEach(cleanupTestArtifacts);

test("welcome window offers the three actions", async () => {
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const app = await launchEditor(userDataDir);
  const welcome = await app.firstWindow();

  await expect(
    welcome.getByRole("button", { name: "Open site…" }),
  ).toBeEnabled();
  await expect(
    welcome.getByRole("button", { name: "Create site" }),
  ).toBeEnabled();
  await expect(
    welcome.getByRole("button", { name: "Connect existing site" }),
  ).toBeDisabled();
});

test("opening a valid site folder opens a site window showing the site name", async () => {
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const sitePath = await createFixtureSite("Fixture Site");
  const app = await launchEditor(userDataDir);
  const welcome = await app.firstWindow();
  await stubDirectoryPicker(app, sitePath);

  const siteWindowPromise = app.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  const siteWindow = await siteWindowPromise;

  await expect(siteWindow.getByTestId("site-name")).toHaveText("Fixture Site");
  await expect.poll(() => app.windows().length).toBe(1);
});

test("recent sites persist across an app relaunch", async () => {
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const sitePath = await createFixtureSite("Persistent Site");

  const firstRun = await launchEditor(userDataDir);
  const welcome = await firstRun.firstWindow();
  await stubDirectoryPicker(firstRun, sitePath);
  const siteWindowPromise = firstRun.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  await siteWindowPromise;
  await firstRun.close();

  const secondRun = await launchEditor(userDataDir);
  const secondWelcome = await secondRun.firstWindow();
  const recentEntry = secondWelcome.getByRole("button", {
    name: /Persistent Site/,
  });
  await expect(recentEntry).toBeVisible();

  const reopenedWindowPromise = secondRun.waitForEvent("window");
  await recentEntry.click();
  const siteWindow = await reopenedWindowPromise;
  await expect(siteWindow.getByTestId("site-name")).toHaveText(
    "Persistent Site",
  );
});

test("an invalid folder shows an error in the welcome window", async () => {
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const notASite = await createTempDir("nefantaris-notasite-");
  const app = await launchEditor(userDataDir);
  const welcome = await app.firstWindow();
  await stubDirectoryPicker(app, notASite);

  await welcome.getByRole("button", { name: "Open site…" }).click();

  const alert = welcome.getByRole("alert");
  await expect(alert).toContainText("nefantaris.json");
  await expect(alert).toContainText(path.basename(notASite));
  await expect.poll(() => app.windows().length).toBe(1);
});

test("a broken recent entry shows the error and can be removed", async () => {
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const sitePath = await createFixtureSite("Doomed Site");

  const firstRun = await launchEditor(userDataDir);
  const welcome = await firstRun.firstWindow();
  await stubDirectoryPicker(firstRun, sitePath);
  const siteWindowPromise = firstRun.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  await siteWindowPromise;
  await firstRun.close();
  await rm(sitePath, { recursive: true, force: true });

  const secondRun = await launchEditor(userDataDir);
  const secondWelcome = await secondRun.firstWindow();
  await secondWelcome.getByRole("button", { name: /Doomed Site/ }).click();

  const alert = secondWelcome.getByRole("alert");
  await expect(alert).toContainText("no longer exists");

  await alert.getByRole("button", { name: "Remove from list" }).click();
  await expect(
    secondWelcome.getByText("Sites you open will show up here."),
  ).toBeVisible();
});
