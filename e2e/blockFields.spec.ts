import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  createEditorSite,
  editorLine,
  openPage,
  pageText,
} from "./editorTestSite.ts";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { cleanupTestArtifacts } from "./helpers.ts";

const blockSchemas = {
  button: {
    label: "Button",
    description: null,
    body: "none",
    placeholder: null,
    text: {
      label: "Button text",
      description: "The words on the button.",
      required: true,
    },
    attributes: {
      href: {
        type: "url",
        label: "Link",
        description: null,
        required: true,
        default: null,
        example: "/about",
      },
    },
  },
  chip: {
    label: "Chip",
    description: null,
    body: "none",
    placeholder: null,
    text: { label: "Chip text", description: null, required: false },
    attributes: {},
  },
  hero: {
    label: "Hero",
    description: null,
    body: "markdown",
    placeholder: "A short lead.",
    text: null,
    attributes: {
      heading: {
        type: "text",
        label: "Heading",
        description: null,
        required: true,
        multiline: false,
        default: null,
        example: "Write in markdown",
      },
      image: {
        type: "image",
        label: "Image",
        description: null,
        required: false,
        alt: "imageAlt",
        default: null,
        example: "/assets/photo-teal.webp",
      },
      imageAlt: {
        type: "text",
        label: "Image description",
        description: "What the image shows.",
        required: false,
        multiline: false,
        default: null,
        example: "A teal placeholder",
      },
    },
  },
};

const blockEnv = {
  FAKE_CORE_DIRECTIVE_SCHEMAS: JSON.stringify(blockSchemas),
};

const leafPage =
  "---\ntitle: Leaf Page\n---\n\nIntro.\n\n" +
  '::button[Read more]{#cta href="/old" data-x="keep"}\n\n' +
  "::chip\n\nOutro.\n";

async function openBlockSite(): Promise<{ window: Page; sitePath: string }> {
  const sitePath = await createEditorSite(
    {
      "leaf.md": leafPage,
      "about.md": "---\ntitle: About\n---\n\nAbout us.\n",
    },
    ["cover.webp"],
  );
  const { window } = await openSiteWithFakeCore(sitePath, blockEnv);
  await openPage(window, "Leaf Page");
  return { window, sitePath };
}

async function openPalette(window: Page, lineText: string): Promise<Locator> {
  await editorLine(window, lineText).click();
  await window.keyboard.press("ControlOrMeta+/");
  const palette = window.getByRole("dialog", { name: "Insert a block" });
  await expect(palette).toBeVisible();
  return palette;
}

test.afterEach(cleanupTestArtifacts);

test("a leaf block asks for its text, requires it when declared, and round-trips existing text", async () => {
  const { window, sitePath } = await openBlockSite();

  await window.getByRole("button", { name: "Button options" }).click();
  const options = window.getByRole("dialog", { name: "Button options" });
  const buttonText = options.getByRole("textbox", { name: "Button text" });
  await expect(buttonText).toHaveValue("Read more");
  await expect(options).toContainText("The words on the button.");
  await options.getByRole("button", { name: "Save" }).click();
  await expect(options).toBeHidden();
  expect(await pageText(sitePath, "leaf.md")).toBe(leafPage);

  await window.getByRole("button", { name: "Button options" }).click();
  await buttonText.fill("Read [all");
  await options.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => pageText(sitePath, "leaf.md"))
    .toContain(
      String.raw`::button[Read \[all]{#cta href="/old" data-x="keep"}`,
    );

  await window.getByRole("button", { name: "Chip options" }).click();
  const chip = window.getByRole("dialog", { name: "Chip options" });
  await expect(chip.getByRole("textbox", { name: "Chip text" })).toHaveValue(
    "",
  );
  await chip.getByRole("textbox", { name: "Chip text" }).fill("New");
  await chip.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => pageText(sitePath, "leaf.md"))
    .toContain("\n::chip[New]\n");
  await window.getByRole("button", { name: "Chip options" }).click();
  await chip.getByRole("textbox", { name: "Chip text" }).fill("");
  await chip.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => pageText(sitePath, "leaf.md"))
    .toContain("\n::chip\n");

  const palette = await openPalette(window, "Intro.");
  await palette.getByRole("button", { name: /^Button/ }).click();
  const form = window.getByRole("dialog", { name: "Add Button" });
  const newText = form.getByRole("textbox", { name: "Button text" });
  await expect(newText).toHaveAttribute("aria-required", "true");
  await form.getByRole("button", { name: "Insert" }).click();
  await expect(newText).toBeFocused();
  await expect(form.locator('[data-field="[text]"]')).toContainText(
    "This is required.",
  );
  await newText.fill("Get started");
  await form
    .getByRole("combobox", { name: "Link", exact: true })
    .selectOption({ label: "About (/about)" });
  await form.getByRole("button", { name: "Insert" }).click();
  await expect
    .poll(() => pageText(sitePath, "leaf.md"))
    .toContain('Intro.\n\n::button[Get started]{href="/about"}\n');
});

test("an image's alt text is asked for beside the image, and examples are hints, never values", async () => {
  const { window, sitePath } = await openBlockSite();

  const palette = await openPalette(window, "Outro.");
  await palette.getByRole("button", { name: /^Hero/ }).click();
  const form = window.getByRole("dialog", { name: "Add Hero" });
  const heading = form.getByRole("textbox", { name: "Heading" });
  await expect(heading).toHaveValue("");
  await expect(heading).toHaveAttribute(
    "placeholder",
    "For example: Write in markdown",
  );
  await expect(
    form.getByRole("textbox", { name: "Image description" }),
  ).toHaveCount(0);
  await form.getByRole("button", { name: "Insert" }).click();
  await expect(heading).toBeFocused();
  await expect(form.locator('[data-field="heading"]')).toContainText(
    "This is required.",
  );

  await heading.fill("Welcome");
  await form.getByRole("button", { name: "Choose from your images" }).click();
  await window
    .getByRole("dialog", { name: "Choose image" })
    .getByRole("button", { name: "cover.webp" })
    .click();
  const alt = form.getByRole("textbox", { name: "Image description" });
  await expect(alt).toBeFocused();
  await expect(alt).toHaveValue("");
  await expect(alt).toHaveAttribute(
    "placeholder",
    "For example: A teal placeholder",
  );
  await expect(form).toContainText("What the image shows.");
  await alt.fill("A cover");
  await form.getByRole("button", { name: "Insert" }).click();
  await expect
    .poll(() => pageText(sitePath, "leaf.md"))
    .toContain(
      ':::hero{heading="Welcome" image="/assets/cover.webp" imageAlt="A cover"}\nA short lead.\n:::',
    );

  await window.getByRole("button", { name: "Hero options" }).click();
  const options = window.getByRole("dialog", { name: "Hero options" });
  await expect(
    options.getByRole("textbox", { name: "Image description" }),
  ).toHaveValue("A cover");
  await options.getByRole("button", { name: "Remove image" }).click();
  await expect(
    options.getByRole("textbox", { name: "Image description" }),
  ).toHaveCount(0);
  await options.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => pageText(sitePath, "leaf.md"))
    .toContain(':::hero{heading="Welcome"}\n');

  await window.getByRole("button", { name: "Button options" }).click();
  const button = window.getByRole("dialog", { name: "Button options" });
  await button
    .getByRole("combobox", { name: "Link", exact: true })
    .selectOption({ label: "Another address…" });
  await expect(
    button.getByRole("textbox", { name: "Link address" }),
  ).toHaveAttribute("placeholder", "For example: /about");
});
