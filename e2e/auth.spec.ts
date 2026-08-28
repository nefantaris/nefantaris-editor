import type { ElectronApplication, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  startFakeGithub,
  startUnauthorizedGitServer,
  type FakeGithub,
} from "./fakeGithub.ts";
import { closeGitServers, createGitSite, runGit } from "./gitFixture.ts";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

const unconfiguredEnv = {
  NEFANTARIS_GITHUB_CLIENT_ID: "",
  NEFANTARIS_GITHUB_OAUTH_URL: "",
  NEFANTARIS_GITHUB_API_URL: "",
};

const stoppables: { stop: () => Promise<void> }[] = [];

async function launchWithFakeGithub(
  userDataDir: string,
  fake: FakeGithub,
): Promise<{ app: ElectronApplication; welcome: Page }> {
  const app = await launchEditor(userDataDir, fake.env);
  const welcome = await app.firstWindow();
  return { app, welcome };
}

async function signInFromWelcome(
  welcome: Page,
  fake: FakeGithub,
): Promise<void> {
  await welcome.getByRole("button", { name: "Sign in to GitHub" }).click();
  await expect(welcome.getByRole("dialog")).toContainText(fake.userCode);
  await expect(welcome.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
}

function accountArea(welcome: Page) {
  return welcome.getByRole("contentinfo", { name: "Account" });
}

async function isSafeStorageAvailable(
  app: ElectronApplication,
): Promise<boolean> {
  return app.evaluate(({ safeStorage }) => safeStorage.isEncryptionAvailable());
}

function tokenFilePath(userDataDir: string): string {
  return path.join(userDataDir, "github-auth.bin");
}

async function tokenFileBytes(userDataDir: string): Promise<Buffer | null> {
  try {
    return await readFile(tokenFilePath(userDataDir));
  } catch {
    return null;
  }
}

test.afterEach(async () => {
  await cleanupTestArtifacts();
  await closeGitServers();
  await Promise.all(stoppables.splice(0).map((server) => server.stop()));
});

test("without a client id the welcome window says sign-in isn't set up", async () => {
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const app = await launchEditor(userDataDir, unconfiguredEnv);
  const welcome = await app.firstWindow();

  await expect(accountArea(welcome)).toContainText(
    "GitHub sign-in isn’t configured in this build yet.",
  );
  await expect(
    welcome.getByRole("button", { name: "Connect existing site" }),
  ).toBeDisabled();
});

test("signing in shows the code, flips to signed in, and remembers what safeStorage allows", async () => {
  const fake = await startFakeGithub();
  stoppables.push(fake);
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const { app, welcome } = await launchWithFakeGithub(userDataDir, fake);

  await welcome.getByRole("button", { name: "Sign in to GitHub" }).click();
  const dialog = welcome.getByRole("dialog");
  await expect(dialog).toContainText(fake.userCode);
  await expect(dialog.getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(dialog).toContainText("Waiting for you to finish");
  await expect(welcome.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  await expect(accountArea(welcome)).toContainText("Signed in as Adam Octo");

  const isPersistent = await isSafeStorageAvailable(app);
  const storedBytes = await tokenFileBytes(userDataDir);
  if (isPersistent) {
    expect(storedBytes).not.toBeNull();
    expect(storedBytes?.includes(fake.accessToken)).toBe(false);
  } else {
    expect(storedBytes).toBeNull();
    await expect(accountArea(welcome)).toContainText(
      "You’ll need to sign in again next time you open the app.",
    );
  }
  await app.close();

  const secondRun = await launchEditor(userDataDir, fake.env);
  const secondWelcome = await secondRun.firstWindow();
  await (isPersistent
    ? expect(accountArea(secondWelcome)).toContainText("Signed in as Adam Octo")
    : expect(
        secondWelcome.getByRole("button", { name: "Sign in to GitHub" }),
      ).toBeVisible());
});

test("signing out forgets the account across relaunches", async () => {
  const fake = await startFakeGithub();
  stoppables.push(fake);
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const { app, welcome } = await launchWithFakeGithub(userDataDir, fake);
  await signInFromWelcome(welcome, fake);

  await welcome.getByRole("button", { name: "Sign out" }).click();
  await expect(
    welcome.getByRole("button", { name: "Sign in to GitHub" }),
  ).toBeVisible();
  expect(await tokenFileBytes(userDataDir)).toBeNull();
  await app.close();

  const secondRun = await launchEditor(userDataDir, fake.env);
  const secondWelcome = await secondRun.firstWindow();
  await expect(
    secondWelcome.getByRole("button", { name: "Sign in to GitHub" }),
  ).toBeVisible();
});

test("a sign-in asked to slow down still lands", async () => {
  const fake = await startFakeGithub({ tokenBehavior: "slow-down-once" });
  stoppables.push(fake);
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const { welcome } = await launchWithFakeGithub(userDataDir, fake);

  await signInFromWelcome(welcome, fake);

  await expect(accountArea(welcome)).toContainText("Signed in as Adam Octo");
  expect(fake.tokenPollCount()).toBeGreaterThanOrEqual(2);
});

test("an expired code offers a fresh start", async () => {
  const fake = await startFakeGithub({ tokenBehavior: "expired" });
  stoppables.push(fake);
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const { welcome } = await launchWithFakeGithub(userDataDir, fake);

  await welcome.getByRole("button", { name: "Sign in to GitHub" }).click();
  const dialog = welcome.getByRole("dialog");
  await expect(dialog).toContainText("That code expired", {
    timeout: 15_000,
  });
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(welcome.getByRole("dialog")).toHaveCount(0);
});

test("publishing without access offers sign-in from the status bar", async () => {
  const fake = await startFakeGithub();
  stoppables.push(fake);
  const locked = await startUnauthorizedGitServer();
  stoppables.push(locked);
  const fixture = await createGitSite("Locked Site", {
    "content/pages/index.md": "---\ntitle: Home\n---\n\nHello.\n",
  });
  await runGit(fixture.sitePath, [
    "remote",
    "set-url",
    "origin",
    `${locked.url}/origin.git`,
  ]);
  await writeFile(
    path.join(fixture.sitePath, "content/pages/index.md"),
    "---\ntitle: Home\n---\n\nAn edited line.\n",
  );

  const userDataDir = await createTempDir("nefantaris-userdata-");
  const app = await launchEditor(userDataDir, fake.env);
  const welcome = await app.firstWindow();
  await stubDirectoryPicker(app, fixture.sitePath);
  const siteWindowPromise = app.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  const window = await siteWindowPromise;

  const statusBar = window.getByRole("contentinfo", { name: "Status bar" });
  await statusBar.getByRole("button", { name: "Publish", exact: true }).click();
  const publishDialog = window.getByRole("dialog");
  await publishDialog
    .getByRole("button", { name: "Publish", exact: true })
    .click();
  await expect(publishDialog.getByRole("alert")).toContainText(
    "You need to sign in before you can publish",
  );
  await publishDialog.getByRole("button", { name: "Cancel" }).click();

  await statusBar.getByRole("button", { name: "Sign in", exact: true }).click();
  const signInDialog = window.getByRole("dialog");
  await expect(signInDialog).toContainText("Sign in to GitHub");
  await expect(signInDialog).toContainText(fake.userCode);
  await signInDialog.getByRole("button", { name: "Cancel" }).click();
});
