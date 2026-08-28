import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFakeCore, fakeInspectTemplates } from "./fakeCore.ts";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

test.afterEach(cleanupTestArtifacts);

test("the template dropdown lists what the core's inspect command reports", async () => {
  const fakeCoreDir = await createFakeCore();
  const sitePath = await createTempDir("nefantaris-inspect-");
  await writeFile(
    path.join(sitePath, "nefantaris.json"),
    JSON.stringify({ name: "Inspect Site" }),
  );
  const pagesDir = path.join(sitePath, "content", "pages");
  await mkdir(pagesDir, { recursive: true });
  await writeFile(
    path.join(pagesDir, "styled.md"),
    "---\ntitle: Styled Page\n---\n\nBody.\n",
  );

  const userDataDir = await createTempDir("nefantaris-userdata-");
  const app = await launchEditor(userDataDir, {
    NEFANTARIS_CORE_DIR: fakeCoreDir,
  });
  const welcome = await app.firstWindow();
  await stubDirectoryPicker(app, sitePath);
  const siteWindowPromise = app.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  const window = await siteWindowPromise;

  await window
    .getByRole("button", { name: "Styled Page", exact: true })
    .click();
  const toggle = window.getByRole("button", { name: "Page details" });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  const details = window.getByRole("region", { name: "Page details" });
  await expect(details.getByLabel("Template").locator("option")).toHaveText([
    "Default",
    ...fakeInspectTemplates,
  ]);
});
