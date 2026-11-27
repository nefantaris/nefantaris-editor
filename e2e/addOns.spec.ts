import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { closeGitServers, createReleasedRepos } from "./gitFixture.ts";
import { cleanupTestArtifacts, createTempDir } from "./helpers.ts";

const DATES = "nefantaris-plugin-date-fns";
const ICONS = "nefantaris-plugin-icons";
const FORMS = "nefantaris-plugin-forms";
const THEME_NOTE =
  "Your theme needs this add-on, so it stays while your site uses this theme.";

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 4)}\n`;
}

async function createAddOnSite(configText: string): Promise<string> {
  const dir = await createTempDir("nefantaris-addons-");
  await writeFile(path.join(dir, "nefantaris.json"), configText);
  await mkdir(path.join(dir, "content", "pages"), { recursive: true });
  await writeFile(
    path.join(dir, "content", "pages", "index.md"),
    "---\ntitle: Home\n---\n\nWelcome.\n",
  );
  return dir;
}

async function openAddOns(window: Page): Promise<void> {
  await window
    .getByRole("navigation", { name: "Site sections" })
    .getByRole("button", { name: "Add-ons", exact: true })
    .click();
  await expect(
    window.getByRole("heading", { name: "Add-ons", exact: true }),
  ).toBeVisible();
}

function card(window: Page, title: string): Locator {
  return window.getByRole("article", { name: title });
}

function statusOf(window: Page, title: string): Locator {
  return card(window, title).getByTestId("add-on-status");
}

async function pluginsOf(sitePath: string): Promise<unknown> {
  const config: unknown = JSON.parse(
    await readFile(path.join(sitePath, "nefantaris.json"), "utf8"),
  );
  return typeof config === "object" && config !== null && "plugins" in config
    ? config.plugins
    : undefined;
}

test.afterEach(async () => {
  await cleanupTestArtifacts();
  await closeGitServers();
});

test("the catalog shows every first-party add-on and which ones are ready", async () => {
  const released = await createReleasedRepos([
    { name: DATES, tags: ["v1.0.0"] },
    { name: FORMS, tags: ["v0.1.0"] },
  ]);
  const sitePath = await createAddOnSite(
    pretty({ name: "Catalog Site", plugins: [] }),
  );
  const { window } = await openSiteWithFakeCore(sitePath, {
    NEFANTARIS_CLONE_BASE: released.urlBase,
  });
  await openAddOns(window);

  await expect(
    window.getByRole("main").getByRole("heading", { level: 3 }),
  ).toHaveText(["Dates", "Icons", "Contact form"]);
  await expect(statusOf(window, "Dates")).toHaveText("Available");
  await expect(
    card(window, "Dates").getByRole("button", { name: "Add Dates" }),
  ).toBeEnabled();
  await expect(card(window, "Dates")).toContainText(
    "Date formatting your theme can use.",
  );

  await expect(statusOf(window, "Icons")).toHaveText("Coming soon", {
    timeout: 20_000,
  });
  await expect(
    card(window, "Icons").getByRole("button", { name: /^Add/ }),
  ).toHaveCount(0);
  await expect(statusOf(window, "Contact form")).toHaveText("Coming soon");
  await expect(
    card(window, "Contact form").getByRole("button", { name: /^Add/ }),
  ).toHaveCount(0);
  await expect(card(window, "Contact form")).toContainText(
    "Not ready to add yet.",
  );
  await expect(
    card(window, "Contact form").getByRole("button", {
      name: "Learn more about Contact form",
    }),
  ).toBeVisible();

  await expect(window.getByRole("alert")).toHaveCount(0);
  await expect(
    window.getByRole("region", { name: "Other add-ons" }),
  ).toHaveCount(0);
  expect(await pluginsOf(sitePath)).toEqual([]);
});

test("adding pins the newest release or latest version, and removing asks first", async () => {
  const released = await createReleasedRepos([
    { name: DATES, tags: ["v0.9.0", "v1.0.0"] },
    { name: ICONS, tags: [] },
  ]);
  const sitePath = await createAddOnSite(
    pretty({ name: "Pinning Site", plugins: [] }),
  );
  const { window } = await openSiteWithFakeCore(sitePath, {
    NEFANTARIS_CLONE_BASE: released.urlBase,
  });
  await openAddOns(window);

  await card(window, "Dates")
    .getByRole("button", { name: "Add Dates" })
    .click();
  await expect(statusOf(window, "Dates")).toHaveText("Added", {
    timeout: 20_000,
  });
  await expect(card(window, "Dates")).toContainText("Version v1.0.0");
  expect(await pluginsOf(sitePath)).toEqual([
    { name: DATES, source: `${released.urlBase}/${DATES}`, version: "v1.0.0" },
  ]);

  await expect(statusOf(window, "Icons")).toHaveText("Available", {
    timeout: 20_000,
  });
  await card(window, "Icons")
    .getByRole("button", { name: "Add Icons" })
    .click();
  await expect(statusOf(window, "Icons")).toHaveText("Added", {
    timeout: 20_000,
  });
  const iconsHead = await released.headOidFor(ICONS);
  await expect(card(window, "Icons")).toContainText(
    `Version ${iconsHead.slice(0, 7)}`,
  );

  await card(window, "Dates")
    .getByRole("button", { name: "Remove Dates" })
    .click();
  const dialog = window.getByRole("dialog", { name: "Remove “Dates”?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(statusOf(window, "Dates")).toHaveText("Added");

  await card(window, "Dates")
    .getByRole("button", { name: "Remove Dates" })
    .click();
  await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(statusOf(window, "Dates")).toHaveText("Available");
  expect(await pluginsOf(sitePath)).toEqual([
    { name: ICONS, source: `${released.urlBase}/${ICONS}`, version: iconsHead },
  ]);
});

test("an add-on the theme needs can't be removed, and older builders fall back to the plain list", async () => {
  const released = await createReleasedRepos([]);
  const original = pretty({
    name: "Theme Needs Site",
    plugins: [
      {
        name: DATES,
        source: `https://github.com/nefantaris/${DATES}`,
        version: "v1.0.0",
      },
      "nefantaris-plugin-custom",
      "nefantaris-plugin-theme-extra",
    ],
  });
  const sitePath = await createAddOnSite(original);
  const env = {
    NEFANTARIS_CLONE_BASE: released.urlBase,
    FAKE_CORE_THEME_REQUIRES: JSON.stringify([
      DATES,
      "nefantaris-plugin-theme-extra",
    ]),
  };
  const current = await openSiteWithFakeCore(sitePath, env);
  await openAddOns(current.window);

  await expect(statusOf(current.window, "Dates")).toHaveText(
    "Needed by your theme",
  );
  const removeDates = card(current.window, "Dates").getByRole("button", {
    name: "Remove Dates",
  });
  await expect(removeDates).toBeDisabled();
  await expect(removeDates).toHaveAccessibleDescription(THEME_NOTE);

  const others = current.window.getByRole("region", { name: "Other add-ons" });
  await expect(others.getByRole("listitem")).toHaveText([
    /nefantaris-plugin-custom/,
    /nefantaris-plugin-theme-extra/,
  ]);
  await expect(
    others.getByRole("button", { name: "Remove nefantaris-plugin-custom" }),
  ).toBeEnabled();
  await expect(
    others.getByRole("button", {
      name: "Remove nefantaris-plugin-theme-extra",
    }),
  ).toBeDisabled();
  await current.app.close();

  const older = await openSiteWithFakeCore(sitePath, {
    ...env,
    FAKE_CORE_INSPECT_SHAPE: "0.4.5",
  });
  await openAddOns(older.window);
  await expect(statusOf(older.window, "Dates")).toHaveText("Added");
  await card(older.window, "Dates")
    .getByRole("button", { name: "Remove Dates" })
    .click();
  const dialog = older.window.getByRole("dialog");
  await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    `“${DATES}” couldn't be removed:`,
    { timeout: 20_000 },
  );
  await expect(dialog.getByRole("alert")).toContainText(
    `requires the plugin "${DATES}"`,
  );
  expect(await readFile(path.join(sitePath, "nefantaris.json"), "utf8")).toBe(
    original,
  );
});

test("advanced users can add an add-on from its address", async () => {
  const released = await createReleasedRepos([
    { name: "nefantaris-plugin-extra", tags: ["v1.2.0"] },
  ]);
  const sitePath = await createAddOnSite(
    pretty({ name: "Address Site", plugins: [DATES] }),
  );
  const { window } = await openSiteWithFakeCore(sitePath, {
    NEFANTARIS_CLONE_BASE: released.urlBase,
  });
  await openAddOns(window);
  await expect(statusOf(window, "Dates")).toHaveText("Added");

  await window.getByRole("button", { name: "Add from an address" }).click();
  const dialog = window.getByRole("dialog", { name: "Add from an address" });
  await dialog
    .getByLabel("Add-on address")
    .fill(`  ${released.urlBase}/nefantaris-plugin-extra/  `);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });

  const others = window.getByRole("region", { name: "Other add-ons" });
  await expect(others.getByRole("listitem")).toHaveText([
    /nefantaris-plugin-extra\s*Version v1\.2\.0/,
  ]);
  expect(await pluginsOf(sitePath)).toEqual([
    DATES,
    {
      name: "nefantaris-plugin-extra",
      source: `${released.urlBase}/nefantaris-plugin-extra`,
      version: "v1.2.0",
    },
  ]);
});

test("add-on failures are explained in plain words and change nothing", async () => {
  const released = await createReleasedRepos([
    { name: DATES, tags: ["v1.0.0"] },
    { name: "nefantaris-plugin-extra", tags: ["v1.2.0"] },
  ]);
  const original = pretty({
    name: "Failing Site",
    plugins: ["nefantaris-plugin-custom"],
  });
  const sitePath = await createAddOnSite(original);
  const { window } = await openSiteWithFakeCore(sitePath, {
    NEFANTARIS_CLONE_BASE: released.urlBase,
    FAKE_CORE_PLUGINS_BEHAVIOR: "fail",
  });
  await openAddOns(window);

  await card(window, "Dates")
    .getByRole("button", { name: "Add Dates" })
    .click();
  await expect(card(window, "Dates").getByRole("alert")).toHaveText(
    `“${DATES}” couldn't be added: fake core: the add-on's settings file is missing`,
    { timeout: 20_000 },
  );
  await expect(statusOf(window, "Dates")).toHaveText("Available");

  await window.getByRole("button", { name: "Add from an address" }).click();
  const dialog = window.getByRole("dialog", { name: "Add from an address" });
  const addressField = dialog.getByLabel("Add-on address");
  const addButton = dialog.getByRole("button", { name: "Add", exact: true });

  await addButton.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Paste the add-on's web address.",
  );

  await addressField.fill("not an address!");
  await addButton.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Type the add-on's web address, like https://github.com/someone/nefantaris-plugin-name, or the name of one of ours.",
  );

  await addressField.fill(`${released.urlBase}/nefantaris-plugin-custom`);
  await addButton.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "“nefantaris-plugin-custom” is already part of your site.",
  );

  await addressField.fill(`${released.urlBase}/nefantaris-plugin-nope`);
  await addButton.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Nothing could be downloaded from that address. Check it and try again.",
    { timeout: 20_000 },
  );

  await addressField.fill("nefantaris-plugin-nope");
  await addButton.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "There's no add-on called “nefantaris-plugin-nope” that can be downloaded. Check the name and try again.",
    { timeout: 20_000 },
  );

  await addressField.fill(`${released.urlBase}/nefantaris-plugin-extra`);
  await addButton.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "“nefantaris-plugin-extra” couldn't be added: fake core: the add-on's settings file is missing",
    { timeout: 20_000 },
  );
  expect(await readFile(path.join(sitePath, "nefantaris.json"), "utf8")).toBe(
    original,
  );
});
