import type { FrameLocator, Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { createTempDir } from "./helpers.ts";

export const styleEnv: Record<string, string> = {
  FAKE_CORE_PARTS: JSON.stringify({
    "site-header": { label: "Header", description: null },
    nav: { label: "Navigation", description: null },
    content: { label: "Page content", description: null },
    hero: { label: "Hero", description: null },
  }),
  FAKE_CORE_DIRECTIVE_SCHEMAS: JSON.stringify({
    hero: {
      label: "Hero",
      description: null,
      body: "markdown",
      placeholder: null,
      text: null,
      attributes: {},
    },
  }),
};

const homePage =
  "---\ntitle: Home\n---\n\n:::hero\n## Welcome hero\nLead text.\n:::\n\n" +
  "## About this site\n\nSome paragraph text.\n\n## Second heading\n\n" +
  "Closing words.\n";

const themeStylesheet =
  "@theme inline {\n" +
  "  --font-sans: var(--brand-font-body);\n" +
  "  --color-brand-primary: var(--brand-primary);\n" +
  "  --color-brand-text: var(--brand-text);\n" +
  "  --color-brand-background: var(--brand-background);\n" +
  "  --color-brand-muted: color-mix(\n" +
  "    in oklab,\n" +
  "    var(--brand-text) 68%,\n" +
  "    var(--brand-background)\n" +
  "  );\n" +
  "}\n\n" +
  "@layer base {\n" +
  "  :root {\n" +
  "    --brand-primary: #0e6b5f;\n" +
  "    --brand-text: #1c1a16;\n" +
  "    --brand-background: #faf9f6;\n" +
  '    --brand-font-body: "Open Sans", sans-serif;\n' +
  "  }\n" +
  "}\n";

export type StyleSite = {
  sitePath: string;
  stylesheet: string;
};

export async function createStyleSite(
  customCss: string | null = null,
): Promise<StyleSite> {
  const root = await createTempDir("nefantaris-style-");
  const themePath = path.join(root, "theme");
  const sitePath = path.join(root, "site");
  await mkdir(themePath, { recursive: true });
  await writeFile(
    path.join(themePath, "theme.json"),
    JSON.stringify({ name: "fake-theme", contract: 1 }),
  );
  await writeFile(path.join(themePath, "theme.css"), themeStylesheet);
  await mkdir(path.join(sitePath, "content", "pages"), { recursive: true });
  await writeFile(
    path.join(sitePath, "nefantaris.json"),
    `${JSON.stringify(
      { name: "Style Site", theme: { source: "../theme", version: "local" } },
      null,
      4,
    )}\n`,
  );
  await writeFile(
    path.join(sitePath, "content", "pages", "index.md"),
    homePage,
  );
  const stylesheet = path.join(sitePath, "custom.css");
  if (customCss !== null) {
    await writeFile(stylesheet, customCss);
  }
  return { sitePath, stylesheet };
}

export async function stylesheetText(stylesheet: string): Promise<string> {
  try {
    return await readFile(stylesheet, "utf8");
  } catch {
    return "";
  }
}

export function previewFrame(window: Page): FrameLocator {
  return window.frameLocator('iframe[title="Site preview"]');
}

export function stylePanel(window: Page): Locator {
  return window.locator("#editor");
}

export async function openStyle(
  window: Page,
): Promise<{ frame: FrameLocator; panel: Locator }> {
  await window
    .getByRole("navigation", { name: "Site sections" })
    .getByRole("button", { name: "Style", exact: true })
    .click();
  const panel = stylePanel(window);
  await expect(
    panel.getByRole("heading", { name: "Style", exact: true }),
  ).toBeVisible();
  const frame = previewFrame(window);
  await expect(frame.locator("#request-path")).toHaveText("/", {
    timeout: 20_000,
  });
  await expect(
    panel.getByRole("button", { name: "Pick on the page" }),
  ).toBeEnabled();
  return { frame, panel };
}

export async function openStyleSite(
  customCss: string | null = null,
  extraEnv: Record<string, string> = {},
): Promise<StyleSite & { window: Page; frame: FrameLocator; panel: Locator }> {
  const site = await createStyleSite(customCss);
  const { window } = await openSiteWithFakeCore(site.sitePath, {
    ...styleEnv,
    ...extraEnv,
  });
  const { frame, panel } = await openStyle(window);
  return { ...site, window, frame, panel };
}

export async function chooseElementType(
  panel: Locator,
  label: string,
): Promise<void> {
  await panel
    .getByRole("combobox", { name: "Element type" })
    .selectOption({ label });
}

export async function chooseScope(
  panel: Locator,
  label: "All sizes" | "Tablet" | "Phone",
): Promise<void> {
  await panel
    .getByRole("radiogroup", { name: "Screen size" })
    .getByText(label, { exact: true })
    .click();
  await expect(
    panel
      .getByRole("radiogroup", { name: "Screen size" })
      .getByRole("radio", { name: label }),
  ).toBeChecked();
}

export async function setField(
  panel: Locator,
  name: string,
  value: string,
): Promise<void> {
  const field = panel.getByRole("textbox", { name, exact: true });
  await field.fill(value);
  await field.press("Enter");
}

export async function pasteInto(editor: Locator, text: string): Promise<void> {
  await editor.evaluate((element, value) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", value);
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, text);
}

export function frameWidth(frame: FrameLocator): Promise<number> {
  return frame.locator("html").evaluate(() => globalThis.innerWidth);
}

export async function clickInScaledPreview(
  window: Page,
  target: Locator,
): Promise<void> {
  const shown = await window
    .locator('iframe[title="Site preview"]')
    .boundingBox();
  const inner = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      width: globalThis.innerWidth,
    };
  });
  if (shown === null) {
    throw new Error("The preview is not on screen");
  }
  const scale = shown.width / inner.width;
  await window.mouse.click(
    shown.x + inner.x * scale,
    shown.y + inner.y * scale,
  );
}
