import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { cleanupTestArtifacts, createTempDir } from "./helpers.ts";
import { fakeThemeEnv } from "./themeFixtures.ts";

const tinyWebpBase64 = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

const theme = { source: "../theme", version: "local" };

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 4)}\n`;
}

async function createDesignSite(config: unknown): Promise<string> {
  const dir = await createTempDir("nefantaris-design-");
  await writeFile(path.join(dir, "nefantaris.json"), pretty(config));
  await mkdir(path.join(dir, "content", "pages"), { recursive: true });
  await writeFile(
    path.join(dir, "content", "pages", "index.md"),
    "---\ntitle: Home\n---\n\nWelcome.\n",
  );
  await mkdir(path.join(dir, "assets"));
  await writeFile(
    path.join(dir, "assets", "cover.webp"),
    Buffer.from(tinyWebpBase64, "base64"),
  );
  return dir;
}

async function configOf(sitePath: string): Promise<unknown> {
  return JSON.parse(
    await readFile(path.join(sitePath, "nefantaris.json"), "utf8"),
  );
}

async function storedSettingsOf(sitePath: string): Promise<unknown> {
  const config = await configOf(sitePath);
  if (
    typeof config === "object" &&
    config !== null &&
    "theme" in config &&
    typeof config.theme === "object" &&
    config.theme !== null &&
    "settings" in config.theme
  ) {
    return config.theme.settings;
  }
  return undefined;
}

async function openDesign(window: Page): Promise<void> {
  await window.getByRole("button", { name: "Design", exact: true }).click();
  await expect(window.getByRole("heading", { name: "Design" })).toBeVisible();
}

function field(window: Page, label: string): Locator {
  return window.getByRole("group", { name: label, exact: true });
}

test.afterEach(cleanupTestArtifacts);

test("the design panel groups the theme's choices and writes a colour as one value or a light and dark pair", async () => {
  const sitePath = await createDesignSite({ name: "Colour Site", theme });
  const { window } = await openSiteWithFakeCore(sitePath, fakeThemeEnv);
  await openDesign(window);

  await expect(
    window.getByRole("main").getByRole("heading", { level: 2 }),
  ).toHaveText(["Colours", "Typography", "Layout", "Other"]);
  await expect(
    window.getByRole("button", { name: "Design", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  const ink = field(window, "Text colour");
  await expect(ink.getByTestId("setting-status")).toHaveText("Theme default");
  await expect(
    ink.getByRole("checkbox", { name: "Use one colour for both looks" }),
  ).toBeChecked();
  await expect(ink.getByLabel("Text colour code")).toHaveValue("#171717");
  await ink.getByLabel("Text colour code").fill("nope");
  await expect(ink.getByText("Use a colour code like #1d4ed8.")).toBeVisible();
  await ink.getByLabel("Text colour code").fill("#B91C1C");
  await expect
    .poll(() => storedSettingsOf(sitePath))
    .toEqual({
      inkColor: "#B91C1C",
    });
  await expect(ink.getByTestId("setting-status")).toHaveText("Changed");
  await ink.getByLabel("Text colour", { exact: true }).fill("#00ff00");
  await expect
    .poll(() => storedSettingsOf(sitePath))
    .toEqual({
      inkColor: "#00ff00",
    });

  const link = field(window, "Link colour");
  const useOne = link.getByRole("checkbox", {
    name: "Use one colour for both looks",
  });
  await expect(useOne).not.toBeChecked();
  await expect(link.getByLabel("Link colour code, light look")).toHaveValue(
    "#1d4ed8",
  );
  await link.getByLabel("Link colour code, dark look").fill("#5eead4");
  await expect
    .poll(() => storedSettingsOf(sitePath))
    .toEqual({
      inkColor: "#00ff00",
      linkColor: { dark: "#5eead4" },
    });

  await useOne.check();
  await expect(
    link.getByLabel("Link colour code", { exact: true }),
  ).toHaveValue("#1d4ed8");
  await expect
    .poll(() => storedSettingsOf(sitePath))
    .toEqual({
      inkColor: "#00ff00",
      linkColor: "#1d4ed8",
    });
});

test("choices, switches, text, and images write only what differs from the theme's default", async () => {
  const sitePath = await createDesignSite({ name: "Choice Site", theme });
  const { window } = await openSiteWithFakeCore(sitePath, fakeThemeEnv);
  await openDesign(window);

  const font = field(window, "Font");
  await expect(font.getByRole("radio", { name: "System" })).toBeChecked();
  await expect
    .poll(() =>
      font
        .getByText("Serif", { exact: true })
        .evaluate((element) => getComputedStyle(element).fontFamily),
    )
    .toContain("Georgia");
  await font.getByRole("radio", { name: "Serif" }).check();
  await expect
    .poll(() => storedSettingsOf(sitePath))
    .toEqual({ font: "serif" });
  await font.getByRole("radio", { name: "System" }).check();
  await expect
    .poll(() => configOf(sitePath))
    .toEqual({
      name: "Choice Site",
      theme,
    });

  await field(window, "Page width")
    .getByRole("radio", { name: "Wide" })
    .check();
  const footer = window.getByRole("checkbox", {
    name: "List every page in the footer",
  });
  await expect(footer).toBeChecked();
  await footer.uncheck();
  const tagline = field(window, "Tagline").getByRole("textbox");
  await tagline.fill("Made by hand");
  await tagline.blur();

  const logo = field(window, "Logo");
  await expect(logo.getByText("No image chosen")).toBeVisible();
  await logo.getByRole("button", { name: "Choose from your images" }).click();
  const picker = window.getByRole("dialog", { name: "Choose logo" });
  await picker.getByRole("button", { name: "cover.webp" }).click();
  await expect(picker).toBeHidden();
  await expect(logo.getByText("cover.webp")).toBeVisible();

  await expect
    .poll(() => storedSettingsOf(sitePath))
    .toEqual({
      width: "wide",
      showRouteList: false,
      tagline: "Made by hand",
      logo: "/assets/cover.webp",
    });

  await logo.getByRole("button", { name: "Remove logo" }).click();
  await expect
    .poll(() => storedSettingsOf(sitePath))
    .toEqual({
      width: "wide",
      showRouteList: false,
      tagline: "Made by hand",
    });
});

test("each choice resets on its own and reset all clears every saved choice after confirming", async () => {
  const sitePath = await createDesignSite({
    name: "Reset Site",
    theme: {
      ...theme,
      settings: { font: "serif", width: "wide", tagline: "Hi" },
    },
    nav: [],
  });
  const { window } = await openSiteWithFakeCore(sitePath, fakeThemeEnv);
  await openDesign(window);

  const font = field(window, "Font");
  await expect(font.getByTestId("setting-status")).toHaveText("Changed");
  await expect(font.getByRole("radio", { name: "Serif" })).toBeChecked();
  await expect(
    field(window, "Text colour").getByRole("button", { name: /^Reset/ }),
  ).toHaveCount(0);
  await font.getByRole("button", { name: "Reset Font" }).click();
  await expect(font.getByRole("radio", { name: "System" })).toBeChecked();
  await expect(font.getByTestId("setting-status")).toHaveText("Theme default");
  await expect
    .poll(() => storedSettingsOf(sitePath))
    .toEqual({
      width: "wide",
      tagline: "Hi",
    });

  await window.getByRole("button", { name: "Reset all", exact: true }).click();
  const confirm = window.getByRole("dialog", {
    name: "Reset every design choice?",
  });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  expect(await storedSettingsOf(sitePath)).toEqual({
    width: "wide",
    tagline: "Hi",
  });

  await window.getByRole("button", { name: "Reset all", exact: true }).click();
  await confirm.getByRole("button", { name: "Reset all" }).click();
  await expect
    .poll(() => configOf(sitePath))
    .toEqual({
      name: "Reset Site",
      theme,
      nav: [],
    });
  await expect(
    field(window, "Page width").getByRole("radio", { name: "Narrow" }),
  ).toBeChecked();
  await expect(field(window, "Tagline").getByRole("textbox")).toHaveValue("");
  await expect(
    window.getByRole("button", { name: "Reset all", exact: true }),
  ).toBeHidden();
});

test("saved choices the theme doesn't have or won't accept are explained with a way to reset them", async () => {
  const sitePath = await createDesignSite({
    name: "Stale Site",
    theme: {
      ...theme,
      settings: {
        oldColour: "#123456",
        font: "comic",
        linkColor: { light: "#zzz", dark: "#5eead4" },
      },
    },
  });
  const { window } = await openSiteWithFakeCore(sitePath, fakeThemeEnv);
  await openDesign(window);

  const leftovers = window.getByRole("region", {
    name: "Choices your theme doesn’t have",
  });
  await expect(leftovers).toContainText(
    "“oldColour” isn’t a choice your theme offers.",
  );

  const font = field(window, "Font");
  await expect(font).toContainText(
    "The saved choice for Font isn’t one your theme accepts",
  );
  await expect(font.getByTestId("setting-status")).toHaveText("Theme default");
  await expect(font.getByRole("radio", { name: "System" })).toBeChecked();

  const link = field(window, "Link colour");
  await expect(link).toContainText("isn’t one your theme accepts");
  await expect(link.getByLabel("Link colour code, light look")).toHaveValue(
    "#1d4ed8",
  );
  await expect(link.getByLabel("Link colour code, dark look")).toHaveValue(
    "#5eead4",
  );

  await leftovers.getByRole("button", { name: "Reset oldColour" }).click();
  await expect(leftovers).toBeHidden();
  await font.getByRole("button", { name: "Reset Font" }).click();
  await expect(font).not.toContainText("isn’t one your theme accepts");
  await expect
    .poll(() => storedSettingsOf(sitePath))
    .toEqual({
      linkColor: { light: "#zzz", dark: "#5eead4" },
    });
});

test("a theme without design choices, or one that couldn't be read, says so instead of showing a form", async () => {
  const sitePath = await createDesignSite({ name: "Plain Site", theme });
  const plain = await openSiteWithFakeCore(sitePath, {
    FAKE_CORE_SETTINGS: "{}",
  });
  await openDesign(plain.window);
  await expect(
    plain.window.getByText("Your theme doesn’t offer any design choices"),
  ).toBeVisible();
  await expect(plain.window.getByRole("group")).toHaveCount(0);
  await plain.app.close();

  const unreadable = await openSiteWithFakeCore(sitePath, {
    ...fakeThemeEnv,
    FAKE_CORE_INSPECT_BEHAVIOR: "fail",
  });
  await openDesign(unreadable.window);
  await expect(
    unreadable.window.getByText("Your theme couldn’t be read right now"),
  ).toBeVisible();
  await expect(
    unreadable.window.getByRole("button", { name: "Check again" }),
  ).toBeVisible();
  await expect(unreadable.window.getByRole("group")).toHaveCount(0);
});

test("an older site builder without design choices or block forms still works", async () => {
  const sitePath = await createDesignSite({ name: "Older Site", theme });
  const { window } = await openSiteWithFakeCore(sitePath, {
    ...fakeThemeEnv,
    FAKE_CORE_INSPECT_SHAPE: "0.4.5",
  });
  await openDesign(window);
  await expect(
    window.getByText("Your theme doesn’t offer any design choices"),
  ).toBeVisible();

  await window.getByRole("button", { name: "Content", exact: true }).click();
  await window.getByRole("button", { name: "Home", exact: true }).click();
  await window.locator(".cm-line", { hasText: "Welcome." }).click();
  await window.keyboard.press("ControlOrMeta+/");
  const palette = window.getByRole("dialog", { name: "Insert a block" });
  await expect(palette.getByRole("button")).toHaveText([
    "gallery",
    "columns",
    "column",
    "badge",
  ]);
  await palette.getByRole("button", { name: "badge" }).click();
  await expect(window.getByRole("dialog")).toBeHidden();
  await expect
    .poll(() =>
      readFile(path.join(sitePath, "content", "pages", "index.md"), "utf8"),
    )
    .toBe("---\ntitle: Home\n---\n\nWelcome.\n\n:::badge\n\n:::\n");
});

test("light and dark choices come from the looks the theme declares, with a fallback for older builders", async () => {
  const sitePath = await createDesignSite({ name: "Looks Site", theme });
  const env = {
    FAKE_CORE_THEME_MODES: '["light"]',
    FAKE_CORE_DECLARED_MODES: '["light","dark"]',
  };
  const current = await openSiteWithFakeCore(sitePath, env);
  await current.window
    .getByRole("button", { name: "Site settings", exact: true })
    .click();
  const modes = current.window.getByRole("region", { name: "Light and dark" });
  await expect(modes.getByRole("checkbox", { name: "Light" })).toBeChecked();
  await expect(modes.getByRole("checkbox", { name: "Dark" })).toBeChecked();
  await current.app.close();

  const older = await openSiteWithFakeCore(sitePath, {
    ...env,
    FAKE_CORE_INSPECT_SHAPE: "0.4.5",
  });
  await older.window
    .getByRole("button", { name: "Site settings", exact: true })
    .click();
  await expect(
    older.window
      .getByRole("region", { name: "Light and dark" })
      .getByText("Your theme comes in a light look only"),
  ).toBeVisible();
});
