import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

const fullPageContent =
  "---\ntitle: Full Page\ndescription: All the fields\nslug: full-page\n" +
  "draft: true\ntemplate: home\ncustom: kept verbatim\norder: 3\n---\n\nBody.\n";
const editMeContent =
  "---\ntitle: Old Name\ndescription: A fine page\ncustom: kept verbatim\n" +
  "order: 3\n---\n\nBody line **bold** stays.\n";
const togglePageContent = "---\ntitle: Toggle Page\n---\n\nBody.\n";
const templatePageContent = "---\ntitle: Template Page\n---\n\nPick me.\n";
const hiddenPageContent = "---\ntitle: Hidden Page\n---\nBody here.\n";
const plainPageContent = "Just words.\n";
const palettePageContent = "---\ntitle: Palette Page\n---\n\nWelcome text.\n";
const datedPostContent =
  "---\ntitle: Dated Post\ndate: 2026-03-10\n---\n\nPost body.\n";

async function createFormSite(name: string): Promise<string> {
  const dir = await createTempDir("nefantaris-form-");
  await writeFile(path.join(dir, "nefantaris.json"), JSON.stringify({ name }));
  const pagesDir = path.join(dir, "content", "pages");
  const postsDir = path.join(dir, "content", "posts");
  await mkdir(pagesDir, { recursive: true });
  await mkdir(postsDir, { recursive: true });
  await writeFile(path.join(pagesDir, "full.md"), fullPageContent);
  await writeFile(path.join(pagesDir, "edit-me.md"), editMeContent);
  await writeFile(path.join(pagesDir, "toggle.md"), togglePageContent);
  await writeFile(path.join(pagesDir, "template.md"), templatePageContent);
  await writeFile(path.join(pagesDir, "hidden.md"), hiddenPageContent);
  await writeFile(path.join(pagesDir, "plain.md"), plainPageContent);
  await writeFile(path.join(pagesDir, "palette.md"), palettePageContent);
  await writeFile(path.join(postsDir, "dated-post.md"), datedPostContent);
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

async function openFile(window: Page, title: string | RegExp): Promise<void> {
  await window.getByRole("button", { name: title, exact: true }).click();
  await expect(window.locator(".cm-content")).toBeVisible();
}

async function expandDetails(
  window: Page,
  kind: "Page" | "Post",
): Promise<Locator> {
  const toggle = window.getByRole("button", { name: `${kind} details` });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  return window.getByRole("region", { name: `${kind} details` });
}

async function editorText(window: Page): Promise<string> {
  const lines = await window.locator(".cm-line").allTextContents();
  return lines.join("\n");
}

function pagePath(sitePath: string, fileName: string): string {
  return path.join(sitePath, "content", "pages", fileName);
}

async function fileContent(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

test.afterEach(cleanupTestArtifacts);

test("the form shows the values parsed from the open page's frontmatter", async () => {
  const sitePath = await createFormSite("Form Values Site");
  const { window } = await openSiteWindow(sitePath);

  await openFile(window, "Full Page");
  const details = await expandDetails(window, "Page");

  await expect(details.getByLabel("Title")).toHaveValue("Full Page");
  await expect(details.getByLabel("Description")).toHaveValue("All the fields");
  await expect(details.getByLabel("Slug")).toHaveValue("full-page");
  await expect(details.getByLabel("Draft")).toBeChecked();
  await expect(details.getByLabel("Template")).toHaveValue("home");

  await expect(details.getByText("Also saved in this file")).toBeVisible();
  await expect(details.locator("dt", { hasText: "custom" })).toBeVisible();
  await expect(
    details.locator("dd", { hasText: "kept verbatim" }),
  ).toBeVisible();
  await expect(details.locator("dt", { hasText: "order" })).toBeVisible();
});

test("editing the title rewrites only the frontmatter block and keeps unknown keys verbatim", async () => {
  const sitePath = await createFormSite("Title Edit Site");
  const { window } = await openSiteWindow(sitePath);

  await openFile(window, "Old Name");
  const details = await expandDetails(window, "Page");
  await details.getByLabel("Title").fill("New Name");

  await expect
    .poll(() => fileContent(pagePath(sitePath, "edit-me.md")))
    .toBe(
      "---\ntitle: New Name\ndescription: A fine page\ncustom: kept verbatim\n" +
        "order: 3\n---\n\nBody line **bold** stays.\n",
    );
});

test("the template dropdown lists the theme's templates and writes or removes the key", async () => {
  const sitePath = await createFormSite("Template Site");
  const { window } = await openSiteWindow(sitePath);

  await openFile(window, "Template Page");
  const details = await expandDetails(window, "Page");

  const templateSelect = details.getByLabel("Template");
  await expect(templateSelect.locator("option")).toHaveText([
    "Default",
    "page",
    "home",
    "post",
    "blogIndex",
  ]);
  await expect(templateSelect).toHaveValue("");

  await templateSelect.selectOption("home");
  await expect
    .poll(() => fileContent(pagePath(sitePath, "template.md")))
    .toBe("---\ntitle: Template Page\ntemplate: home\n---\n\nPick me.\n");

  await templateSelect.selectOption({ label: "Default" });
  await expect
    .poll(() => fileContent(pagePath(sitePath, "template.md")))
    .toBe(templatePageContent);
});

test("the draft toggle round-trips through the file", async () => {
  const sitePath = await createFormSite("Draft Site");
  const { window } = await openSiteWindow(sitePath);

  await openFile(window, "Toggle Page");
  const details = await expandDetails(window, "Page");

  const draftToggle = details.getByLabel("Draft");
  await draftToggle.check();
  await expect
    .poll(() => fileContent(pagePath(sitePath, "toggle.md")))
    .toBe("---\ntitle: Toggle Page\ndraft: true\n---\n\nBody.\n");

  await draftToggle.uncheck();
  await expect
    .poll(() => fileContent(pagePath(sitePath, "toggle.md")))
    .toBe(togglePageContent);
});

test("a post shows a date input instead of a template and edits persist as ISO", async () => {
  const sitePath = await createFormSite("Post Date Site");
  const { window } = await openSiteWindow(sitePath);

  await openFile(window, /^Dated Post/);
  const details = await expandDetails(window, "Post");

  await expect(details.getByLabel("Template")).toHaveCount(0);
  const dateField = details.getByLabel("Date");
  await expect(dateField).toHaveAttribute("type", "date");
  await expect(dateField).toHaveValue("2026-03-10");

  await dateField.fill("2026-05-01");
  await expect
    .poll(() =>
      fileContent(path.join(sitePath, "content", "posts", "dated-post.md")),
    )
    .toBe("---\ntitle: Dated Post\ndate: 2026-05-01\n---\n\nPost body.\n");
});

test("a file with no frontmatter gains a valid block on the first form edit", async () => {
  const sitePath = await createFormSite("Fresh Block Site");
  const { window } = await openSiteWindow(sitePath);

  await openFile(window, "plain");
  const details = await expandDetails(window, "Page");

  const titleField = details.getByLabel("Title");
  await expect(titleField).toHaveValue("");
  await expect(details.getByText("Every page needs a title.")).toBeVisible();

  await titleField.fill("Fresh");
  await expect
    .poll(() => fileContent(pagePath(sitePath, "plain.md")))
    .toBe("---\ntitle: Fresh\n---\nJust words.\n");
  await expect(details.getByText("Every page needs a title.")).toBeHidden();
});

test("frontmatter is hidden by default, typing stays in the body, and collapsing reveals it", async () => {
  const sitePath = await createFormSite("Hidden Frontmatter Site");
  const { window } = await openSiteWindow(sitePath);

  await openFile(window, "Hidden Page");
  const toggle = window.getByRole("button", { name: "Page details" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => editorText(window)).toBe("Body here.\n");

  await window.locator(".cm-content").click();
  const docStartShortcut =
    process.platform === "darwin" ? "Meta+ArrowUp" : "Control+Home";
  await window.keyboard.press(docStartShortcut);
  await window.keyboard.type("X");
  await expect
    .poll(() => fileContent(pagePath(sitePath, "hidden.md")))
    .toBe("---\ntitle: Hidden Page\n---\nXBody here.\n");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(() => editorText(window))
    .toBe("---\ntitle: Hidden Page\n---\nXBody here.\n");
});

test("the collapsed details choice persists across app relaunches", async () => {
  const sitePath = await createFormSite("Sticky Panel Site");
  const userDataDir = await createTempDir("nefantaris-userdata-");

  const firstRun = await launchEditor(userDataDir);
  const firstWelcome = await firstRun.firstWindow();
  await stubDirectoryPicker(firstRun, sitePath);
  const firstWindowPromise = firstRun.waitForEvent("window");
  await firstWelcome.getByRole("button", { name: "Open site…" }).click();
  const firstWindow = await firstWindowPromise;
  await openFile(firstWindow, "Hidden Page");
  const firstToggle = firstWindow.getByRole("button", {
    name: "Page details",
  });
  await firstToggle.click();
  await expect(firstToggle).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => editorText(firstWindow)).toBe(hiddenPageContent);
  await firstRun.close();

  const secondRun = await launchEditor(userDataDir);
  const secondWelcome = await secondRun.firstWindow();
  await stubDirectoryPicker(secondRun, sitePath);
  const secondWindowPromise = secondRun.waitForEvent("window");
  await secondWelcome.getByRole("button", { name: "Open site…" }).click();
  const secondWindow = await secondWindowPromise;
  await openFile(secondWindow, "Hidden Page");
  await expect(
    secondWindow.getByRole("button", { name: "Page details" }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => editorText(secondWindow)).toBe(hiddenPageContent);
});

test("the Insert button inserts a directive block at the cursor and it decorates", async () => {
  const sitePath = await createFormSite("Palette Button Site");
  const { window } = await openSiteWindow(sitePath);

  await openFile(window, "Palette Page");
  await window.locator(".cm-line", { hasText: "Welcome text." }).click();
  await window.getByRole("button", { name: "Insert" }).click();

  const dialog = window.getByRole("dialog");
  await expect(dialog).toContainText("Insert a block");
  await dialog.getByRole("button", { name: "gallery" }).click();

  const openFence = window.locator(".nef-directive-fence-open");
  await expect(openFence).toHaveAttribute("data-directive", "gallery");
  await expect(window.locator(".nef-directive-fence-close")).toBeVisible();

  await window.keyboard.type("hello");
  await expect
    .poll(() => fileContent(pagePath(sitePath, "palette.md")))
    .toBe(
      "---\ntitle: Palette Page\n---\n\nWelcome text.\n\n:::gallery\nhello\n:::\n",
    );
});

test("Cmd+/ opens the keyboard-navigable palette and Escape closes it", async () => {
  const sitePath = await createFormSite("Palette Keys Site");
  const { window } = await openSiteWindow(sitePath);

  await openFile(window, "Palette Page");
  await window.locator(".cm-line", { hasText: "Welcome text." }).click();
  await window.keyboard.press("ControlOrMeta+/");

  const dialog = window.getByRole("dialog");
  const galleryOption = dialog.getByRole("button", { name: "gallery" });
  await expect(galleryOption).toBeFocused();
  await window.keyboard.press("ArrowDown");
  await expect(galleryOption).toBeFocused();
  await window.keyboard.press("Enter");

  await expect(window.locator(".nef-directive-fence-open")).toHaveAttribute(
    "data-directive",
    "gallery",
  );
  await expect
    .poll(() => fileContent(pagePath(sitePath, "palette.md")))
    .toContain(":::gallery\n\n:::");

  await window.keyboard.press("ControlOrMeta+/");
  await expect(dialog).toBeVisible();
  await window.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
