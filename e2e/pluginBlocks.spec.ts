import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  createEditorSite,
  editorLine,
  openPage,
  pageText,
  toolbarButton,
} from "./editorTestSite.ts";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { cleanupTestArtifacts } from "./helpers.ts";
import { pluginBlockSchemas } from "./pluginFixtures.ts";
import { fakeThemeEnv } from "./themeFixtures.ts";

const blocksPage = "---\ntitle: Blocks Page\n---\n\nIntro text.\n";

const groupTitles = [
  "From your theme",
  "From add-ons: Contact form",
  "From add-ons: nefantaris-plugin-greeter",
];

const pluginBlocksEnv: Record<string, string> = {
  ...fakeThemeEnv,
  FAKE_CORE_DIRECTIVE_SCHEMAS: JSON.stringify(pluginBlockSchemas),
};

async function openBlocksPage(): Promise<{ window: Page; sitePath: string }> {
  const sitePath = await createEditorSite({ "blocks.md": blocksPage });
  const { window } = await openSiteWithFakeCore(sitePath, pluginBlocksEnv);
  await openPage(window, "Blocks Page");
  return { window, sitePath };
}

test.afterEach(cleanupTestArtifacts);

test("the block palette and the toolbar group blocks by where they come from, and a plugin block gets its option form", async () => {
  const { window, sitePath } = await openBlocksPage();

  await editorLine(window, "Intro text.").click();
  await window.keyboard.press("ControlOrMeta+/");
  const palette = window.getByRole("dialog", { name: "Insert a block" });
  await expect(palette.getByRole("heading", { level: 3 })).toHaveText(
    groupTitles,
  );
  await expect(
    palette
      .getByRole("region", { name: "From your theme" })
      .getByRole("button"),
  ).toHaveText(["BadgeA short highlighted link.", "gallery"]);
  await expect(
    palette
      .getByRole("region", { name: "From add-ons: Contact form" })
      .getByRole("button"),
  ).toHaveText(["Contact formA form visitors can send you a message with."]);
  await expect(
    palette
      .getByRole("region", { name: "From add-ons: nefantaris-plugin-greeter" })
      .getByRole("button"),
  ).toHaveText(["GreeterGreets someone by name."]);
  await expect(palette.getByRole("button").first()).toBeFocused();
  await window.keyboard.press("ArrowUp");
  await expect(palette.getByRole("button", { name: /^Greeter/ })).toBeFocused();
  await window.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  await editorLine(window, "Intro text.").click();
  await toolbarButton(window, "Insert block").click();
  await expect(palette.getByRole("heading", { level: 3 })).toHaveText(
    groupTitles,
  );
  await palette.getByRole("button", { name: /^Greeter/ }).click();

  const form = window.getByRole("dialog", { name: "Add Greeter" });
  await expect(form.getByText("Greets someone by name.")).toBeVisible();
  await expect(
    form.getByRole("group", { name: "Who", exact: true }).getByText("Required"),
  ).toBeVisible();
  await form.getByRole("button", { name: "Insert" }).click();
  await expect(form.getByText("This is required.")).toBeVisible();
  expect(await pageText(sitePath, "blocks.md")).toBe(blocksPage);

  await form.getByRole("textbox", { name: "Who" }).fill("Ada");
  await form
    .getByRole("group", { name: "Size" })
    .getByRole("radio", { name: "Large" })
    .check();
  await form.getByRole("button", { name: "Insert" }).click();
  await expect(form).toBeHidden();
  await expect
    .poll(() => pageText(sitePath, "blocks.md"))
    .toBe(`${blocksPage}\n::greeter{to="Ada" size="large"}\n`);
});

test("the slash menu groups blocks by where they come from", async () => {
  const { window, sitePath } = await openBlocksPage();

  await editorLine(window, "Intro text.").click();
  await window.keyboard.press("End");
  await window.keyboard.press("Enter");
  await window.keyboard.press("Enter");
  await window.keyboard.type("/");
  const menu = window.getByRole("listbox", { name: "Add to the page" });
  await expect(menu).toBeVisible();
  await expect(menu.locator("completion-section")).toHaveText([
    "Text",
    "Insert",
    ...groupTitles,
  ]);

  await window.keyboard.type("contact");
  await expect(menu.getByRole("option")).toHaveText([/^Contact form/]);
  await expect(menu.locator("completion-section")).toHaveText([
    "From add-ons: Contact form",
  ]);
  await window.keyboard.press("Enter");

  const form = window.getByRole("dialog", { name: "Add Contact form" });
  await expect(
    form.getByRole("textbox", { name: "Notification subject" }),
  ).toHaveValue("New message from your website");
  await form.getByRole("button", { name: "Insert" }).click();
  await expect(form).toBeHidden();
  await expect
    .poll(() => pageText(sitePath, "blocks.md"))
    .toMatch(/Intro text\.\n\n::contact-form\n/);
  expect(await pageText(sitePath, "blocks.md")).not.toContain("/contact");
});
