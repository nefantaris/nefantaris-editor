import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  createEditorSite,
  cursorAt,
  editorLine,
  openPage,
  pageText,
} from "./editorTestSite.ts";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { cleanupTestArtifacts } from "./helpers.ts";
import { fakeThemeEnv } from "./themeFixtures.ts";

const slashPage =
  "---\ntitle: Slash Page\n---\n\nFirst paragraph.\n\n```js\nconst a = 1;\n```\n";

function slashMenu(window: Page): Locator {
  return window.getByRole("listbox", { name: "Add to the page" });
}

async function startNewLine(window: Page): Promise<void> {
  await editorLine(window, "First paragraph.").click();
  await window.keyboard.press("End");
  await window.keyboard.press("Enter");
  await window.keyboard.press("Enter");
}

async function waitForMenu(window: Page): Promise<Locator> {
  const menu = slashMenu(window);
  await expect(menu).toBeVisible();
  await window.waitForTimeout(150);
  return menu;
}

async function openSlashSite(): Promise<{ window: Page; sitePath: string }> {
  const sitePath = await createEditorSite({ "slash.md": slashPage });
  const { window } = await openSiteWithFakeCore(sitePath, fakeThemeEnv);
  await openPage(window, "Slash Page");
  return { window, sitePath };
}

test.afterEach(cleanupTestArtifacts);

test("typing / at the start of a line lists everything that can be added and filters as you type", async () => {
  const { window, sitePath } = await openSlashSite();
  const text = () => pageText(sitePath, "slash.md");

  await startNewLine(window);
  await window.keyboard.type("/");
  const menu = await waitForMenu(window);
  for (const label of [
    "Heading 2",
    "Bulleted list",
    "Checklist",
    "Quote",
    "Code block",
    "Divider",
    "Table",
    "Image",
    "Link",
    "Columns",
    "Badge",
  ]) {
    await expect(
      menu.getByRole("option", { name: new RegExp(`^${label}`) }),
    ).toBeVisible();
  }
  await expect(menu.getByRole("option", { name: /^Badge/ })).toContainText(
    "A short highlighted link.",
  );

  await window.keyboard.type("head");
  await expect(menu.getByRole("option")).toHaveText([
    /^Heading 2/,
    /^Heading 3/,
    /^Heading 4/,
  ]);
  await window.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("option", { name: /^Heading 3/ }),
  ).toHaveAttribute("aria-selected", "true");
  await window.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  const withLine = (line: string) =>
    slashPage.replace("First paragraph.\n", `First paragraph.\n\n${line}\n`);
  await expect.poll(text).toBe(withLine("### "));

  await window.keyboard.press("ControlOrMeta+z");
  await expect.poll(text).toBe(withLine("/head"));
  await window.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(text).toBe(withLine("### "));
  await window.keyboard.type("Big idea");
  await expect.poll(text).toBe(withLine("### Big idea"));
});

test("slash items insert lists, open dialogs, and add theme blocks in one undoable step", async () => {
  const { window, sitePath } = await openSlashSite();
  const text = () => pageText(sitePath, "slash.md");

  await startNewLine(window);
  await window.keyboard.type("/check");
  await waitForMenu(window);
  await window.keyboard.press("Enter");
  await window.keyboard.type("Milk");
  await expect
    .poll(text)
    .toBe(
      slashPage.replace(
        "First paragraph.\n",
        "First paragraph.\n\n- [ ] Milk\n",
      ),
    );

  await startNewLine(window);
  await window.keyboard.type("/table");
  await waitForMenu(window);
  await window.keyboard.press("Enter");
  const tableDialog = window.getByRole("dialog", { name: "Add a table" });
  await tableDialog.getByRole("button", { name: "1 column, 1 row" }).click();
  await expect(tableDialog).toBeHidden();
  await expect
    .poll(text)
    .toContain(
      "First paragraph.\n\n| Column 1 |\n| -------- |\n|          |\n\n- [ ] Milk",
    );
  expect(await text()).not.toContain("/table");
  await window.keyboard.press("ControlOrMeta+z");
  await expect.poll(text).toContain("First paragraph.\n\n/table\n\n- [ ] Milk");

  await cursorAt(window, "/table", 0);
  await window.keyboard.press("Shift+End");
  await window.keyboard.press("Backspace");
  await window.keyboard.type("/badge");
  const menu = await waitForMenu(window);
  await expect(menu.getByRole("option")).toHaveText([
    /^BadgeA short highlighted link\./,
  ]);
  await window.keyboard.press("Enter");
  const badgeForm = window.getByRole("dialog", { name: "Add Badge" });
  await badgeForm
    .getByRole("combobox", { name: "Link", exact: true })
    .selectOption({ label: "Slash Page (/slash)" });
  await badgeForm.getByRole("button", { name: "Insert" }).click();
  await expect(badgeForm).toBeHidden();
  await expect
    .poll(text)
    .toContain('First paragraph.\n\n::badge{href="/slash"}\n\n- [ ] Milk');
  expect(await text()).not.toContain("/badge");

  await startNewLine(window);
  await window.keyboard.type("/link");
  await waitForMenu(window);
  await window.keyboard.press("Enter");
  const linkDialog = window.getByRole("dialog", { name: "Add a link" });
  await linkDialog.getByLabel("Text to show").fill("Home");
  await linkDialog
    .getByRole("combobox", { name: "Goes to" })
    .selectOption({ label: "Slash Page (/slash)" });
  await linkDialog.getByRole("button", { name: "Add link" }).click();
  await expect
    .poll(text)
    .toContain('First paragraph.\n\n[Home](/slash)\n\n::badge{href="/slash"}');

  await startNewLine(window);
  await window.keyboard.type("/image");
  await waitForMenu(window);
  await window.keyboard.press("Enter");
  const imageDialog = window.getByRole("dialog", { name: "Add an image" });
  await expect(imageDialog).toBeVisible();
  await window.keyboard.press("Escape");
  await expect(imageDialog).toBeHidden();
  await expect.poll(text).toContain("First paragraph.\n\n\n\n[Home](/slash)");
  expect(await text()).not.toContain("/image");
});

test("Escape closes the menu and keeps the slash, and it never opens mid-line, in code, or in the frontmatter", async () => {
  const { window, sitePath } = await openSlashSite();
  const text = () => pageText(sitePath, "slash.md");

  await startNewLine(window);
  await window.keyboard.type("/");
  const menu = await waitForMenu(window);
  await window.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await window.keyboard.type("etc");
  await expect(menu).toBeHidden();
  await expect
    .poll(text)
    .toBe(
      slashPage.replace("First paragraph.\n", "First paragraph.\n\n/etc\n"),
    );

  await window.keyboard.press("Enter");
  await window.keyboard.type("/zzzz");
  await window.waitForTimeout(300);
  await expect(menu).toBeHidden();

  await cursorAt(window, "First paragraph.", 6);
  await window.keyboard.type("/");
  await window.waitForTimeout(300);
  await expect(menu).toBeHidden();

  await editorLine(window, "const a = 1;").click();
  await window.keyboard.press("Home");
  await window.keyboard.type("/");
  await window.waitForTimeout(300);
  await expect(menu).toBeHidden();

  await window.getByRole("button", { name: "Page details" }).click();
  await cursorAt(window, "title: Slash Page", 0);
  await window.keyboard.type("/");
  await window.waitForTimeout(300);
  await expect(menu).toBeHidden();
  await expect.poll(text).toContain("/title: Slash Page");
  await expect.poll(text).toContain("/const a = 1;");
  await expect.poll(text).toContain("First /paragraph.");
});
