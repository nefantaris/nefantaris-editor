import type { ElectronApplication, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  createEditorSite,
  cursorAt,
  editorLine,
  formattingToolbar,
  openPage,
  pageText,
  pasteIntoEditor,
  selectInLine,
  toolbarButton,
} from "./editorTestSite.ts";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { cleanupTestArtifacts } from "./helpers.ts";

const formatPage =
  "---\ntitle: Format Page\n---\n\nHello world here.\n\nSecond line text.\n";
const listPage = "---\ntitle: List Page\n---\n\nApples\nPears\n\nPlain.\n";
const blockPage = "---\ntitle: Block Page\n---\n\nIntro.\n";
const linkPage =
  "---\ntitle: Link Page\n---\n\nRead the guide today.\n\nVisit [old site](https://old.example.com) now.\n";
const aboutPage = "---\ntitle: About\n---\n\nAbout us.\n";

const photoGridSchemas = {
  photos: {
    label: "Photo grid",
    description: "Pictures in a grid.",
    body: "images",
    placeholder: null,
    attributes: {},
  },
  note: {
    label: "Note",
    description: null,
    body: "markdown",
    placeholder: null,
    attributes: {},
  },
};

async function openEditingSite(
  pages: Record<string, string>,
  title: string,
  extraEnv: Record<string, string> = {},
  imageNames: string[] = [],
): Promise<{ app: ElectronApplication; window: Page; sitePath: string }> {
  const sitePath = await createEditorSite(pages, imageNames);
  const { app, window } = await openSiteWithFakeCore(sitePath, extraEnv);
  await openPage(window, title);
  return { app, window, sitePath };
}

function blankTableRow(): string {
  const cell = " ".repeat(8);
  return `| ${[cell, cell, cell].join(" | ")} |`;
}

test.afterEach(cleanupTestArtifacts);

test("inline styles toggle on the word at the cursor or the selection, toggle off, and undo in one step", async () => {
  const { window, sitePath } = await openEditingSite(
    { "format.md": formatPage },
    "Format Page",
  );
  const text = () => pageText(sitePath, "format.md");
  const bold = toolbarButton(window, "Bold");

  await cursorAt(window, "Hello world here.", 2);
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await bold.click();
  await expect
    .poll(text)
    .toBe(formatPage.replace("Hello world", "**Hello** world"));
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await bold.click();
  await expect.poll(text).toBe(formatPage);
  await expect(bold).toHaveAttribute("aria-pressed", "false");

  await selectInLine(window, "Hello world here.", 6, 5);
  await window.keyboard.press("ControlOrMeta+i");
  await expect.poll(text).toBe(formatPage.replace("world", "*world*"));
  await expect(toolbarButton(window, "Italic")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await window.keyboard.press("ControlOrMeta+z");
  await expect.poll(text).toBe(formatPage);

  await selectInLine(window, "Hello world here.", 6, 5);
  await toolbarButton(window, "Strikethrough").click();
  await expect.poll(text).toBe(formatPage.replace("world", "~~world~~"));
  await toolbarButton(window, "Strikethrough").click();
  await expect.poll(text).toBe(formatPage);

  await cursorAt(window, "Hello world here.", 13);
  await toolbarButton(window, "Code").click();
  await expect.poll(text).toBe(formatPage.replace("here.", "`here`."));
  await expect(toolbarButton(window, "Code")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await window.keyboard.press("End");
  await window.keyboard.press("ControlOrMeta+b");
  await window.keyboard.type("new");
  await expect.poll(text).toBe(formatPage.replace("here.", "`here`.**new**"));
});

test("the text style menu sets headings, explains the page title, and the toolbar moves focus with arrow keys", async () => {
  const { window, sitePath } = await openEditingSite(
    { "format.md": formatPage },
    "Format Page",
  );
  const text = () => pageText(sitePath, "format.md");
  const styleButton = formattingToolbar(window).getByRole("button", {
    name: /^Text style/,
  });
  await expect(styleButton).toHaveAccessibleDescription(
    /page title is already the top heading/,
  );
  await expect(toolbarButton(window, "Gallery")).toHaveCount(0);

  await cursorAt(window, "Second line text.", 3);
  await expect(styleButton).toHaveAccessibleName("Text style: Paragraph");
  await styleButton.click();
  await window.getByRole("menuitemradio", { name: "Heading 2" }).click();
  await expect
    .poll(text)
    .toBe(formatPage.replace("Second line", "## Second line"));
  await expect(styleButton).toHaveAccessibleName("Text style: Heading 2");

  await styleButton.focus();
  await window.keyboard.press("ArrowDown");
  await expect(
    window.getByRole("menuitemradio", { name: "Heading 2" }),
  ).toBeFocused();
  await window.keyboard.press("ArrowDown");
  await expect(
    window.getByRole("menuitemradio", { name: "Heading 3" }),
  ).toBeFocused();
  await window.keyboard.press("Enter");
  await expect
    .poll(text)
    .toBe(formatPage.replace("Second line", "### Second line"));
  await expect(window.getByRole("menu")).toBeHidden();

  await styleButton.click();
  await window.getByRole("menuitemradio", { name: "Paragraph" }).click();
  await expect.poll(text).toBe(formatPage);

  await styleButton.focus();
  await window.keyboard.press("ArrowRight");
  await expect(toolbarButton(window, "Bold")).toBeFocused();
  await expect(toolbarButton(window, "Bold")).toHaveAttribute("tabindex", "0");
  await expect(styleButton).toHaveAttribute("tabindex", "-1");
  await window.keyboard.press("End");
  await expect(toolbarButton(window, "Insert block")).toBeFocused();
  await window.keyboard.press("Home");
  await expect(styleButton).toBeFocused();
  await window.keyboard.press("ArrowLeft");
  await expect(toolbarButton(window, "Insert block")).toBeFocused();
});

test("lists and quotes toggle on every selected line and switch between kinds", async () => {
  const { window, sitePath } = await openEditingSite(
    { "lists.md": listPage },
    "List Page",
  );
  const text = () => pageText(sitePath, "lists.md");

  await cursorAt(window, "Apples", 0);
  await window.keyboard.press("Shift+ArrowDown");
  await window.keyboard.press("Shift+End");

  await toolbarButton(window, "Bulleted list").click();
  await expect
    .poll(text)
    .toBe(listPage.replace("Apples\nPears", "- Apples\n- Pears"));
  await expect(toolbarButton(window, "Bulleted list")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await toolbarButton(window, "Numbered list").click();
  await expect
    .poll(text)
    .toBe(listPage.replace("Apples\nPears", "1. Apples\n2. Pears"));
  await expect(toolbarButton(window, "Bulleted list")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await toolbarButton(window, "Checklist").click();
  await expect
    .poll(text)
    .toBe(listPage.replace("Apples\nPears", "- [ ] Apples\n- [ ] Pears"));
  await toolbarButton(window, "Checklist").click();
  await expect.poll(text).toBe(listPage);

  await toolbarButton(window, "Quote").click();
  await expect
    .poll(text)
    .toBe(listPage.replace("Apples\nPears", "> Apples\n> Pears"));
  await expect(toolbarButton(window, "Quote")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await toolbarButton(window, "Quote").click();
  await expect.poll(text).toBe(listPage);

  await cursorAt(window, "Plain.", 0);
  await toolbarButton(window, "Bulleted list").click();
  await window.keyboard.press("ControlOrMeta+z");
  await expect.poll(text).toBe(listPage);
});

test("divider, table grid and code block insert well-formed blocks, and formatting is off inside code", async () => {
  const { window, sitePath } = await openEditingSite(
    { "blocks.md": blockPage },
    "Block Page",
  );
  const text = () => pageText(sitePath, "blocks.md");

  await editorLine(window, "Intro.").click();
  await toolbarButton(window, "Divider").click();
  await expect.poll(text).toBe(`${blockPage}\n---\n`);

  await toolbarButton(window, "Table").click();
  const tableDialog = window.getByRole("dialog", { name: "Add a table" });
  await expect(tableDialog).toContainText("heading row");
  await expect(
    tableDialog.getByRole("button", { name: "1 column, 1 row" }),
  ).toBeFocused();
  await window.keyboard.press("ArrowRight");
  await window.keyboard.press("ArrowDown");
  await expect(
    tableDialog.getByRole("button", { name: "2 columns, 2 rows" }),
  ).toBeFocused();
  await expect(tableDialog.getByText("2 columns, 2 rows")).toBeVisible();
  await tableDialog.getByRole("button", { name: "3 columns, 2 rows" }).click();
  await expect(tableDialog).toBeHidden();
  await window.keyboard.type("Name");
  const table = [
    "| Name | Column 2 | Column 3 |",
    "| -------- | -------- | -------- |",
    blankTableRow(),
    blankTableRow(),
  ].join("\n");
  await expect.poll(text).toBe(`${blockPage}\n---\n\n${table}\n`);

  await editorLine(window, "Intro.").click();
  await toolbarButton(window, "Code block").click();
  const codeDialog = window.getByRole("dialog", { name: "Add a code block" });
  await codeDialog.getByLabel("Language (optional)").fill("js");
  await codeDialog.getByRole("button", { name: "Insert" }).click();
  await expect(codeDialog).toBeHidden();
  await window.keyboard.type("let a = 1;");
  const finalText = `${blockPage.replace("Intro.\n", "Intro.\n\n```js\nlet a = 1;\n```\n")}\n---\n\n${table}\n`;
  await expect.poll(text).toBe(finalText);

  await expect(toolbarButton(window, "Bold")).toBeDisabled();
  await expect(toolbarButton(window, "Table")).toBeDisabled();
  await window.keyboard.press("ControlOrMeta+b");
  await window.keyboard.press("ControlOrMeta+k");
  await expect(window.getByRole("dialog")).toHaveCount(0);
  await expect.poll(text).toBe(finalText);
});

test("links are added from the page picker, edited, removed, and made by pasting an address over text", async () => {
  const { window, sitePath } = await openEditingSite(
    { "links.md": linkPage, "about.md": aboutPage },
    "Link Page",
  );
  const text = () => pageText(sitePath, "links.md");

  await selectInLine(window, "Read the guide today.", 9, 5);
  await window.keyboard.press("ControlOrMeta+k");
  const addDialog = window.getByRole("dialog", { name: "Add a link" });
  await expect(addDialog.getByLabel("Text to show")).toHaveValue("guide");
  await addDialog
    .getByRole("combobox", { name: "Goes to" })
    .selectOption({ label: "About (/about)" });
  await addDialog.getByRole("button", { name: "Add link" }).click();
  await expect
    .poll(text)
    .toBe(linkPage.replace("the guide today", "the [guide](/about) today"));

  await cursorAt(window, "Visit", 8);
  const linkButton = toolbarButton(window, "Link");
  await expect(linkButton).toHaveAttribute("aria-pressed", "true");
  await linkButton.click();
  const editDialog = window.getByRole("dialog", { name: "Edit link" });
  await expect(editDialog.getByLabel("Text to show")).toHaveValue("old site");
  const address = editDialog.getByRole("textbox", { name: "Goes to address" });
  await expect(address).toHaveValue("https://old.example.com");
  await address.fill("new.example.com");
  await editDialog.getByRole("button", { name: "Save link" }).click();
  await expect
    .poll(text)
    .toContain("Visit [old site](https://new.example.com) now.");

  await cursorAt(window, "Visit", 8);
  await linkButton.click();
  await editDialog.getByRole("button", { name: "Remove link" }).click();
  await expect.poll(text).toContain("\nVisit old site now.\n");

  await selectInLine(window, "Visit old site now.", 15, 3);
  await window.keyboard.press("ControlOrMeta+k");
  await addDialog.getByLabel("Text to show").fill("");
  await addDialog.getByRole("button", { name: "Add link" }).click();
  await expect(
    addDialog.getByText("Write the words people click."),
  ).toBeVisible();
  await expect(
    addDialog.getByText("Choose where the link goes."),
  ).toBeVisible();
  await window.keyboard.press("Escape");
  await expect(addDialog).toBeHidden();

  await selectInLine(window, "Visit old site now.", 15, 3);
  await pasteIntoEditor(window, { text: "https://example.com/now" });
  await expect
    .poll(text)
    .toContain("\nVisit old site [now](https://example.com/now).\n");
});

test("an image needs a description and is written with it", async () => {
  const { window, sitePath } = await openEditingSite(
    { "blocks.md": blockPage },
    "Block Page",
    {},
    ["cover.webp"],
  );

  await editorLine(window, "Intro.").click();
  await toolbarButton(window, "Image").click();
  const dialog = window.getByRole("dialog", { name: "Add an image" });
  await expect(dialog).toContainText("People who can’t see it hear this");
  await dialog.getByRole("button", { name: "Insert" }).click();
  await expect(dialog.getByText("Choose an image to show.")).toBeVisible();
  await expect(
    dialog.getByText("Describe the image so everyone knows what it shows."),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Choose from your images" }).click();
  await window
    .getByRole("dialog", { name: "Choose an image" })
    .getByRole("button", { name: "cover.webp" })
    .click();
  await expect(dialog.getByText("Choose an image to show.")).toBeHidden();
  await dialog.getByRole("button", { name: "Insert" }).click();
  await expect(dialog.getByLabel("Image description")).toBeFocused();
  await dialog.getByLabel("Image description").fill("A red [square]");
  await dialog.getByRole("button", { name: "Insert" }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(() => pageText(sitePath, "blocks.md"))
    .toBe(`${blockPage}\n![A red \\[square\\]](/assets/cover.webp)\n`);
});

test("the gallery picks several images with a description each, reorders them, and writes the theme's image block", async () => {
  const { window, sitePath } = await openEditingSite(
    { "blocks.md": blockPage },
    "Block Page",
    { FAKE_CORE_DIRECTIVE_SCHEMAS: JSON.stringify(photoGridSchemas) },
    ["a.webp", "b.webp"],
  );

  await editorLine(window, "Intro.").click();
  await toolbarButton(window, "Gallery").click();
  const dialog = window.getByRole("dialog", { name: "Add Photo grid" });
  await dialog.getByRole("button", { name: "Insert" }).click();
  await expect(dialog.getByText("Add at least one image.")).toBeVisible();

  await dialog.getByRole("button", { name: "Choose from your images" }).click();
  const picker = window.getByRole("dialog", { name: "Choose images" });
  await picker.getByRole("button", { name: "a.webp" }).click();
  await picker.getByRole("button", { name: "b.webp" }).click();
  await expect(picker.getByRole("button", { name: "a.webp" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await picker.getByRole("button", { name: "Add 2 images" }).click();
  await expect(picker).toBeHidden();

  await dialog.getByLabel("Description of a.webp").fill("First");
  await dialog.getByRole("button", { name: "Insert" }).click();
  await expect(
    dialog.getByText("Describe the image so everyone knows what it shows."),
  ).toBeVisible();
  await expect(dialog.getByLabel("Description of b.webp")).toBeFocused();
  await dialog.getByLabel("Description of b.webp").fill("Second");
  await dialog.getByRole("button", { name: "Move b.webp up" }).click();
  await expect(dialog.getByRole("listitem")).toHaveCount(2);
  await expect(dialog.getByRole("listitem").first()).toContainText("b.webp");
  await dialog.getByRole("button", { name: "Insert" }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(() => pageText(sitePath, "blocks.md"))
    .toBe(
      `${blockPage}\n:::photos\n![Second](/assets/b.webp)\n![First](/assets/a.webp)\n:::\n`,
    );
  await expect(
    window.locator('.nef-directive-fence-open[data-directive="photos"]'),
  ).toContainText("Photo grid");

  await toolbarButton(window, "Insert block").click();
  await window
    .getByRole("dialog", { name: "Insert a block" })
    .getByRole("button", { name: /^Photo grid/ })
    .click();
  await expect(dialog).toBeVisible();
  await window.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("formatting is unavailable inside the frontmatter", async () => {
  const { window, sitePath } = await openEditingSite(
    { "format.md": formatPage },
    "Format Page",
  );
  await window.getByRole("button", { name: "Page details" }).click();
  await expect(
    window.getByRole("button", { name: "Page details" }),
  ).toHaveAttribute("aria-expanded", "false");
  await cursorAt(window, "title: Format Page", 3);
  await expect(toolbarButton(window, "Bold")).toBeDisabled();
  await expect(toolbarButton(window, "Bulleted list")).toBeDisabled();
  await window.keyboard.press("ControlOrMeta+b");
  await toolbarButton(window, "Quote").click({ force: true });
  await cursorAt(window, "Hello world here.", 0);
  await expect(toolbarButton(window, "Bold")).toBeEnabled();
  expect(await pageText(sitePath, "format.md")).toBe(formatPage);
});
