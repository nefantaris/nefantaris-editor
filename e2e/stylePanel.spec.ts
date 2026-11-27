import { expect, test } from "@playwright/test";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { cleanupTestArtifacts } from "./helpers.ts";
import {
  chooseElementType,
  chooseScope,
  clickInScaledPreview,
  frameWidth,
  openStyle,
  openStyleSite,
  pasteInto,
  setField,
  stylesheetText,
} from "./styleFixtures.ts";

test.afterEach(cleanupTestArtifacts);

test("a target comes from a pick in plain words, an element type, or a theme part, and the preview highlights its matches", async () => {
  const { window, frame, panel } = await openStyleSite();
  const pick = panel.getByRole("button", { name: "Pick on the page" });

  await pick.click();
  await expect(pick).toHaveAttribute("aria-pressed", "true");
  await expect(frame.locator("body")).toHaveAttribute("data-selecting", "true");
  await expect.poll(() => frameWidth(frame)).toBe(1024);
  await clickInScaledPreview(
    window,
    frame.getByRole("heading", { name: "Welcome hero" }),
  );

  const choices = panel.getByRole("radiogroup", { name: "Style which?" });
  await expect(choices.getByRole("radio")).toHaveCount(3);
  await expect(choices).toContainText("Heading 2s in the Hero (1)");
  await expect(choices).toContainText("Every Heading 2 in page content (3)");
  await expect(choices).toContainText("Every Heading 2 on the site (3)");
  await expect(
    choices.getByRole("radio", { name: "Heading 2s in the Hero (1)" }),
  ).toBeChecked();
  await expect(pick).toHaveAttribute("aria-pressed", "false");
  await expect(frame.locator("body")).toHaveAttribute(
    "data-selecting",
    "false",
  );
  await expect(frame.locator("[data-fake-highlight]")).toHaveCount(1);
  await expect(frame.locator("[data-fake-highlight]")).toHaveText(
    "Welcome hero",
  );
  await expect(panel.getByText("1 on this page.")).toBeVisible();

  await choices
    .getByRole("radio", { name: "Every Heading 2 in page content (3)" })
    .check();
  await expect(frame.locator("h2[data-fake-highlight]")).toHaveCount(3);
  await expect(panel.getByText("3 on this page.")).toBeVisible();
  const selectorCode = panel.locator("code", {
    hasText: '[data-part="content"] h2',
  });
  await expect(selectorCode).toBeHidden();
  await panel.getByText("CSS", { exact: true }).click();
  await expect(selectorCode).toBeVisible();

  await chooseElementType(panel, "Body text");
  await expect(choices).toBeHidden();
  await expect(frame.locator("p[data-fake-highlight]")).toHaveCount(2);
  await expect(panel.getByText("2 on this page.")).toBeVisible();

  await panel
    .getByRole("combobox", { name: "Theme part" })
    .selectOption({ label: "Hero" });
  await expect(frame.locator("[data-fake-highlight]")).toHaveCount(1);
  await expect(frame.locator("[data-fake-highlight]")).toHaveAttribute(
    "data-part",
    "hero",
  );
  await expect(
    panel.getByRole("combobox", { name: "Element type" }),
  ).toHaveValue("");

  await panel.getByRole("button", { name: "Hide the style panel" }).click();
  await expect(
    panel.getByRole("heading", { name: "Style", exact: true }),
  ).toBeHidden();
  await expect.poll(() => frameWidth(frame)).toBeGreaterThan(1100);
  await panel.getByRole("button", { name: "Show the style panel" }).click();
  await expect(panel.getByRole("combobox", { name: "Theme part" })).toHaveValue(
    '[data-part="hero"]',
  );
  await expect.poll(() => frameWidth(frame)).toBe(1024);

  await window
    .getByRole("navigation", { name: "Site sections" })
    .getByRole("button", { name: "Content", exact: true })
    .click();
  await expect(frame.locator("[data-fake-highlight]")).toHaveCount(0);
});

test("the screen size resizes the preview, writes into its media block, and shows what it overrides", async () => {
  const { frame, panel, stylesheet } = await openStyleSite();
  await chooseElementType(panel, "Heading 2");
  const contentHeading = frame.getByRole("heading", {
    name: "About this site",
  });
  await expect(contentHeading).toHaveCSS("font-size", "24px");

  await chooseScope(panel, "Phone");
  await expect.poll(() => frameWidth(frame)).toBe(375);
  await expect(panel.getByText("Screens narrower than 768 px")).toBeVisible();
  await setField(panel, "Font size", "30");
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe(
      '@media (max-width: 767.98px) {\n  [data-part="content"] h2 {\n    font-size: 30px;\n  }\n}\n',
    );
  await expect(contentHeading).toHaveCSS("font-size", "30px");

  await chooseScope(panel, "Tablet");
  await expect.poll(() => frameWidth(frame)).toBe(768);
  await expect(contentHeading).toHaveCSS("font-size", "24px");
  await panel
    .getByRole("combobox", { name: "Font weight" })
    .selectOption({ label: "Light" });
  await chooseScope(panel, "All sizes");
  await expect.poll(() => frameWidth(frame)).toBeGreaterThanOrEqual(1024);
  await setField(panel, "Letter spacing", "0.1");
  await setField(panel, "Font size", "40");
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe(
      '[data-part="content"] h2 {\n  letter-spacing: 0.1em;\n  font-size: 40px;\n}\n\n' +
        '@media (max-width: 1023.98px) {\n  [data-part="content"] h2 {\n    font-weight: 300;\n  }\n}\n\n' +
        '@media (max-width: 767.98px) {\n  [data-part="content"] h2 {\n    font-size: 30px;\n  }\n}\n',
    );
  await expect(contentHeading).toHaveCSS("font-size", "40px");

  await chooseScope(panel, "Tablet");
  const fontSize = panel.getByRole("textbox", { name: "Font size" });
  await expect(fontSize).toHaveValue("");
  await expect(fontSize).toHaveAttribute("placeholder", "40px");
  const fontSizeField = panel.locator('[data-style-field="font size"]');
  await expect(fontSizeField.getByTestId("style-field-status")).toHaveText(
    "From All sizes",
  );
  await expect(
    panel.getByText("Overridden on Tablet: Font weight."),
  ).toBeVisible();

  await chooseScope(panel, "Phone");
  await expect(fontSize).toHaveValue("30px");
  await expect(fontSizeField.getByTestId("style-field-status")).toHaveText(
    "Overrides All sizes",
  );
  await expect(
    panel.getByText("Overridden on Phone: Font size."),
  ).toBeVisible();
  await expect(contentHeading).toHaveCSS("font-size", "30px");
});

test("every property group writes its declarations and resets them one by one", async () => {
  const { panel, stylesheet } = await openStyleSite();
  await chooseElementType(panel, "Heading 2");

  await panel
    .getByRole("combobox", { name: "Font", exact: true })
    .selectOption({ label: "Monospace" });
  await setField(panel, "Font size", "32");
  const fontSize = panel.getByRole("textbox", { name: "Font size" });
  await fontSize.press("ArrowUp");
  await expect(fontSize).toHaveValue("33px");
  await fontSize.press("Shift+ArrowUp");
  await expect(fontSize).toHaveValue("43px");
  await panel
    .getByRole("combobox", { name: "Font weight" })
    .selectOption({ label: "Bold" });
  await setField(panel, "Line height", "1.2");
  await setField(panel, "Letter spacing", "0.05");
  await panel
    .getByRole("combobox", { name: "Case" })
    .selectOption({ label: "UPPERCASE" });
  await panel
    .getByRole("radiogroup", { name: "Alignment" })
    .getByText("Centre")
    .click();
  await setField(panel, "Text colour value", "#222222");
  await setField(panel, "Margin top", "12");
  await panel.getByRole("textbox", { name: "Padding left" }).fill("1rem");
  await panel.getByRole("textbox", { name: "Padding left" }).press("Enter");
  await setField(panel, "Max width", "40");
  await panel
    .getByRole("combobox", { name: "Max width unit" })
    .selectOption("rem");
  await setField(panel, "Height", "auto");
  await setField(panel, "Background colour value", "#fafafa");
  await setField(panel, "Border width", "2");
  await panel
    .getByRole("combobox", { name: "Border style" })
    .selectOption({ label: "Dashed" });
  await setField(panel, "Border colour value", "red");
  await setField(panel, "Corner radius", "4");
  await setField(panel, "Opacity", "80");

  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe(
      '[data-part="content"] h2 {\n' +
        "  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace;\n" +
        "  font-size: 43px;\n" +
        "  font-weight: 700;\n" +
        "  line-height: 1.2;\n" +
        "  letter-spacing: 0.05em;\n" +
        "  text-transform: uppercase;\n" +
        "  text-align: center;\n" +
        "  color: #222222;\n" +
        "  margin-top: 12px;\n" +
        "  padding-left: 1rem;\n" +
        "  max-width: 40rem;\n" +
        "  height: auto;\n" +
        "  background-color: #fafafa;\n" +
        "  border-width: 2px;\n" +
        "  border-style: dashed;\n" +
        "  border-color: red;\n" +
        "  border-radius: 4px;\n" +
        "  opacity: 0.8;\n" +
        "}\n",
    );
  await expect(
    panel.getByRole("list", { name: "Spacing styled here" }),
  ).toContainText("Margin top");

  for (const name of [
    "font",
    "font size",
    "font weight",
    "line height",
    "letter spacing",
    "case",
    "alignment",
    "text colour",
    "margin top",
    "padding left",
    "max width",
    "height",
    "background colour",
    "border width",
    "border style",
    "border colour",
    "corner radius",
  ]) {
    await panel
      .getByRole("button", { name: `Reset ${name}`, exact: true })
      .click();
    await expect(
      panel.getByRole("button", { name: `Reset ${name}`, exact: true }),
    ).toBeHidden();
  }
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe('[data-part="content"] h2 {\n  opacity: 0.8;\n}\n');
  await panel
    .getByRole("button", { name: "Reset opacity", exact: true })
    .click();
  await expect.poll(() => stylesheetText(stylesheet)).toBe("");
});

test("edits are surgical: hand-written CSS and comments stay, and emptied rules and media blocks go", async () => {
  const handWritten =
    "/* Brand tweaks, kept by hand */\n" +
    ":root {\n    --accent: #c00; /* keep me */\n}\n\n" +
    "[data-part='content'] h2 { color: red }\n\n" +
    "@media print {\n    h2 { color: black; }\n}\n\n" +
    "@media (max-width: 767.98px) {\n    p { margin: 0; }\n}\n";
  const { panel, stylesheet } = await openStyleSite(handWritten);
  await chooseElementType(panel, "Heading 2");

  await expect(
    panel.getByRole("textbox", { name: "Text colour value" }),
  ).toHaveValue("red");
  await expect(
    panel
      .locator('[data-style-field="text colour"]')
      .getByTestId("style-field-status"),
  ).toHaveText("Set");
  await setField(panel, "Font size", "2");
  await panel
    .getByRole("combobox", { name: "Font size unit" })
    .selectOption("rem");
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe(
      handWritten.replace("{ color: red }", "{ color: red; font-size: 2rem }"),
    );

  await chooseScope(panel, "Phone");
  await setField(panel, "Font size", "1.5");
  await panel
    .getByRole("combobox", { name: "Font size unit" })
    .selectOption("rem");
  const withPhone = handWritten
    .replace("{ color: red }", "{ color: red; font-size: 2rem }")
    .replace(
      "    p { margin: 0; }\n}\n",
      '    p { margin: 0; }\n\n    [data-part="content"] h2 {\n        font-size: 1.5rem;\n    }\n}\n',
    );
  await expect.poll(() => stylesheetText(stylesheet)).toBe(withPhone);

  await chooseScope(panel, "Tablet");
  await setField(panel, "Opacity", "50");
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toContain(
      '@media (max-width: 1023.98px) {\n    [data-part="content"] h2 {\n        opacity: 0.5;\n    }\n}\n\n@media (max-width: 767.98px)',
    );
  await panel.getByRole("button", { name: "Reset opacity" }).click();
  await expect.poll(() => stylesheetText(stylesheet)).toBe(withPhone);

  await chooseScope(panel, "Phone");
  await panel.getByRole("button", { name: "Reset font size" }).click();
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe(
      handWritten.replace("{ color: red }", "{ color: red; font-size: 2rem }"),
    );

  await chooseScope(panel, "All sizes");
  await panel.getByRole("button", { name: "Reset font size" }).click();
  await panel.getByRole("button", { name: "Reset text colour" }).click();
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe(
      handWritten.replace("[data-part='content'] h2 { color: red }\n\n", ""),
    );
});

test("the Style panel won't write while the CSS tab holds an unfinished edit or the file has a mistake", async () => {
  const { window, panel, stylesheet, sitePath } = await openStyleSite(
    "h1 {\n  color: navy;\n}\n",
  );
  await window
    .getByRole("navigation", { name: "Site sections" })
    .getByRole("button", { name: "Custom code", exact: true })
    .click();
  const cssEditor = window.getByRole("textbox", { name: "Custom CSS" });
  await cssEditor.click();
  await window.keyboard.press("ControlOrMeta+End");
  await pasteInto(cssEditor, "p {\n  color: teal;\n");
  await expect(
    window.getByRole("status").filter({ hasText: "Not saved yet" }),
  ).toBeVisible();

  await openStyle(window);
  await expect(
    panel
      .getByRole("alert")
      .filter({ hasText: "Finish the edit in CSS first" }),
  ).toBeVisible();
  await chooseElementType(panel, "Heading 2");
  await setField(panel, "Font size", "30");
  await window.waitForTimeout(500);
  expect(await stylesheetText(stylesheet)).toBe("h1 {\n  color: navy;\n}\n");

  await panel.getByRole("button", { name: "Open CSS" }).click();
  await expect(window.getByRole("tab", { name: "CSS" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await cssEditor.click();
  await window.keyboard.press("ControlOrMeta+End");
  await window.keyboard.type("}");
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe("h1 {\n  color: navy;\n}\np {\n  color: teal;\n}");

  await openStyle(window);
  await expect(
    panel
      .getByRole("alert")
      .filter({ hasText: "Finish the edit in CSS first" }),
  ).toBeHidden();
  await chooseElementType(panel, "Heading 2");
  await setField(panel, "Font size", "30");
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe(
      'h1 {\n  color: navy;\n}\np {\n  color: teal;\n}\n\n[data-part="content"] h2 {\n  font-size: 30px;\n}',
    );

  await window
    .getByRole("navigation", { name: "Site sections" })
    .getByRole("button", { name: "Custom code", exact: true })
    .click();
  await expect(cssEditor).toContainText('[data-part="content"] h2 {');
  await expect(cssEditor).toContainText("font-size: 30px;");

  await writeFile(path.join(sitePath, "custom.css"), "h1 { color: red\n");
  await openStyle(window);
  await expect(
    panel
      .getByRole("alert")
      .filter({ hasText: "Your CSS has a mistake on line 1" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("region", { name: "Styled on this site" }),
  ).toBeHidden();
});

test("colour fields offer the theme's semantic colours and warn when text would be hard to read", async () => {
  const { panel, stylesheet } = await openStyleSite();
  await chooseElementType(panel, "Body text");

  const swatches = panel.getByRole("group", {
    name: "Text colour: your theme's colours",
  });
  await expect(swatches.getByRole("button")).toHaveCount(10);
  await expect(
    swatches.getByRole("button", { name: "Primary", exact: true }),
  ).toHaveCSS("background-color", "rgb(14, 107, 95)");
  await expect(
    swatches.getByRole("button", { name: "Muted", exact: true }),
  ).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await swatches.getByRole("button", { name: "Primary", exact: true }).click();
  await expect(
    swatches.getByRole("button", { name: "Primary", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByText("Your theme’s Primary colour")).toBeVisible();
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe(
      '[data-part="content"] p {\n  color: var(--color-brand-primary);\n}\n',
    );
  const warning = panel.getByText("Hard to read");
  await expect(warning).toBeHidden();

  await setField(panel, "Text colour value", "#eeeeee");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("WCAG AA asks for at least 4.5:1");
  await setField(panel, "Background colour value", "#111111");
  await expect(warning).toBeHidden();
  await panel.getByRole("button", { name: "Reset background colour" }).click();
  await expect(warning).toBeVisible();
  await setField(panel, "Text colour value", "#333333");
  await expect(warning).toBeHidden();
});

test("the overview lists what's styled by target and size, jumps back to it, and resets a target after asking", async () => {
  const existing =
    '[data-part="content"] h2 {\n  font-size: 40px;\n  color: teal;\n}\n\n' +
    ".fancy > p {\n  color: purple;\n}\n\n" +
    '@media (max-width: 1023.98px) {\n  [data-part="hero"] {\n    padding-top: 8px;\n  }\n}\n\n' +
    '@media (max-width: 767.98px) {\n  [data-part="content"] h2 {\n    font-size: 30px;\n  }\n}\n';
  const { frame, panel, stylesheet } = await openStyleSite(existing);
  const overview = panel.getByRole("region", { name: "Styled on this site" });

  await expect(overview.getByRole("listitem")).toHaveCount(3);
  const headings = overview.getByRole("listitem", {
    name: "Every Heading 2 in page content",
  });
  await expect(
    headings.getByRole("button", {
      name: "Every Heading 2 in page content, All sizes: 2 changes",
    }),
  ).toBeVisible();
  await expect(
    overview.getByRole("listitem", { name: "The whole Hero" }),
  ).toContainText("Tablet · 1");
  await expect(
    overview.getByRole("listitem", { name: "Your own selector" }),
  ).toContainText(".fancy > p");

  await headings
    .getByRole("button", {
      name: "Every Heading 2 in page content, Phone: 1 change",
    })
    .click();
  await expect(
    panel.getByRole("radiogroup", { name: "Screen size" }).getByRole("radio", {
      name: "Phone",
    }),
  ).toBeChecked();
  await expect.poll(() => frameWidth(frame)).toBe(375);
  await expect(panel.getByRole("textbox", { name: "Font size" })).toHaveValue(
    "30px",
  );
  await expect(frame.locator("h2[data-fake-highlight]")).toHaveCount(3);

  await panel
    .getByRole("button", { name: "Reset all styles for this target" })
    .click();
  const dialog = panel.page().getByRole("dialog", {
    name: "Reset all styles for this target?",
  });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(await stylesheetText(stylesheet)).toBe(existing);
  await panel
    .getByRole("button", { name: "Reset all styles for this target" })
    .click();
  await dialog.getByRole("button", { name: "Reset all" }).click();
  await expect
    .poll(() => stylesheetText(stylesheet))
    .toBe(
      ".fancy > p {\n  color: purple;\n}\n\n" +
        '@media (max-width: 1023.98px) {\n  [data-part="hero"] {\n    padding-top: 8px;\n  }\n}\n',
    );
  await expect(overview.getByRole("listitem")).toHaveCount(2);
  await expect(
    panel.getByRole("button", { name: "Reset all styles for this target" }),
  ).toBeHidden();
});

test("the preview bridge's errors show as a notice, and clearing them hides it", async () => {
  const { panel, sitePath } = await openStyleSite();
  const errorFile = path.join(sitePath, ".fake-core-runtime-error");
  await writeFile(
    errorFile,
    JSON.stringify({
      message: "Error: The page template exploded",
      file: "child-theme/templates/PageTemplate.tsx",
      line: 2,
    }),
  );
  const notice = panel
    .getByRole("alert")
    .filter({ hasText: "The preview shows an error" });
  await expect(notice).toContainText(
    "The preview shows an error in templates/PageTemplate.tsx on line 2.",
  );
  await notice.getByText("Show the error").click();
  await expect(notice).toContainText("Error: The page template exploded");

  await rm(errorFile);
  await expect(notice).toBeHidden();
});
