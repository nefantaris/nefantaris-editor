import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tinyWebpBase64 } from "./editorTestSite.ts";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { closeGitServers, createReleasedRepos } from "./gitFixture.ts";
import { cleanupTestArtifacts, createTempDir } from "./helpers.ts";
import {
  FORMS,
  formsPluginDetails,
  pluginBlockSchemas,
} from "./pluginFixtures.ts";

const DATES = "nefantaris-plugin-date-fns";
const CUSTOM = "nefantaris-plugin-custom";

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 4)}\n`;
}

async function createSettingsSite(plugins: unknown[]): Promise<string> {
  const dir = await createTempDir("nefantaris-addon-settings-");
  await writeFile(
    path.join(dir, "nefantaris.json"),
    pretty({ name: "Add-on Settings Site", plugins }),
  );
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

async function settingsEnv(
  details: Record<string, unknown>,
): Promise<Record<string, string>> {
  const released = await createReleasedRepos([]);
  return {
    NEFANTARIS_CLONE_BASE: released.urlBase,
    FAKE_CORE_PLUGIN_DETAILS: JSON.stringify(details),
    FAKE_CORE_DIRECTIVE_SCHEMAS: JSON.stringify(pluginBlockSchemas),
  };
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

function field(window: Page, label: string): Locator {
  return window.getByRole("group", { name: label, exact: true });
}

async function pluginsOf(sitePath: string): Promise<unknown> {
  const config: unknown = JSON.parse(
    await readFile(path.join(sitePath, "nefantaris.json"), "utf8"),
  );
  return typeof config === "object" && config !== null && "plugins" in config
    ? config.plugins
    : undefined;
}

async function loggedCommands(logPath: string): Promise<unknown[]> {
  const text = await readFile(logPath, "utf8");
  return text
    .split("\n")
    .filter((line) => line !== "")
    .map((line): unknown => JSON.parse(line));
}

test.afterEach(async () => {
  await cleanupTestArtifacts();
  await closeGitServers();
});

test("an added add-on lists what it adds and its settings form writes every field type through set and unset", async () => {
  const sitePath = await createSettingsSite([FORMS]);
  const logPath = path.join(await createTempDir("nefantaris-log-"), "log");
  await writeFile(logPath, "");
  const { window } = await openSiteWithFakeCore(sitePath, {
    ...(await settingsEnv(formsPluginDetails)),
    FAKE_CORE_COMMAND_LOG: logPath,
  });
  await openAddOns(window);

  const forms = card(window, "Contact form");
  await expect(forms.getByTestId("add-on-status")).toHaveText("Added");
  const adds = forms.getByRole("list", { name: "What Contact form adds" });
  await expect(adds.getByRole("listitem")).toHaveText([
    "Adds a block for your pages: Contact form",
    "Receives requests at /api/forms/submit",
    "Loads a script from challenges.cloudflare.com on every page while “Turnstile site key” is filled inOff",
  ]);

  await forms
    .getByRole("button", { name: "Settings for Contact form" })
    .click();
  await expect(
    window.getByRole("heading", { name: "Contact form", level: 1 }),
  ).toBeVisible();
  const siteKey = field(window, "Turnstile site key");
  await expect(siteKey.getByTestId("setting-status")).toHaveText(
    "Add-on default",
  );
  await expect(siteKey).toContainText(
    "Turns on Cloudflare Turnstile for every form.",
  );

  await siteKey.getByRole("textbox").fill("0x4AAAexample");
  await siteKey.getByRole("textbox").blur();
  await expect
    .poll(() => pluginsOf(sitePath))
    .toEqual([
      { name: FORMS, settings: { turnstileSiteKey: "0x4AAAexample" } },
    ]);
  await expect(siteKey.getByTestId("setting-status")).toHaveText("Changed");
  await expect(
    window
      .getByRole("list", { name: "What Contact form adds" })
      .getByRole("listitem")
      .filter({ hasText: "challenges.cloudflare.com" }),
  ).toContainText("On");

  await field(window, "Tone").getByRole("radio", { name: "Brisk" }).check();
  await window.getByRole("checkbox", { name: "Show field labels" }).uncheck();
  await field(window, "Accent colour")
    .getByLabel("Accent colour code")
    .fill("#b91c1c");
  const badge = field(window, "Badge");
  await badge.getByRole("button", { name: "Choose from your images" }).click();
  await window
    .getByRole("dialog", { name: "Choose badge" })
    .getByRole("button", { name: "cover.webp" })
    .click();
  await expect
    .poll(() => pluginsOf(sitePath))
    .toEqual([
      {
        name: FORMS,
        settings: {
          turnstileSiteKey: "0x4AAAexample",
          tone: "brisk",
          showLabels: false,
          accent: "#b91c1c",
          badge: "/assets/cover.webp",
        },
      },
    ]);

  await badge.getByRole("button", { name: "Remove badge" }).click();
  for (const label of [
    "Turnstile site key",
    "Tone",
    "Show field labels",
    "Accent colour",
  ]) {
    await field(window, label)
      .getByRole("button", { name: `Reset ${label}` })
      .click();
  }
  await expect.poll(() => pluginsOf(sitePath)).toEqual([FORMS]);
  await expect(
    field(window, "Tone").getByRole("radio", { name: "Warm" }),
  ).toBeChecked();
  await expect(
    window.getByRole("checkbox", { name: "Show field labels" }),
  ).toBeChecked();

  expect(await loggedCommands(logPath)).toEqual([
    ["set", FORMS, "turnstileSiteKey", "0x4AAAexample"],
    ["set", FORMS, "tone", "brisk"],
    ["set", FORMS, "showLabels", "false"],
    ["set", FORMS, "accent", "#b91c1c"],
    ["set", FORMS, "badge", "/assets/cover.webp"],
    ["unset", FORMS, "badge"],
    ["unset", FORMS, "turnstileSiteKey"],
    ["unset", FORMS, "tone"],
    ["unset", FORMS, "showLabels"],
    ["unset", FORMS, "accent"],
  ]);

  await window.getByRole("button", { name: "All add-ons" }).click();
  await expect(
    window.getByRole("heading", { name: "Add-ons", exact: true }),
  ).toBeVisible();
});

test("a setting core refuses is explained and the form goes back to what is saved", async () => {
  const sitePath = await createSettingsSite([
    { name: FORMS, settings: { tone: "brisk" } },
  ]);
  const { window } = await openSiteWithFakeCore(sitePath, {
    ...(await settingsEnv(formsPluginDetails)),
    FAKE_CORE_PLUGINS_BEHAVIOR: "fail",
  });
  await openAddOns(window);
  await card(window, "Contact form")
    .getByRole("button", { name: "Settings for Contact form" })
    .click();

  const tone = field(window, "Tone");
  await expect(tone.getByRole("radio", { name: "Brisk" })).toBeChecked();
  await tone.getByRole("button", { name: "Reset Tone" }).click();
  await expect(
    window.getByRole("alert").filter({ hasText: "That setting" }),
  ).toHaveText(
    "That setting couldn't be saved: fake core: the add-on's settings file is missing",
    { timeout: 20_000 },
  );
  await expect(tone.getByRole("radio", { name: "Brisk" })).toBeChecked();
  expect(await pluginsOf(sitePath)).toEqual([
    { name: FORMS, settings: { tone: "brisk" } },
  ]);
});

test("an add-on that couldn't be loaded shows why, next to it", async () => {
  const sitePath = await createSettingsSite([DATES, CUSTOM]);
  const { window } = await openSiteWithFakeCore(
    sitePath,
    await settingsEnv({
      [DATES]: {
        error: `Plugin "${DATES}" could not be found. Tried: plugins/${DATES}`,
      },
      [CUSTOM]: { error: `${CUSTOM}/plugin.json: "contract" must be 1` },
    }),
  );
  await openAddOns(window);

  await expect(card(window, "Dates").getByRole("alert")).toHaveText(
    `This add-on couldn’t be loaded: Plugin "${DATES}" could not be found. Tried: plugins/${DATES}`,
  );
  await expect(
    card(window, "Dates").getByRole("button", { name: /^Settings/ }),
  ).toHaveCount(0);
  const others = window.getByRole("region", { name: "Other add-ons" });
  await expect(others.getByRole("alert")).toHaveText(
    `This add-on couldn’t be loaded: ${CUSTOM}/plugin.json: "contract" must be 1`,
  );
  await expect(others.getByRole("button", { name: /^Settings/ })).toHaveCount(
    0,
  );
});

test("an add-on with page addresses explains secrets and edits the preview's .dev.vars", async () => {
  const sitePath = await createSettingsSite([FORMS]);
  const devVarsPath = path.join(sitePath, ".dev.vars");
  const gitignorePath = path.join(sitePath, ".gitignore");
  await writeFile(gitignorePath, ".nefantaris/\ndist/\n");
  await writeFile(devVarsPath, "# For the preview only\nEXISTING=abc123\n");
  const { window } = await openSiteWithFakeCore(
    sitePath,
    await settingsEnv(formsPluginDetails),
  );
  await openAddOns(window);
  await card(window, "Contact form")
    .getByRole("button", { name: "Settings for Contact form" })
    .click();

  const secrets = window.getByRole("region", {
    name: "Keep secrets out of your site",
  });
  await expect(secrets).toContainText(
    "add them as environment variables in your Cloudflare Pages project.",
  );
  await expect(secrets.getByRole("alert")).toContainText(
    "Your site’s .gitignore doesn’t list .dev.vars.",
  );
  await secrets
    .getByRole("button", { name: "Add .dev.vars to .gitignore" })
    .click();
  await expect(secrets.getByRole("alert")).toHaveCount(0);
  expect(await readFile(gitignorePath, "utf8")).toBe(
    ".nefantaris/\ndist/\n.dev.vars\n",
  );

  const rows = secrets
    .getByRole("list", { name: "Secrets for the preview" })
    .getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByLabel("Secret name")).toHaveValue("EXISTING");
  const existingValue = rows.first().getByLabel("Secret value");
  await expect(existingValue).toHaveValue("abc123");
  await expect(existingValue).toHaveAttribute("type", "password");
  await rows
    .first()
    .getByRole("button", { name: "Show the value of EXISTING" })
    .click();
  await expect(existingValue).toHaveAttribute("type", "text");

  await secrets.getByRole("button", { name: "Add a secret" }).click();
  const added = rows.nth(1);
  await expect(added.getByLabel("Secret name")).toBeFocused();
  await added.getByLabel("Secret name").fill("1BAD");
  await added
    .getByLabel("Secret value")
    .fill("https://hooks.slack.com/services/T0/B0#x");
  await expect(added).toContainText(
    "Use only letters, numbers, and _, and don’t start with a number.",
  );
  await window.waitForTimeout(800);
  expect(await readFile(devVarsPath, "utf8")).toBe(
    "# For the preview only\nEXISTING=abc123\n",
  );

  await added.getByLabel("Secret name").fill("SLACK_WEBHOOK");
  await expect
    .poll(() => readFile(devVarsPath, "utf8"))
    .toBe(
      "# For the preview only\nEXISTING=abc123\nSLACK_WEBHOOK='https://hooks.slack.com/services/T0/B0#x'\n",
    );

  await rows.first().getByRole("button", { name: "Remove EXISTING" }).click();
  await expect
    .poll(() => readFile(devVarsPath, "utf8"))
    .toBe(
      "# For the preview only\nSLACK_WEBHOOK='https://hooks.slack.com/services/T0/B0#x'\n",
    );
});
