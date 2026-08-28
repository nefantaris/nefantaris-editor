import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanupTestArtifacts,
  createTempDir,
  launchEditor,
  stubDirectoryPicker,
} from "./helpers.ts";

const tinyWebpBase64 = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

const kitchenSinkContent = `---
title: Kitchen Sink
---

# Big Heading

This is **bold** move with *italic* and ~~gone~~ and \`inline code\`.

Visit [my site](https://example.com/path) or <https://example.com/auto> today.

> A quoted line of wisdom.

- first bullet
- second bullet
  - nested bullet

1. step one
2. step two

- [ ] Buy milk
- [x] Ship the milestone

---

\`\`\`js
const answer = 42;
\`\`\`

| Name | Amount |
| :--- | -----: |
| Apples | 3 |
| Pears | 12 |

A footnote reference[^note] in text.

[^note]: The footnote definition.

:::gallery
![A pixel](/assets/pixel.webp)
:::

::toc

<div>raw html stays text</div>

The end.
`;

async function createPreviewSite(name: string): Promise<string> {
  const dir = await createTempDir("nefantaris-preview-");
  await writeFile(path.join(dir, "nefantaris.json"), JSON.stringify({ name }));
  await mkdir(path.join(dir, "content", "pages"), { recursive: true });
  await mkdir(path.join(dir, "content", "posts"), { recursive: true });
  await mkdir(path.join(dir, "assets"));
  await writeFile(
    path.join(dir, "content", "pages", "kitchen-sink.md"),
    kitchenSinkContent,
  );
  await writeFile(
    path.join(dir, "assets", "pixel.webp"),
    Buffer.from(tinyWebpBase64, "base64"),
  );
  return dir;
}

async function openKitchenSink(
  sitePath: string,
): Promise<{ app: ElectronApplication; window: Page }> {
  const userDataDir = await createTempDir("nefantaris-userdata-");
  const app = await launchEditor(userDataDir);
  const welcome = await app.firstWindow();
  await stubDirectoryPicker(app, sitePath);
  const siteWindowPromise = app.waitForEvent("window");
  await welcome.getByRole("button", { name: "Open site…" }).click();
  const window = await siteWindowPromise;
  await window
    .getByRole("button", { name: "Kitchen Sink", exact: true })
    .click();
  await expect(
    window.locator(".cm-line").filter({ hasText: "Big Heading" }),
  ).toBeVisible();
  return { app, window };
}

async function scrollIntoRender(window: Page, target: Locator): Promise<void> {
  const scroller = window.locator(".cm-scroller");
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect
    .poll(async () => {
      if ((await target.count()) > 0) {
        return true;
      }
      await scroller.evaluate((element) => {
        element.scrollTop += element.clientHeight;
      });
      return false;
    })
    .toBe(true);
  await target.first().scrollIntoViewIfNeeded();
}

function kitchenSinkPath(sitePath: string): string {
  return path.join(sitePath, "content", "pages", "kitchen-sink.md");
}

async function fileContentOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

test.afterEach(cleanupTestArtifacts);

test("heading and bold marks are hidden until the cursor reveals them", async () => {
  const sitePath = await createPreviewSite("Preview Site");
  const { window } = await openKitchenSink(sitePath);

  const headingLine = window
    .locator(".cm-line")
    .filter({ hasText: "Big Heading" });
  await expect(headingLine).toHaveText("Big Heading");

  const boldLine = window
    .locator(".cm-line")
    .filter({ hasText: "move with italic" });
  await expect(boldLine).toHaveText(
    "This is bold move with italic and gone and inline code.",
  );

  await headingLine.click();
  await expect(headingLine).toHaveText("# Big Heading");

  await window
    .locator(".cm-content")
    .getByText("bold", { exact: true })
    .click();
  await expect(boldLine).toContainText("**bold**");
  await expect(headingLine).toHaveText("Big Heading");
});

test("clicking a task checkbox writes the toggled marker to disk byte-exactly", async () => {
  const sitePath = await createPreviewSite("Task Site");
  const { window } = await openKitchenSink(sitePath);

  const checkbox = window.locator("input.nef-task-checkbox").first();
  await scrollIntoRender(window, checkbox);
  await checkbox.click();

  const expected = kitchenSinkContent.replace(
    "- [ ] Buy milk",
    "- [x] Buy milk",
  );
  await expect
    .poll(() => fileContentOrNull(kitchenSinkPath(sitePath)))
    .toBe(expected);
});

test("a table renders as a widget and reveals raw source when the cursor enters", async () => {
  const sitePath = await createPreviewSite("Table Site");
  const { window } = await openKitchenSink(sitePath);

  const tableWidget = window.locator(".nef-table-widget");
  await scrollIntoRender(window, tableWidget);
  await expect(tableWidget).toBeVisible();
  await expect(tableWidget.locator("th").first()).toHaveText("Name");
  await expect(tableWidget.locator("td")).toHaveCount(4);
  await expect(
    window.locator(".cm-line").filter({ hasText: "| Apples | 3 |" }),
  ).toHaveCount(0);

  await tableWidget.dispatchEvent("mousedown");

  await expect(tableWidget).toHaveCount(0);
  await expect(
    window.locator(".cm-line.nef-table-source").first(),
  ).toBeVisible();
  await expect(
    window.locator(".cm-line").filter({ hasText: "| Apples | 3 |" }),
  ).toBeVisible();
});

test("directive fences render as labeled widgets and reveal raw text on cursor", async () => {
  const sitePath = await createPreviewSite("Directive Site");
  const { window } = await openKitchenSink(sitePath);

  const openFence = window.locator(".nef-directive-fence-open");
  await scrollIntoRender(window, openFence);
  await expect(openFence).toBeVisible();
  await expect(openFence).toHaveAttribute("data-directive", "gallery");
  await expect(openFence).toHaveText("gallery");
  await expect(window.locator(".nef-directive-fence-close")).toBeVisible();
  await expect(window.locator(".nef-directive-fence-leaf")).toHaveAttribute(
    "data-directive",
    "toc",
  );
  await expect(
    window.locator(".cm-line").filter({ hasText: ":::gallery" }),
  ).toHaveCount(0);

  await openFence.dispatchEvent("mousedown");

  await expect(
    window.locator(".cm-line").filter({ hasText: ":::gallery" }),
  ).toBeVisible();
});

test("a site asset image renders through the custom protocol", async () => {
  const sitePath = await createPreviewSite("Image Site");
  const { window } = await openKitchenSink(sitePath);

  const imageWidget = window.locator(".nef-image-widget");
  await scrollIntoRender(window, imageWidget);
  const image = imageWidget.locator("img");
  await expect(image).toBeVisible();
  await expect(window.locator(".nef-image-placeholder")).toHaveCount(0);
  await expect
    .poll(() =>
      image.evaluate((element) =>
        element instanceof HTMLImageElement ? element.naturalWidth : 0,
      ),
    )
    .toBeGreaterThan(0);
});

test("cmd-clicking an external link opens it in the default browser", async () => {
  const sitePath = await createPreviewSite("Link Site");
  const { app, window } = await openKitchenSink(sitePath);

  await app.evaluate(({ shell }) => {
    shell.openExternal = (url: string) => {
      process.env.NEF_TEST_OPENED_URL = url;
      return Promise.resolve();
    };
  });

  await window
    .locator(".nef-link")
    .filter({ hasText: "my site" })
    .click({ modifiers: ["ControlOrMeta"] });

  await expect
    .poll(() => app.evaluate(() => process.env.NEF_TEST_OPENED_URL ?? ""))
    .toBe("https://example.com/path");
});

test("the kitchen sink survives an editing session byte for byte", async () => {
  const sitePath = await createPreviewSite("Fidelity Site");
  const { window } = await openKitchenSink(sitePath);

  const tableWidget = window.locator(".nef-table-widget");
  await scrollIntoRender(window, tableWidget);
  await tableWidget.dispatchEvent("mousedown");
  await expect(
    window.locator(".cm-line.nef-table-source").first(),
  ).toBeVisible();

  const firstCheckbox = window.locator("input.nef-task-checkbox").first();
  await scrollIntoRender(window, firstCheckbox);
  await firstCheckbox.click();
  await expect
    .poll(() => fileContentOrNull(kitchenSinkPath(sitePath)))
    .toContain("- [x] Buy milk");
  await firstCheckbox.click();
  await expect
    .poll(() => fileContentOrNull(kitchenSinkPath(sitePath)))
    .toContain("- [ ] Buy milk");

  const headingLine = window
    .locator(".cm-line")
    .filter({ hasText: "Big Heading" });
  await scrollIntoRender(window, headingLine);
  await headingLine.click();
  await expect(headingLine).toHaveText("# Big Heading");

  const htmlLine = window
    .locator(".cm-line")
    .filter({ hasText: "raw html stays text" });
  await scrollIntoRender(window, htmlLine);
  await expect(htmlLine).toHaveText("<div>raw html stays text</div>");

  await window.locator(".cm-line").first().click();
  const docStartShortcut =
    process.platform === "darwin" ? "Meta+ArrowUp" : "Control+Home";
  await window.keyboard.press(docStartShortcut);
  await window.keyboard.type("X");

  await expect
    .poll(() => fileContentOrNull(kitchenSinkPath(sitePath)))
    .toBe(
      kitchenSinkContent.replace(
        "title: Kitchen Sink\n---\n\n",
        "title: Kitchen Sink\n---\nX\n",
      ),
    );
});
