import type { ElectronApplication, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

const homeContent = "---\ntitle: Home\n---\n\nWelcome to the home page.\n";
const aboutContent = "---\ntitle: About\n---\n\nAll about this site.\n";
const aboutBody = "\nAll about this site.\n";
const guideContent = "---\ntitle: Getting Started\n---\n\nStep one.\n";
const firstPostContent =
  "---\ntitle: First Post\ndate: 2026-01-05\n---\n\nOldest.\n";
const draftPostContent =
  "---\ntitle: Draft Notes\ndate: 2026-02-14\ndraft: true\n---\n\nUnfinished.\n";
const newestPostContent =
  "---\ntitle: Launch Day\ndate: 2026-03-10\n---\n\nNewest.\n";
const oddBody = "spaces at the end   \n\n\ttabbed line\nno final newline";
const oddContent = `---\ntitle: Odd File\n---\n${oddBody}`;
const crlfBody = "line one\r\nline two, no final newline";
const crlfContent = `---\r\ntitle: Windows File\r\n---\r\n${crlfBody}`;

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function createContentSite(name: string): Promise<string> {
  const dir = await createTempDir("nefantaris-content-");
  await writeFile(path.join(dir, "nefantaris.json"), JSON.stringify({ name }));
  await mkdir(path.join(dir, "content", "pages", "guides"), {
    recursive: true,
  });
  await mkdir(path.join(dir, "content", "posts"), { recursive: true });
  await mkdir(path.join(dir, "assets"));
  await writeFile(path.join(dir, "content", "pages", "index.md"), homeContent);
  await writeFile(path.join(dir, "content", "pages", "about.md"), aboutContent);
  await writeFile(
    path.join(dir, "content", "pages", "guides", "getting-started.md"),
    guideContent,
  );
  await writeFile(path.join(dir, "content", "pages", "odd.md"), oddContent);
  await writeFile(path.join(dir, "content", "pages", "crlf.md"), crlfContent);
  await writeFile(
    path.join(dir, "content", "posts", "first-post.md"),
    firstPostContent,
  );
  await writeFile(
    path.join(dir, "content", "posts", "draft-notes.md"),
    draftPostContent,
  );
  await writeFile(
    path.join(dir, "content", "posts", "launch-day.md"),
    newestPostContent,
  );
  return dir;
}

async function openSiteWindow(
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

async function editorText(window: Page): Promise<string> {
  const lines = await window.locator(".cm-line").allTextContents();
  return lines.join("\n");
}

async function fileContentOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function typeAtDocumentStart(window: Page, text: string): Promise<void> {
  await window.locator(".cm-content").click();
  const docStartShortcut =
    process.platform === "darwin" ? "Meta+ArrowUp" : "Control+Home";
  await window.keyboard.press(docStartShortcut);
  await window.keyboard.type(text);
}

function localIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

test.afterEach(cleanupTestArtifacts);

test("sidebar shows the page tree and posts newest-first with a draft badge", async () => {
  const sitePath = await createContentSite("Tree Site");
  const { window } = await openSiteWindow(sitePath);
  const sidebar = window.getByRole("complementary", { name: "Site content" });

  await expect(
    sidebar.getByRole("button", { name: "Home", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: "About", exact: true }),
  ).toBeVisible();

  const folderToggle = sidebar.getByRole("button", {
    name: "guides",
    exact: true,
  });
  await expect(folderToggle).toHaveAttribute("aria-expanded", "true");
  const nestedPage = sidebar.getByRole("button", {
    name: "Getting Started",
    exact: true,
  });
  await expect(nestedPage).toBeVisible();
  await folderToggle.click();
  await expect(nestedPage).toBeHidden();
  await folderToggle.click();
  await expect(nestedPage).toBeVisible();

  const postRows = window
    .getByRole("region", { name: "Posts" })
    .getByRole("listitem");
  await expect(postRows).toHaveCount(3);
  const rowTexts = await postRows.allInnerTexts();
  expect(rowTexts[0]).toContain("Launch Day");
  expect(rowTexts[1]).toContain("Draft Notes");
  expect(rowTexts[1]).toContain("Draft");
  expect(rowTexts[2]).toContain("First Post");
  expect(rowTexts[0]).not.toContain("Draft");
});

test("collapsing the details panel shows exact on-disk content and typing autosaves", async () => {
  const sitePath = await createContentSite("Autosave Site");
  const { window } = await openSiteWindow(sitePath);

  await window.getByRole("button", { name: "About", exact: true }).click();
  const detailsToggle = window.getByRole("button", { name: "Page details" });
  await detailsToggle.click();
  await expect(detailsToggle).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => editorText(window)).toBe(aboutContent);

  await typeAtDocumentStart(window, "Hello ");
  await expect
    .poll(() =>
      fileContentOrNull(path.join(sitePath, "content", "pages", "about.md")),
    )
    .toBe(`Hello ${aboutContent}`);
});

test("a file with odd whitespace survives an edit round trip byte for byte", async () => {
  const sitePath = await createContentSite("Fidelity Site");
  const { window } = await openSiteWindow(sitePath);

  await window.getByRole("button", { name: "Odd File", exact: true }).click();
  await expect.poll(() => editorText(window)).toBe(oddBody);

  await typeAtDocumentStart(window, "X");
  await expect
    .poll(() =>
      fileContentOrNull(path.join(sitePath, "content", "pages", "odd.md")),
    )
    .toBe(`---\ntitle: Odd File\n---\nX${oddBody}`);
});

test("a file with CRLF line endings keeps them through an edit", async () => {
  const sitePath = await createContentSite("CRLF Site");
  const { window } = await openSiteWindow(sitePath);

  await window
    .getByRole("button", { name: "Windows File", exact: true })
    .click();
  await expect
    .poll(() => editorText(window))
    .toBe(crlfBody.replaceAll("\r\n", "\n"));

  await typeAtDocumentStart(window, "X");
  await expect
    .poll(() =>
      fileContentOrNull(path.join(sitePath, "content", "pages", "crlf.md")),
    )
    .toBe(`---\r\ntitle: Windows File\r\n---\r\nX${crlfBody}`);
});

test("creating a page validates the title, writes minimal frontmatter, and opens it", async () => {
  const sitePath = await createContentSite("Create Site");
  const { window } = await openSiteWindow(sitePath);

  await window.getByRole("button", { name: "New page", exact: true }).click();
  const dialog = window.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create page" }).click();
  await expect(dialog.getByRole("alert")).toContainText("title");

  await dialog.getByLabel("Title").fill("Team Handbook");
  await dialog.getByRole("button", { name: "Create page" }).click();

  const createdPath = path.join(
    sitePath,
    "content",
    "pages",
    "team-handbook.md",
  );
  const scaffold = "---\ntitle: Team Handbook\n---\n";
  await expect.poll(() => fileContentOrNull(createdPath)).toBe(scaffold);
  await expect(
    window
      .getByRole("region", { name: "Page details" })
      .getByLabel("Title", { exact: true }),
  ).toHaveValue("Team Handbook");
  await expect(
    window.getByRole("button", { name: "Team Handbook", exact: true }),
  ).toHaveAttribute("aria-current", "true");

  await window.getByRole("button", { name: "New page", exact: true }).click();
  const secondDialog = window.getByRole("dialog");
  await secondDialog.getByLabel("Title").fill("Team Handbook");
  await secondDialog.getByRole("button", { name: "Create page" }).click();
  await expect(secondDialog.getByRole("alert")).toContainText("already exists");
});

test("creating a page inside a folder lands in that folder", async () => {
  const sitePath = await createContentSite("Folder Site");
  const { window } = await openSiteWindow(sitePath);

  await window.getByRole("button", { name: "New page", exact: true }).click();
  const dialog = window.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Advanced Topics");
  await dialog.getByLabel("Folder").selectOption("guides");
  await dialog.getByRole("button", { name: "Create page" }).click();

  await expect
    .poll(() =>
      fileContentOrNull(
        path.join(sitePath, "content", "pages", "guides", "advanced-topics.md"),
      ),
    )
    .toBe("---\ntitle: Advanced Topics\n---\n");
});

test("creating a post scaffolds title and today's date", async () => {
  const sitePath = await createContentSite("Post Site");
  const { window } = await openSiteWindow(sitePath);

  await window.getByRole("button", { name: "New post", exact: true }).click();
  const dialog = window.getByRole("dialog");
  await expect(dialog.getByLabel("Folder")).toBeHidden();
  await dialog.getByLabel("Title").fill("Big Announcement");
  await dialog.getByRole("button", { name: "Create post" }).click();

  await expect
    .poll(() =>
      fileContentOrNull(
        path.join(sitePath, "content", "posts", "big-announcement.md"),
      ),
    )
    .toBe(`---\ntitle: Big Announcement\ndate: ${localIsoDate()}\n---\n`);

  const selectedPost = window
    .getByRole("region", { name: "Posts" })
    .locator("button[aria-current='true']");
  await expect(selectedPost).toContainText("Big Announcement");
});

test("renaming an open page warns about the address change and renames on disk", async () => {
  const sitePath = await createContentSite("Rename Site");
  const { window } = await openSiteWindow(sitePath);

  await window.getByRole("button", { name: "About", exact: true }).click();
  await expect.poll(() => editorText(window)).toBe(aboutBody);

  await window.getByRole("button", { name: "Rename About" }).click();
  const dialog = window.getByRole("dialog");
  await expect(dialog).toContainText("changes its address");
  await expect(dialog.getByLabel("File name")).toHaveValue("about");
  await dialog.getByLabel("File name").fill("about-us");
  await dialog.getByRole("button", { name: "Rename", exact: true }).click();

  await expect
    .poll(() =>
      fileContentOrNull(path.join(sitePath, "content", "pages", "about-us.md")),
    )
    .toBe(aboutContent);
  expect(
    await fileContentOrNull(
      path.join(sitePath, "content", "pages", "about.md"),
    ),
  ).toBeNull();
  await expect(
    window.getByRole("button", { name: "About", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect.poll(() => editorText(window)).toBe(aboutBody);
});

test("deleting a post asks for confirmation and removes the file", async () => {
  const sitePath = await createContentSite("Delete Site");
  const { window } = await openSiteWindow(sitePath);

  await window.getByRole("button", { name: "Delete First Post" }).click();
  const dialog = window.getByRole("dialog");
  await expect(dialog).toContainText('Delete "First Post"?');
  await expect(dialog).toContainText("can't be undone");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await expect
    .poll(() =>
      fileContentOrNull(
        path.join(sitePath, "content", "posts", "first-post.md"),
      ),
    )
    .toBeNull();
  const postRows = window
    .getByRole("region", { name: "Posts" })
    .getByRole("listitem");
  await expect(postRows.filter({ hasText: "First Post" })).toHaveCount(0);
});

test("external edits to the open file reload the editor and sidebar", async () => {
  const sitePath = await createContentSite("Watcher Site");
  const { window } = await openSiteWindow(sitePath);

  await window.getByRole("button", { name: "About", exact: true }).click();
  await expect.poll(() => editorText(window)).toBe(aboutBody);

  const updatedContent = "---\ntitle: About Us\n---\n\nBrand new body.\n";
  await writeFile(
    path.join(sitePath, "content", "pages", "about.md"),
    updatedContent,
  );

  await expect.poll(() => editorText(window)).toBe("\nBrand new body.\n");
  await expect(
    window
      .getByRole("region", { name: "Page details" })
      .getByLabel("Title", { exact: true }),
  ).toHaveValue("About Us");
  await expect(
    window.getByRole("button", { name: "About Us", exact: true }),
  ).toBeVisible();
});

test("pasting an image saves it to assets and inserts a markdown reference", async () => {
  const sitePath = await createContentSite("Paste Site");
  const { app, window } = await openSiteWindow(sitePath);

  await window.getByRole("button", { name: "About", exact: true }).click();
  await expect.poll(() => editorText(window)).toBe(aboutBody);
  await window.locator(".cm-content").click();

  await app.evaluate(async ({ clipboard, ClipboardItem }, base64) => {
    const bytes = Uint8Array.from(
      atob(base64),
      (char) => char.codePointAt(0) ?? 0,
    );
    const blob = new Blob([bytes], { type: "image/png" });
    clipboard.clear();
    await clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }, tinyPngBase64);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.paste();
  });

  const assetsDir = path.join(sitePath, "assets");
  await expect
    .poll(async () =>
      (await readdir(assetsDir)).some((name) => /\.png$/.test(name)),
    )
    .toBe(true);
  const assetName = (await readdir(assetsDir)).find((name) =>
    /\.png$/.test(name),
  );
  if (!assetName) {
    throw new Error("No png landed in assets");
  }
  expect(assetName).toMatch(/^[a-z0-9-]+\.png$/);
  const assetBytes = await readFile(path.join(assetsDir, assetName));
  expect([...assetBytes.subarray(0, 4)]).toEqual([137, 80, 78, 71]);

  await expect
    .poll(() => editorText(window))
    .toContain(`![](/assets/${assetName})`);
  await expect
    .poll(() =>
      fileContentOrNull(path.join(sitePath, "content", "pages", "about.md")),
    )
    .toContain(`![](/assets/${assetName})`);
});
