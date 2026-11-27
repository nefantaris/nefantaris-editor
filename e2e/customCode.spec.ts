import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  access,
  appendFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { cleanupTestArtifacts, createTempDir } from "./helpers.ts";

const heroSource =
  'export default function Hero() {\n  return <section data-part="hero">Hero</section>;\n}\n';

const themeFiles: Record<string, string> = {
  "theme.json": JSON.stringify({ name: "fake-theme", contract: 1 }),
  "theme.css":
    "@theme inline {\n  --color-brand-primary: var(--brand-primary);\n}\n\n@layer base {\n  :root {\n    --brand-primary: #0e6b5f;\n    /* --brand-hidden: red; */\n    --brand-radius: 0.375rem;\n  }\n}\n",
  "Layout.tsx":
    'export default function Layout() {\n  return <header data-part="site-header" />;\n}\n',
  "templates/HomeTemplate.tsx":
    "export default function HomeTemplate() {\n  return null;\n}\n",
  "templates/PageTemplate.tsx":
    "export default function PageTemplate() {\n  return null;\n}\n",
  "directives/Hero.tsx": heroSource,
  "components/Prose.tsx":
    "export default function Prose() {\n  return null;\n}\n",
  "fonts/Sans.woff2": "not really a font",
  ".github/workflows/check.yml": "name: check\n",
  "README.md": "# Fake theme\n",
};

const customCodeEnv: Record<string, string> = {
  FAKE_CORE_PARTS: JSON.stringify({
    "site-header": {
      label: "Header",
      description: "The bar across the top of every page.",
    },
    content: { label: "Page content", description: null },
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

type CustomCodeSite = { sitePath: string; themePath: string };

async function createCustomCodeSite(): Promise<CustomCodeSite> {
  const root = await createTempDir("nefantaris-customcode-");
  const themePath = path.join(root, "theme");
  const sitePath = path.join(root, "site");
  for (const [file, text] of Object.entries(themeFiles)) {
    await mkdir(path.dirname(path.join(themePath, file)), { recursive: true });
    await writeFile(path.join(themePath, file), text);
  }
  await mkdir(path.join(sitePath, "content", "pages"), { recursive: true });
  await writeFile(
    path.join(sitePath, "nefantaris.json"),
    `${JSON.stringify(
      {
        name: "Custom Code Site",
        theme: { source: "../theme", version: "local" },
      },
      null,
      4,
    )}\n`,
  );
  await writeFile(
    path.join(sitePath, "content", "pages", "index.md"),
    "---\ntitle: Home\n---\n\nWelcome.\n",
  );
  return { sitePath, themePath };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function textOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function snapshotFolder(folder: string): Promise<Record<string, string>> {
  const entries = await readdir(folder, {
    recursive: true,
    withFileTypes: true,
  });
  const files: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.isFile()) {
      const full = path.join(entry.parentPath, entry.name);
      files[path.relative(folder, full)] = await readFile(full, "utf8");
    }
  }
  return files;
}

async function openCustomCode(window: Page): Promise<void> {
  await window
    .getByRole("navigation", { name: "Site sections" })
    .getByRole("button", { name: "Custom code", exact: true })
    .click();
  await expect(
    window.getByRole("heading", { name: "Custom code", exact: true }),
  ).toBeVisible();
}

async function openComponents(window: Page): Promise<void> {
  await window.getByRole("tab", { name: "Components" }).click();
  await expect(window.getByRole("heading", { name: "Blocks" })).toBeVisible();
}

async function reloadComponents(window: Page): Promise<void> {
  await window.getByRole("tab", { name: "CSS" }).click();
  await openComponents(window);
}

async function pasteInto(editor: Locator, text: string): Promise<void> {
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

async function moveToEnd(window: Page, editor: Locator): Promise<void> {
  await editor.click();
  await window.keyboard.press("ControlOrMeta+End");
}

function completionOption(window: Page, name: RegExp): Locator {
  return window.locator(".cm-tooltip-autocomplete").getByRole("option", {
    name,
  });
}

test.afterEach(cleanupTestArtifacts);

test("custom CSS is created on first edit, autosaves, completes the theme's tokens and parts, and shows notes", async () => {
  const { sitePath } = await createCustomCodeSite();
  const stylesheet = path.join(sitePath, "custom.css");
  const { window } = await openSiteWithFakeCore(sitePath, customCodeEnv);
  await openCustomCode(window);

  await expect(window.getByRole("tab", { name: "CSS" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const editor = window.getByRole("textbox", { name: "Custom CSS" });
  await expect(editor).toBeVisible();
  expect(await exists(stylesheet)).toBe(false);

  await editor.click();
  await pasteInto(editor, ":root {\n  --brand-radius: 0;\n}\n");
  await expect
    .poll(() => textOrNull(stylesheet))
    .toBe(":root {\n  --brand-radius: 0;\n}\n");
  await expect(
    window.getByRole("contentinfo", { name: "Status bar" }),
  ).toContainText("Saved");

  await moveToEnd(window, editor);
  await window.keyboard.type("a { color: var(--brand-pr");
  await expect(
    completionOption(window, /^--color-brand-primaryColour/),
  ).toContainText("Colour");
  await expect(completionOption(window, /^--brand-primary#/)).toContainText(
    "#0e6b5f",
  );
  await expect(completionOption(window, /--brand-hidden/)).toHaveCount(0);
  await completionOption(window, /^--brand-primary#/).click();
  await expect
    .poll(() => textOrNull(stylesheet))
    .toContain("a { color: var(--brand-primary)}");

  await moveToEnd(window, editor);
  await window.keyboard.press("Enter");
  await window.keyboard.type('[data-part="');
  await expect(completionOption(window, /^site-header/)).toContainText(
    "Header",
  );
  await completionOption(window, /^site-header/).click();
  await expect(editor).toContainText('[data-part="site-header"]');
  const unsavedNotice = window
    .getByRole("status")
    .filter({ hasText: "Not saved yet" });
  await expect(unsavedNotice).toHaveText(
    "Not saved yet: finish the rule on line 5",
  );

  await moveToEnd(window, editor);
  await window.keyboard.press("Enter");
  await window.keyboard.type("[con");
  await expect(
    completionOption(window, /^\[data-part="content"\]/),
  ).toContainText("Page content");
  await window.waitForTimeout(150);
  await window.keyboard.press("Enter");
  await expect(editor).toContainText('[data-part="content"]');
  expect(await textOrNull(stylesheet)).not.toContain("data-part");

  await moveToEnd(window, editor);
  await pasteInto(editor, ' {}\n\n[data-part="sidebar"] {\n  color: red;\n}\n');
  await expect
    .poll(() => textOrNull(stylesheet))
    .toContain('\n[data-part="site-header"]\n[data-part="content"] {}\n');
  await expect(unsavedNotice).toBeHidden();
  const notes = window.getByRole("list", { name: "Notes about your CSS" });
  await expect(notes).toContainText(
    'Line 8: [data-part="sidebar"] is not a part',
    { timeout: 10_000 },
  );
  await expect(window.locator(".cm-lintRange-warning")).toHaveCount(1, {
    timeout: 10_000,
  });

  await moveToEnd(window, editor);
  await pasteInto(editor, "b { color red; }\n");
  await expect(window.locator(".cm-lintRange-error").first()).toBeVisible({
    timeout: 10_000,
  });

  await editor.click();
  await window.keyboard.press("ControlOrMeta+a");
  await window.keyboard.press("Backspace");
  await expect.poll(() => exists(stylesheet)).toBe(false);
  await expect(notes).toBeHidden({ timeout: 10_000 });
});

function isUnloadBlocked(window: Page): Promise<boolean> {
  return window.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    globalThis.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

function closeAfterAsking(
  app: ElectronApplication,
  choice: number,
): Promise<{ asked: string[]; isClosing: boolean }> {
  return app.evaluate(({ BrowserWindow, dialog }, answer) => {
    const asked: string[] = [];
    let isClosing = false;
    dialog.showMessageBoxSync = (
      _window: Electron.BaseWindow,
      options: Electron.MessageBoxSyncOptions,
    ) => {
      asked.push(options.message);
      return answer;
    };
    for (const siteWindow of BrowserWindow.getAllWindows()) {
      siteWindow.webContents.emit("will-prevent-unload", {
        preventDefault: () => {
          isClosing = true;
        },
      });
    }
    return { asked, isClosing };
  }, choice);
}

test("unfinished CSS isn't saved until it parses, stays while you look elsewhere, and closing asks first", async () => {
  const { sitePath } = await createCustomCodeSite();
  const stylesheet = path.join(sitePath, "custom.css");
  const finished = ".card {\n  color: red;\n}";
  const { app, window } = await openSiteWithFakeCore(sitePath, customCodeEnv);
  await openCustomCode(window);
  const editor = window.getByRole("textbox", { name: "Custom CSS" });
  const statusBar = window.getByRole("contentinfo", { name: "Status bar" });
  const notice = window.getByRole("status").filter({ hasText: "Not saved" });

  await editor.click();
  await pasteInto(editor, ".card {\n  color: red;\n");
  await expect(notice).toHaveText("Not saved yet: finish the rule on line 2");
  await expect(statusBar).toContainText("Not saved yet");
  await window.waitForTimeout(800);
  expect(await exists(stylesheet)).toBe(false);

  await moveToEnd(window, editor);
  await window.keyboard.type("}");
  await expect.poll(() => textOrNull(stylesheet)).toBe(finished);
  await expect(notice).toBeHidden();
  await expect(statusBar).toContainText("Saved");

  expect(await isUnloadBlocked(window)).toBe(false);
  await window.keyboard.press("Backspace");
  await expect(notice).toHaveText("Not saved yet: finish the rule on line 2");
  expect(await isUnloadBlocked(window)).toBe(true);
  await window.getByRole("tab", { name: "Components" }).click();
  await window.getByRole("tab", { name: "CSS" }).click();
  await expect(notice).toHaveText("Not saved yet: finish the rule on line 2");
  await expect(editor).not.toContainText("}");
  await window
    .getByRole("navigation", { name: "Site sections" })
    .getByRole("button", { name: "Content", exact: true })
    .click();
  await expect(editor).toBeHidden();
  expect(await isUnloadBlocked(window)).toBe(true);
  expect(await textOrNull(stylesheet)).toBe(finished);

  expect(await closeAfterAsking(app, 0)).toEqual({
    asked: ["Your CSS isn't saved yet"],
    isClosing: false,
  });
  expect(await closeAfterAsking(app, 1)).toEqual({
    asked: ["Your CSS isn't saved yet"],
    isClosing: true,
  });

  await openCustomCode(window);
  await expect(editor).toContainText("color: red;");
  await expect(editor).not.toContainText("}");
  await moveToEnd(window, editor);
  await window.keyboard.type("}");
  await expect.poll(() => textOrNull(stylesheet)).toBe(finished);
  await expect(notice).toBeHidden();
  expect(await isUnloadBlocked(window)).toBe(false);
});

test("customizing a component copies it with its sidecar and original, edits it, and resets it", async () => {
  const { sitePath, themePath } = await createCustomCodeSite();
  const themeBefore = await snapshotFolder(themePath);
  const { window } = await openSiteWithFakeCore(sitePath, customCodeEnv);
  await openCustomCode(window);
  await openComponents(window);

  const panel = window.getByRole("tabpanel");
  await expect(panel.getByRole("note")).toContainText(
    "This is code, and a mistake here can break your site.",
  );
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText([
    "Layout",
    "Page templates",
    "Blocks",
    "Other components",
    "Styles",
  ]);
  for (const name of ["Layout", "Home", "Page", "Hero", "Prose"]) {
    await expect(
      panel.getByRole("button", { name: `Customize ${name}`, exact: true }),
    ).toBeVisible();
  }
  await expect(
    panel.getByRole("button", { name: "Customize Theme stylesheet" }),
  ).toBeVisible();
  for (const hidden of ["theme.json", "Sans.woff2", "check.yml", "README"]) {
    await expect(panel).not.toContainText(hidden);
  }

  await panel.getByRole("button", { name: "Customize Hero" }).click();
  await expect(panel.getByRole("heading", { name: "Hero" })).toBeVisible();
  await expect(panel).toContainText("child-theme/directives/Hero.tsx");
  const editor = window.getByRole("textbox", { name: "Hero" });
  await expect(editor).toContainText('data-part="hero"');

  const override = path.join(sitePath, "child-theme", "directives", "Hero.tsx");
  const sidecar = path.join(
    sitePath,
    "child-theme",
    ".nefantaris-overrides.json",
  );
  const original = path.join(
    sitePath,
    "child-theme",
    ".nefantaris-originals",
    "directives",
    "Hero.tsx",
  );
  expect(await readFile(override, "utf8")).toBe(heroSource);
  expect(JSON.parse(await readFile(sidecar, "utf8"))).toEqual({
    "directives/Hero.tsx": {
      themeVersion: "local",
      originalHash: sha256(heroSource),
    },
  });
  expect(await readFile(original, "utf8")).toBe(heroSource);

  await moveToEnd(window, editor);
  await pasteInto(editor, 'export const note = "mine";\n');
  await expect
    .poll(() => textOrNull(override))
    .toBe(`${heroSource}export const note = "mine";\n`);

  await panel.getByRole("button", { name: "All components" }).click();
  await expect(panel.getByRole("button", { name: "Edit Hero" })).toBeVisible();
  await expect(
    panel.getByRole("listitem").filter({ hasText: "directives/Hero.tsx" }),
  ).toContainText("Customized");
  await expect(panel).not.toContainText(".nefantaris");
  await reloadComponents(window);
  await expect(panel).not.toContainText(".nefantaris");
  await expect(panel.getByRole("button", { name: "Edit Hero" })).toBeVisible();

  await panel.getByRole("button", { name: "Edit Hero" }).click();
  await expect(editor).toContainText('export const note = "mine";');
  await panel.getByRole("button", { name: "Reset to theme" }).click();
  const confirm = window.getByRole("dialog", {
    name: "Reset Hero to your theme’s version?",
  });
  await confirm.getByRole("button", { name: "Reset to theme" }).click();
  await expect(
    panel.getByRole("button", { name: "Customize Hero" }),
  ).toBeVisible();
  expect(await exists(override)).toBe(false);
  expect(await exists(sidecar)).toBe(false);
  expect(await exists(original)).toBe(false);
  expect(await exists(path.join(sitePath, "child-theme", "directives"))).toBe(
    false,
  );
  expect(await snapshotFolder(themePath)).toEqual(themeBefore);
});

test("a theme update offers a comparison, then keep mine re-baselines and the theme's version resets", async () => {
  const { sitePath, themePath } = await createCustomCodeSite();
  const { window } = await openSiteWithFakeCore(sitePath, customCodeEnv);
  await openCustomCode(window);
  await openComponents(window);
  const panel = window.getByRole("tabpanel");
  const override = path.join(sitePath, "child-theme", "directives", "Hero.tsx");
  const sidecar = path.join(
    sitePath,
    "child-theme",
    ".nefantaris-overrides.json",
  );
  const original = path.join(
    sitePath,
    "child-theme",
    ".nefantaris-originals",
    "directives",
    "Hero.tsx",
  );
  const themeHero = path.join(themePath, "directives", "Hero.tsx");

  await panel.getByRole("button", { name: "Customize Hero" }).click();
  const editor = window.getByRole("textbox", { name: "Hero" });
  await editor.click();
  await window.keyboard.press("ControlOrMeta+Home");
  await pasteInto(editor, 'export const note = "mine";\n');
  await expect.poll(() => textOrNull(override)).toContain('"mine"');
  await expect(
    panel.getByText("The theme changed this file since you customized it."),
  ).toBeHidden();

  await appendFile(themeHero, "export const themeNew = 1;\n");
  const updatedTheme = `${heroSource}export const themeNew = 1;\n`;
  await panel.getByRole("button", { name: "All components" }).click();
  await reloadComponents(window);
  await expect(
    panel.getByRole("listitem").filter({ hasText: "directives/Hero.tsx" }),
  ).toContainText("Theme changed");
  await panel.getByRole("button", { name: "Edit Hero" }).click();
  await expect(
    panel.getByText("The theme changed this file since you customized it."),
  ).toBeVisible();

  await panel.getByRole("button", { name: "Compare" }).click();
  await expect(
    panel.getByRole("heading", { name: "What changed in Hero" }),
  ).toBeVisible();
  const merge = panel.locator(".cm-mergeView");
  await expect(merge).toContainText("themeNew");
  await expect(merge).toContainText('"mine"');
  await panel.getByRole("button", { name: "What the theme changed" }).click();
  await expect(
    panel.getByRole("button", { name: "What the theme changed" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(merge).not.toContainText('"mine"');
  await expect(merge).toContainText("themeNew");
  await panel
    .getByRole("button", { name: "The theme’s new version and yours" })
    .click();
  await merge
    .getByRole("button", { name: "Use the theme’s version of this part" })
    .last()
    .click();
  await expect
    .poll(() => textOrNull(override))
    .toBe(`export const note = "mine";\n${updatedTheme}`);

  await panel.getByRole("button", { name: "Keep mine" }).click();
  await expect(
    panel.getByText("The theme changed this file since you customized it."),
  ).toBeHidden();
  await expect(window.getByRole("textbox", { name: "Hero" })).toBeVisible();
  await expect
    .poll(async () => JSON.parse((await textOrNull(sidecar)) ?? "{}"))
    .toEqual({
      "directives/Hero.tsx": {
        themeVersion: "local",
        originalHash: sha256(updatedTheme),
      },
    });
  expect(await readFile(original, "utf8")).toBe(updatedTheme);
  expect(await readFile(override, "utf8")).toContain('"mine"');

  await appendFile(themeHero, "export const themeNewer = 2;\n");
  await panel.getByRole("button", { name: "All components" }).click();
  await reloadComponents(window);
  await panel.getByRole("button", { name: "Edit Hero" }).click();
  await panel
    .getByRole("button", { name: "Use the theme’s new version" })
    .click();
  await window
    .getByRole("dialog", { name: "Use the theme’s new version of Hero?" })
    .getByRole("button", { name: "Use the theme’s version" })
    .click();
  await expect(
    panel.getByRole("button", { name: "Customize Hero" }),
  ).toBeVisible();
  expect(await exists(override)).toBe(false);
  expect(await exists(sidecar)).toBe(false);
  expect(await exists(original)).toBe(false);
});

test("the preview's error shows as a notice while a customized component is broken", async () => {
  const { sitePath } = await createCustomCodeSite();
  const { window } = await openSiteWithFakeCore(sitePath, customCodeEnv);
  await window.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    window
      .frameLocator('iframe[title="Site preview"]')
      .locator("#request-path"),
  ).toHaveText("/", { timeout: 20_000 });
  await openCustomCode(window);
  await openComponents(window);
  const panel = window.getByRole("tabpanel");
  await panel.getByRole("button", { name: "Customize Hero" }).click();
  const editor = window.getByRole("textbox", { name: "Hero" });
  await moveToEnd(window, editor);
  await pasteInto(editor, "<<<\n");

  const notice = window
    .getByRole("alert")
    .filter({ hasText: "The preview shows an error" });
  await expect(notice).toContainText(
    "The preview shows an error in directives/Hero.tsx on line 4.",
    { timeout: 10_000 },
  );
  await notice.getByText("Show the error").click();
  await expect(notice).toContainText("Unexpected token");

  await editor.click();
  await window.keyboard.press("ControlOrMeta+z");
  await expect(notice).toBeHidden({ timeout: 10_000 });
});

test("without the preview bridge, an older core's log still shows the error notice", async () => {
  const { sitePath } = await createCustomCodeSite();
  const { window } = await openSiteWithFakeCore(sitePath, {
    ...customCodeEnv,
    FAKE_CORE_NO_BRIDGE: "1",
  });
  await window.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    window
      .frameLocator('iframe[title="Site preview"]')
      .locator("#request-path"),
  ).toHaveText("/", { timeout: 20_000 });
  await openCustomCode(window);
  await openComponents(window);
  const panel = window.getByRole("tabpanel");
  await panel.getByRole("button", { name: "Customize Hero" }).click();
  const editor = window.getByRole("textbox", { name: "Hero" });
  await moveToEnd(window, editor);
  await pasteInto(editor, "<<<\n");

  const notice = window
    .getByRole("alert")
    .filter({ hasText: "The preview shows an error" });
  await expect(notice).toContainText(
    "The preview shows an error in directives/Hero.tsx.",
    { timeout: 10_000 },
  );

  await editor.click();
  await window.keyboard.press("ControlOrMeta+z");
  await expect(notice).toBeHidden({ timeout: 10_000 });
});

test("custom code file operations stay inside the site and never write to the theme", async () => {
  const { sitePath, themePath } = await createCustomCodeSite();
  const themeBefore = await snapshotFolder(themePath);
  const configBefore = await readFile(
    path.join(sitePath, "nefantaris.json"),
    "utf8",
  );
  const { window } = await openSiteWithFakeCore(sitePath, customCodeEnv);
  await openCustomCode(window);
  await openComponents(window);

  const outcomes = await window.evaluate(async (site) => {
    const api = Reflect.get(globalThis, "nefantaris");
    const attempt = async (
      channel: string,
      ...args: string[]
    ): Promise<string> => {
      try {
        return JSON.stringify(await api.invoke(channel, site, ...args));
      } catch {
        return "refused";
      }
    };
    return {
      writeEscape: await attempt("components:write", "../nefantaris.json", "x"),
      writeTheme: await attempt(
        "components:write",
        "../../theme/directives/Hero.tsx",
        "x",
      ),
      readSidecar: await attempt(
        "components:read",
        ".nefantaris-overrides.json",
      ),
      readOriginals: await attempt(
        "components:read",
        ".nefantaris-originals/directives/Hero.tsx",
      ),
      resetAbsolute: await attempt("components:reset", "/etc/hosts"),
      compareParent: await attempt(
        "components:compare",
        "directives/../../nefantaris.json",
      ),
      keepMineBackslash: await attempt(
        "components:keepMine",
        String.raw`directives\..\..\nefantaris.json`,
      ),
      customizeParent: await attempt(
        "components:customize",
        "../theme/directives/Hero.tsx",
      ),
      customizeManifest: await attempt("components:customize", "theme.json"),
      customizeSkipped: await attempt("components:customize", "README.md"),
      writeUncustomized: await attempt(
        "components:write",
        "directives/Hero.tsx",
        "x",
      ),
    };
  }, sitePath);

  expect(outcomes).toEqual({
    writeEscape: "refused",
    writeTheme: "refused",
    readSidecar: "refused",
    readOriginals: "refused",
    resetAbsolute: "refused",
    compareParent: "refused",
    keepMineBackslash: "refused",
    customizeParent: JSON.stringify({
      status: "failed",
      reason: "not-a-theme-file",
    }),
    customizeManifest: JSON.stringify({
      status: "failed",
      reason: "not-a-theme-file",
    }),
    customizeSkipped: JSON.stringify({
      status: "failed",
      reason: "not-a-theme-file",
    }),
    writeUncustomized: JSON.stringify({ status: "missing" }),
  });
  expect(await exists(path.join(sitePath, "child-theme"))).toBe(false);
  expect(await readFile(path.join(sitePath, "nefantaris.json"), "utf8")).toBe(
    configBefore,
  );
  expect(await snapshotFolder(themePath)).toEqual(themeBefore);
});
