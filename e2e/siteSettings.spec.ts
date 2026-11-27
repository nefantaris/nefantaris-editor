import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createFakeCore } from "./fakeCore.ts";
import { closeGitServers } from "./gitFixture.ts";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

const tinyWebpBase64 = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
const pngExtension = "png";
const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const contentFiles: Record<string, string> = {
  "pages/index.md": "---\ntitle: Home\n---\n\nWelcome.\n",
  "pages/about.md": "---\ntitle: About\n---\n\nAbout us.\n",
  "pages/contact.md": "---\ntitle: Contact\nslug: reach-us\n---\n\nWrite.\n",
  "pages/secret.md": "---\ntitle: Secret\ndraft: true\n---\n\nHidden.\n",
  "posts/hello-world.md":
    "---\ntitle: Hello World\ndate: 2026-01-05\n---\n\nHi.\n",
};

type OpenedSite = {
  app: ElectronApplication;
  window: Page;
  userDataDir: string;
};

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 4)}\n`;
}

async function createSettingsSite(configText: string): Promise<string> {
  const dir = await createTempDir("nefantaris-settings-");
  await writeFile(path.join(dir, "nefantaris.json"), configText);
  for (const [relativePath, text] of Object.entries(contentFiles)) {
    const filePath = path.join(dir, "content", relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, text);
  }
  await mkdir(path.join(dir, "assets", "photos"), { recursive: true });
  const webp = Buffer.from(tinyWebpBase64, "base64");
  await writeFile(path.join(dir, "assets", "cover.webp"), webp);
  await writeFile(path.join(dir, "assets", "photos", "beach.webp"), webp);
  await writeFile(path.join(dir, "assets", ".gitkeep"), "");
  return dir;
}

async function openSite(
  sitePath: string,
  extraEnv: Record<string, string> = {},
): Promise<OpenedSite> {
  const fakeCoreDir = await createFakeCore();
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const app = await launchEditor(userDataDir, {
    NEFANTARIS_CORE_DIR: fakeCoreDir,
    ...extraEnv,
  });
  const welcome = await app.firstWindow();
  await stubDirectoryPicker(app, sitePath);
  const siteWindowPromise = app.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  const window = await siteWindowPromise;
  return { app, window, userDataDir };
}

async function openSettings(window: Page): Promise<void> {
  await window
    .getByRole("button", { name: "Site settings", exact: true })
    .click();
  await expect(
    window.getByRole("heading", { name: "Site settings" }),
  ).toBeVisible();
  await expect(window.getByLabel("Site name")).not.toHaveValue("");
}

function configOf(sitePath: string): Promise<string> {
  return readFile(path.join(sitePath, "nefantaris.json"), "utf8");
}

function section(window: Page, name: string): Locator {
  return window.getByRole("region", { name });
}

function navLink(window: Page, position: string): Locator {
  return section(window, "Navigation").getByRole("group", {
    name: `Link ${position}`,
    exact: true,
  });
}

test.afterEach(async () => {
  await cleanupTestArtifacts();
  await closeGitServers();
});

test("site settings replace the editor pane while the preview stays open", async () => {
  const sitePath = await createSettingsSite(pretty({ name: "Pane Site" }));
  const { window } = await openSite(sitePath);

  await window.getByRole("button", { name: "About", exact: true }).click();
  await expect(window.locator(".cm-content")).toBeVisible();
  await window.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = window.locator('iframe[title="Site preview"]');
  await expect(preview).toBeVisible({ timeout: 20_000 });

  await openSettings(window);
  await expect(window.locator(".cm-content")).toBeHidden();
  await expect(preview).toBeVisible();
  await expect(
    window.getByRole("button", { name: "Site settings", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    window.getByRole("complementary", { name: "Site content" }),
  ).toBeHidden();
  await expect(section(window, "Add-ons")).toHaveCount(0);

  await window.getByRole("button", { name: "Content", exact: true }).click();
  await window.getByRole("button", { name: "Home", exact: true }).click();
  await expect(
    window.getByRole("heading", { name: "Site settings" }),
  ).toBeHidden();
  await expect(
    window.locator(".cm-line", { hasText: "Welcome." }),
  ).toBeVisible();
  await expect(preview).toBeVisible();
});

test("renaming the site changes only the name and keeps unknown keys and formatting", async () => {
  const original =
    '{\n  "name": "Old Name",\n  "theme": { "source": "../theme", "version": "local" },\n' +
    '  "nav": [{ "label": "Home", "href": "/" }],\n  "custom": {"keep":  [1,2]}\n}\n';
  const sitePath = await createSettingsSite(original);
  const { window, userDataDir } = await openSite(sitePath);
  await openSettings(window);

  const nameField = window.getByLabel("Site name");
  await expect(nameField).toHaveValue("Old Name");
  await nameField.fill("");
  await expect(window.getByText("Your site needs a name.")).toBeVisible();
  await nameField.fill("Brand New Name");

  await expect
    .poll(() => configOf(sitePath))
    .toBe(original.replace('"Old Name"', '"Brand New Name"'));
  await expect(window.getByTestId("site-name")).toHaveText("Brand New Name");
  await expect
    .poll(() => readFile(path.join(userDataDir, "recent-sites.json"), "utf8"))
    .toContain("Brand New Name");
});

test("the site address and language are checked, stored in standard form, and cleared when emptied", async () => {
  const original = '{\n\t"name": "Tabbed",\n\t"custom": [1, 2, 3]\n}';
  const sitePath = await createSettingsSite(original);
  const { window } = await openSite(sitePath);
  await openSettings(window);

  const addressField = window.getByLabel("Site address");
  await addressField.fill("example.com");
  await expect(
    window.getByText("Start with https://, like https://example.com."),
  ).toBeVisible();
  await addressField.fill("https://example.com/blog");
  await expect(
    window.getByText("Use only the start of the address"),
  ).toBeVisible();
  expect(await configOf(sitePath)).toBe(original);

  await addressField.fill("https://Example.com/");
  const languageField = window.getByLabel("Language");
  await languageField.fill("not a language!");
  await expect(window.getByText("That isn't a language code.")).toBeVisible();
  await languageField.fill("pt-br");
  await languageField.blur();

  await expect
    .poll(() => configOf(sitePath))
    .toBe(
      '{\n\t"name": "Tabbed",\n\t"custom": [1, 2, 3],\n\t"url": "https://example.com",\n\t"lang": "pt-BR"\n}',
    );
  await expect(addressField).toHaveValue("https://example.com");
  await expect(languageField).toHaveValue("pt-BR");

  await addressField.fill("");
  await addressField.blur();
  await expect
    .poll(() => configOf(sitePath))
    .toBe(
      '{\n\t"name": "Tabbed",\n\t"custom": [1, 2, 3],\n\t"lang": "pt-BR"\n}',
    );
});

test("navigation links can be added, pointed at pages, reordered by keyboard, nested, and removed", async () => {
  const base = {
    name: "Nav Site",
    theme: { source: "../theme", version: "local" },
    nav: [
      { label: "Home", href: "/" },
      { label: "Blog", href: "/blog" },
      { label: "About", href: "/about" },
    ],
    custom: { keep: true },
  };
  const sitePath = await createSettingsSite(pretty(base));
  const { window } = await openSite(sitePath);
  await openSettings(window);

  await expect(navLink(window, "3").getByLabel("Links to")).toHaveValue(
    "route:/about",
  );
  await expect(
    navLink(window, "1").getByLabel("Links to").locator("option", {
      hasText: "Secret",
    }),
  ).toHaveCount(0);

  const moveAboutUp = window.getByRole("button", { name: "Move About up" });
  await moveAboutUp.focus();
  await window.keyboard.press("Enter");
  await expect(moveAboutUp).toBeFocused();
  await window.keyboard.press("Enter");
  await expect(
    window.getByRole("button", { name: "Move About down" }),
  ).toBeFocused();
  await expect
    .poll(async () => JSON.parse(await configOf(sitePath)).nav)
    .toEqual([
      { label: "About", href: "/about" },
      { label: "Home", href: "/" },
      { label: "Blog", href: "/blog" },
    ]);

  await window.getByRole("button", { name: "Add a link", exact: true }).click();
  const added = navLink(window, "4");
  await expect(added.getByLabel("Label", { exact: true })).toBeFocused();
  await window.keyboard.type("Contact");
  await added
    .getByLabel("Links to")
    .selectOption({ label: "Contact (/reach-us)" });

  await window.getByRole("button", { name: "Add a link under Blog" }).click();
  const child = navLink(window, "3.1");
  await expect(child.getByLabel("Label", { exact: true })).toBeFocused();
  await window.keyboard.type("First post");
  await child
    .getByLabel("Links to")
    .selectOption({ label: "Hello World (/blog/hello-world)" });

  await window.getByRole("button", { name: "Remove Home" }).click();

  await expect
    .poll(() => configOf(sitePath))
    .toBe(
      pretty({
        ...base,
        nav: [
          { label: "About", href: "/about" },
          {
            label: "Blog",
            href: "/blog",
            children: [{ label: "First post", href: "/blog/hello-world" }],
          },
          { label: "Contact", href: "/reach-us" },
        ],
      }),
    );

  await window.getByRole("button", { name: "Remove First post" }).click();
  await navLink(window, "1").getByLabel("Links to").selectOption({
    label: "Another address…",
  });
  const address = navLink(window, "1").getByLabel("Address");
  await address.fill("ftp:nope");
  await expect(
    window.getByText("Start with https:// for another website"),
  ).toBeVisible();
  await address.fill("https://example.org/about");
  await address.blur();

  await expect
    .poll(() => configOf(sitePath))
    .toBe(
      pretty({
        ...base,
        nav: [
          { label: "About", href: "https://example.org/about" },
          { label: "Blog", href: "/blog" },
          { label: "Contact", href: "/reach-us" },
        ],
      }),
    );
});

test("nav levels deeper than the form are kept untouched", async () => {
  const original = pretty({
    name: "Deep Site",
    nav: [
      {
        label: "Docs",
        href: "/docs",
        icon: "book",
        children: [
          {
            label: "Guides",
            href: "/guides",
            children: [{ label: "Install", href: "/install" }],
          },
        ],
      },
    ],
  });
  const sitePath = await createSettingsSite(original);
  const { window } = await openSite(sitePath);
  await openSettings(window);

  const guides = navLink(window, "1.1");
  await expect(
    section(window, "Navigation").getByText(
      "It also has 1 more link tucked under it",
    ),
  ).toBeVisible();
  const guidesLabel = guides.getByLabel("Label", { exact: true });
  await guidesLabel.fill("Tutorials");
  await guidesLabel.blur();

  await expect
    .poll(() => configOf(sitePath))
    .toBe(original.replace('"Guides"', '"Tutorials"'));
});

test("editing the settings file outside the app refreshes the form", async () => {
  const sitePath = await createSettingsSite(
    pretty({ name: "Inside", nav: [{ label: "Home", href: "/" }] }),
  );
  const { window } = await openSite(sitePath);
  await openSettings(window);
  await expect(
    navLink(window, "1").getByLabel("Label", { exact: true }),
  ).toHaveValue("Home");

  await writeFile(
    path.join(sitePath, "nefantaris.json"),
    pretty({
      name: "Changed Outside",
      lang: "fr",
      nav: [
        { label: "Outside", href: "/about" },
        { label: "Second", href: "/" },
      ],
    }),
  );

  await expect(window.getByLabel("Site name")).toHaveValue("Changed Outside");
  await expect(window.getByLabel("Language")).toHaveValue("fr");
  await expect(
    navLink(window, "1").getByLabel("Label", { exact: true }),
  ).toHaveValue("Outside");
  await expect(
    navLink(window, "2").getByLabel("Label", { exact: true }),
  ).toHaveValue("Second");
  await expect(window.getByTestId("site-name")).toHaveText("Changed Outside");
});

test("light and dark choices follow the theme and write only the modes key", async () => {
  const base = { name: "Modes Site", nav: [] };
  const original = pretty(base);
  const sitePath = await createSettingsSite(original);
  const { window } = await openSite(sitePath, {
    FAKE_CORE_THEME_MODES: '["light","dark"]',
  });
  await openSettings(window);
  const modes = section(window, "Light and dark");

  await expect(modes.getByRole("checkbox", { name: "Light" })).toBeChecked();
  await expect(modes.getByRole("checkbox", { name: "Dark" })).toBeChecked();
  await expect(
    modes.getByRole("radio", { name: "Match the visitor’s device" }),
  ).toBeChecked();

  await modes.getByRole("radio", { name: "Dark" }).check();
  await expect
    .poll(() => configOf(sitePath))
    .toBe(pretty({ ...base, modes: { default: "dark" } }));

  await modes.getByRole("checkbox", { name: "Light" }).uncheck();
  await expect
    .poll(() => configOf(sitePath))
    .toBe(pretty({ ...base, modes: { default: "dark", exclude: ["light"] } }));
  await expect(modes.getByRole("checkbox", { name: "Dark" })).toBeDisabled();
  await expect(
    modes.getByText("Visitors always see the dark look."),
  ).toBeVisible();

  await modes.getByRole("checkbox", { name: "Light" }).check();
  await modes
    .getByRole("radio", { name: "Match the visitor’s device" })
    .check();
  await expect
    .poll(() => configOf(sitePath))
    .toBe(pretty({ ...base, modes: { default: "system" } }));

  await modes.getByRole("checkbox", { name: "Dark" }).uncheck();
  await expect
    .poll(() => configOf(sitePath))
    .toBe(pretty({ ...base, modes: { exclude: ["dark"] } }));

  await modes.getByRole("checkbox", { name: "Dark" }).check();
  await expect.poll(() => configOf(sitePath)).toBe(original);
});

test("a theme with one look says so instead of offering choices", async () => {
  const sitePath = await createSettingsSite(pretty({ name: "Light Only" }));
  const { window } = await openSite(sitePath, {
    FAKE_CORE_THEME_MODES: '["light"]',
  });
  await openSettings(window);
  const modes = section(window, "Light and dark");

  await expect(
    modes.getByText("Your theme comes in a light look only"),
  ).toBeVisible();
  await expect(modes.getByRole("checkbox")).toHaveCount(0);
  await expect(modes.getByRole("radio")).toHaveCount(0);
});

test("the share image can be picked from the site's images or added as a new one", async () => {
  const original = pretty({ name: "Share Site" });
  const sitePath = await createSettingsSite(original);
  const { window } = await openSite(sitePath);
  await openSettings(window);
  const share = section(window, "Share image");

  await share.getByRole("button", { name: "Choose from your images" }).click();
  const dialog = window.getByRole("dialog");
  await expect(dialog.getByRole("button")).toHaveText([
    "cover.webp",
    "beach.webp",
    "Cancel",
  ]);
  await dialog.getByRole("button", { name: "beach.webp" }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(() => configOf(sitePath))
    .toBe(pretty({ name: "Share Site", image: "/assets/photos/beach.webp" }));
  await expect(share.getByText("beach.webp")).toBeVisible();

  await share.getByTestId("share-image-file").setInputFiles({
    name: "Team Photo.webp",
    mimeType: "image/webp",
    buffer: Buffer.from(tinyWebpBase64, "base64"),
  });
  await expect
    .poll(async () =>
      (await readdir(path.join(sitePath, "assets"))).find((name) =>
        name.startsWith("team-photo-"),
      ),
    )
    .toMatch(/^team-photo-[0-9-]+\.webp$/);
  const added = (await readdir(path.join(sitePath, "assets"))).find((name) =>
    name.startsWith("team-photo-"),
  );
  await expect
    .poll(() => configOf(sitePath))
    .toBe(pretty({ name: "Share Site", image: `/assets/${added}` }));

  await share.getByRole("button", { name: "Remove share image" }).click();
  await expect.poll(() => configOf(sitePath)).toBe(original);
});

test("replacing the site icon writes one favicon and removes the others", async () => {
  const original = pretty({ name: "Icon Site" });
  const sitePath = await createSettingsSite(original);
  await mkdir(path.join(sitePath, "public"));
  await writeFile(
    path.join(sitePath, "public", "favicon.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  await writeFile(path.join(sitePath, "public", "favicon.ico"), "ico");
  const { window } = await openSite(sitePath);
  await openSettings(window);
  const icon = section(window, "Site icon");

  await expect(icon.getByText("favicon.svg")).toBeVisible();
  await expect(
    icon.getByRole("img", { name: "Current site icon" }),
  ).toBeVisible();

  const pngBytes = Buffer.from(tinyPngBase64, "base64");
  await icon.getByTestId("favicon-file").setInputFiles({
    name: `my-icon.${pngExtension}`,
    mimeType: "image/png",
    buffer: pngBytes,
  });

  await expect(icon.getByText(`favicon.${pngExtension}`)).toBeVisible();
  expect(await readdir(path.join(sitePath, "public"))).toEqual([
    `favicon.${pngExtension}`,
  ]);
  expect(
    await readFile(path.join(sitePath, "public", `favicon.${pngExtension}`)),
  ).toEqual(pngBytes);
  expect(await configOf(sitePath)).toBe(original);
});
