import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { cleanupTestArtifacts, createTempDir } from "./helpers.ts";
import { columnsPlaceholder, fakeThemeEnv } from "./themeFixtures.ts";

const tinyWebpBase64 = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

const blocksPage = "---\ntitle: Blocks Page\n---\n\nIntro text.\n";

const editPage =
  "---\ntitle: Edit Page\n---\n\nBefore.\n\n" +
  '::badge[Read more]{#promo href="/old" data-track=\'x "y"\' tone="loud"}\n\n' +
  "After.\n";

async function createBlocksSite(): Promise<string> {
  const dir = await createTempDir("nefantaris-blocks-");
  await writeFile(
    path.join(dir, "nefantaris.json"),
    JSON.stringify({ name: "Blocks Site" }),
  );
  const pagesDir = path.join(dir, "content", "pages");
  await mkdir(pagesDir, { recursive: true });
  await writeFile(path.join(pagesDir, "blocks.md"), blocksPage);
  await writeFile(path.join(pagesDir, "edit.md"), editPage);
  await writeFile(
    path.join(pagesDir, "about.md"),
    "---\ntitle: About\n---\n\nAbout us.\n",
  );
  await mkdir(path.join(dir, "assets"));
  await writeFile(
    path.join(dir, "assets", "cover.webp"),
    Buffer.from(tinyWebpBase64, "base64"),
  );
  return dir;
}

function pageText(sitePath: string, fileName: string): Promise<string> {
  return readFile(path.join(sitePath, "content", "pages", fileName), "utf8");
}

async function openPage(window: Page, title: string): Promise<void> {
  await window.getByRole("button", { name: title, exact: true }).click();
  await expect(window.locator(".cm-content")).toBeVisible();
}

async function openPalette(window: Page, lineText: string): Promise<Locator> {
  await window.locator(".cm-line", { hasText: lineText }).click();
  await window.keyboard.press("ControlOrMeta+/");
  const palette = window.getByRole("dialog", { name: "Insert a block" });
  await expect(palette).toBeVisible();
  return palette;
}

test.afterEach(cleanupTestArtifacts);

test("the palette lists blocks by label, enforces required fields, and inserts a leaf with quoted options", async () => {
  const sitePath = await createBlocksSite();
  const { window } = await openSiteWithFakeCore(sitePath, fakeThemeEnv);
  await openPage(window, "Blocks Page");

  const palette = await openPalette(window, "Intro text.");
  await expect(palette.getByRole("button")).toHaveText([
    "gallery",
    "ColumnsBlocks of content side by side.",
    "Column",
    "BadgeA short highlighted link.",
  ]);
  await palette.getByRole("button", { name: /^Badge/ }).click();

  const form = window.getByRole("dialog", { name: "Add Badge" });
  await expect(form.getByText("A short highlighted link.")).toBeVisible();
  const link = form.getByRole("group", { name: "Link", exact: true });
  await expect(link.getByText("Required")).toBeVisible();
  await expect(
    form.getByRole("group", { name: "Tone" }).getByRole("radio", {
      name: "Calm",
    }),
  ).toBeChecked();

  await form.getByRole("button", { name: "Insert" }).click();
  await expect(link.getByText("This is required.")).toBeVisible();
  await expect(
    form.getByRole("combobox", { name: "Link", exact: true }),
  ).toBeFocused();
  expect(await pageText(sitePath, "blocks.md")).toBe(blocksPage);

  await form
    .getByRole("combobox", { name: "Link", exact: true })
    .selectOption({ label: "About (/about)" });
  await expect(link.getByText("This is required.")).toBeHidden();
  await form.getByRole("textbox", { name: "Caption" }).fill('Say "hi" & wave');
  await form.getByRole("checkbox", { name: "Highlighted" }).check();
  await form
    .getByRole("group", { name: "Icon" })
    .getByRole("button", { name: "Choose from your images" })
    .click();
  await window
    .getByRole("dialog", { name: "Choose icon" })
    .getByRole("button", { name: "cover.webp" })
    .click();
  await expect(form.getByText("cover.webp")).toBeVisible();
  await form.getByRole("button", { name: "Insert" }).click();

  await expect(form).toBeHidden();
  await expect
    .poll(() => pageText(sitePath, "blocks.md"))
    .toBe(
      `${blocksPage}\n::badge{href="/about" caption='Say "hi" & wave' icon="/assets/cover.webp" highlighted}\n`,
    );
});

test("a container block inserts its placeholder inside a longer fence and nesting lengthens the fences around it", async () => {
  const sitePath = await createBlocksSite();
  const { window } = await openSiteWithFakeCore(sitePath, fakeThemeEnv);
  await openPage(window, "Blocks Page");

  const palette = await openPalette(window, "Intro text.");
  await palette.getByRole("button", { name: /^Columns/ }).click();
  const form = window.getByRole("dialog", { name: "Add Columns" });
  await form.getByRole("radio", { name: "Wide" }).check();
  await form.getByRole("button", { name: "Insert" }).click();
  await expect(form).toBeHidden();
  await expect
    .poll(() => pageText(sitePath, "blocks.md"))
    .toBe(
      `${blocksPage}\n::::columns{gap="wide"}\n${columnsPlaceholder}\n::::\n`,
    );

  await window.keyboard.press("ControlOrMeta+/");
  await window
    .getByRole("dialog", { name: "Insert a block" })
    .getByRole("button", { name: "Column", exact: true })
    .click();
  const columnForm = window.getByRole("dialog", { name: "Add Column" });
  await columnForm.getByRole("button", { name: "Insert" }).click();
  await expect(columnForm.getByText("This is required.")).toBeVisible();
  await columnForm.getByRole("textbox", { name: "Heading" }).fill("Inner");
  await columnForm.getByRole("button", { name: "Insert" }).click();
  await expect(columnForm).toBeHidden();
  await window.keyboard.type("Nested words.");

  await expect
    .poll(() => pageText(sitePath, "blocks.md"))
    .toBe(
      `${blocksPage}\n:::::columns{gap="wide"}\n` +
        '::::column{heading="Left"}\n\n:::column{heading="Inner"}\nNested words.\n:::\n\n' +
        "The left column.\n::::\n\n" +
        ':::column{heading="Right"}\nThe right column.\n:::\n:::::\n',
    );

  await window.locator(".cm-line", { hasText: "Intro text." }).click();
  await expect(
    window.locator('.nef-directive-fence-open[data-directive="columns"]'),
  ).toContainText("Columns");
  await expect(
    window.locator('.nef-directive-fence-open[data-directive="column"]'),
  ).toHaveCount(3);
  await expect(window.locator(".nef-directive-fence-close")).toHaveCount(4);
});

test("a block's options form edits only its attributes and keeps the ones the theme doesn't declare", async () => {
  const sitePath = await createBlocksSite();
  const { window } = await openSiteWithFakeCore(sitePath, fakeThemeEnv);
  await openPage(window, "Edit Page");

  const leaf = window.locator(
    '.nef-directive-fence-leaf[data-directive="badge"]',
  );
  await expect(leaf).toContainText("Badge");
  await leaf.getByRole("button", { name: "Badge options" }).click();

  const form = window.getByRole("dialog", { name: "Badge options" });
  await expect(
    form.getByRole("combobox", { name: "Link", exact: true }),
  ).toHaveValue("address");
  await expect(form.getByRole("textbox", { name: "Link address" })).toHaveValue(
    "/old",
  );
  await expect(form.getByRole("radio", { name: "Loud" })).toBeChecked();
  await expect(
    form.getByRole("checkbox", { name: "Highlighted" }),
  ).not.toBeChecked();

  await form
    .getByRole("combobox", { name: "Link", exact: true })
    .selectOption({ label: "About (/about)" });
  await form.getByRole("radio", { name: "Calm" }).check();
  await form.getByRole("checkbox", { name: "Highlighted" }).check();
  await form.getByRole("button", { name: "Save" }).click();

  await expect(form).toBeHidden();
  await expect
    .poll(() => pageText(sitePath, "edit.md"))
    .toBe(
      editPage.replace(
        '::badge[Read more]{#promo href="/old" data-track=\'x "y"\' tone="loud"}',
        '::badge[Read more]{#promo href="/about" data-track=\'x "y"\' highlighted}',
      ),
    );

  await leaf.getByRole("button", { name: "Badge options" }).click();
  await window.keyboard.press("Escape");
  await expect(form).toBeHidden();
  await expect(window.locator(".cm-line", { hasText: "After." })).toBeVisible();
});

test("the options control is reachable from the keyboard", async () => {
  const sitePath = await createBlocksSite();
  const { window } = await openSiteWithFakeCore(sitePath, fakeThemeEnv);
  await openPage(window, "Edit Page");

  const options = window.getByRole("button", { name: "Badge options" });
  await expect(options).toBeVisible();
  await window.locator(".cm-line", { hasText: "Before." }).click();
  await window.keyboard.press("Tab");
  await expect(options).toBeFocused();
  await window.keyboard.press("Enter");
  await expect(
    window.getByRole("dialog", { name: "Badge options" }),
  ).toBeVisible();
});
