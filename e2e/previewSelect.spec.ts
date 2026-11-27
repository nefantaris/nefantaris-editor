import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  createEditorSite,
  editorLine,
  openPage,
  pageText,
} from "./editorTestSite.ts";
import { openSiteWithFakeCore } from "./fakeCore.ts";
import { cleanupTestArtifacts } from "./helpers.ts";

const pages = {
  "index.md": "---\ntitle: Home\n---\n\nWelcome home.\n",
  "about.md":
    "---\ntitle: About\n---\n\n# About us\n\nFirst paragraph.\n\nSecond paragraph.\n",
  "docs.md": "---\ntitle: Docs\n---\n\nDocs body.\n",
  "secret.md": "---\ntitle: Secret\n---\n\nSecret body.\n",
};

function previewFrame(window: Page) {
  return window.frameLocator('iframe[title="Site preview"]');
}

function pointToggle(window: Page) {
  return window.getByRole("button", { name: "Point at something to edit it" });
}

async function openAboutWithPreview(): Promise<{
  window: Page;
  sitePath: string;
}> {
  const sitePath = await createEditorSite(pages);
  const { window } = await openSiteWithFakeCore(sitePath);
  await openPage(window, "About");
  await window.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(previewFrame(window).locator("#request-path")).toHaveText(
    "/about",
    { timeout: 20_000 },
  );
  await expect(pointToggle(window)).toBeEnabled();
  return { window, sitePath };
}

test.afterEach(cleanupTestArtifacts);

test("pointing at something in the preview opens its source line, and the preview offers to edit the page it shows", async () => {
  const { window, sitePath } = await openAboutWithPreview();
  const frame = previewFrame(window);

  await pointToggle(window).click();
  await expect(pointToggle(window)).toHaveAttribute("aria-pressed", "true");
  await expect(frame.locator("body")).toHaveAttribute("data-selecting", "true");
  await frame.getByText("Second paragraph.").click();

  await expect(
    window.locator(".nef-revealed-line", { hasText: "Second paragraph." }),
  ).toBeVisible();
  await expect(pointToggle(window)).toHaveAttribute("aria-pressed", "false");
  await expect(frame.locator("body")).toHaveAttribute(
    "data-selecting",
    "false",
  );
  await window.keyboard.type("Edited ");
  await expect
    .poll(() => pageText(sitePath, "about.md"))
    .toContain("\nEdited Second paragraph.\n");
  await expect(window.locator(".nef-revealed-line")).toHaveCount(0, {
    timeout: 5000,
  });

  const editThisPage = window.getByRole("button", { name: "Edit this page" });
  await expect(editThisPage).toBeHidden();
  await frame.locator("a[href='/docs']").click();
  await expect(frame.locator("#request-path")).toHaveText("/docs");
  await expect(
    window.getByRole("region", { name: "Site preview" }),
  ).toContainText("/docs");
  await expect(editThisPage).toBeVisible();
  await expect(editorLine(window, "First paragraph.")).toBeVisible();
  await editThisPage.click();
  await expect(editorLine(window, "Docs body.")).toBeVisible();
  await expect(editThisPage).toBeHidden();

  await expect(frame.locator("#request-path")).toHaveText("/docs");
  await expect(pointToggle(window)).toBeEnabled();
  await frame.locator("a[href='/about']").click();
  await expect(frame.locator("#request-path")).toHaveText("/about");
  await pointToggle(window).click();
  await frame.getByRole("heading", { name: "Fake Core" }).click();
  await expect(editorLine(window, "First paragraph.")).toBeVisible();
  await window.keyboard.type("Top ");
  await expect
    .poll(() => pageText(sitePath, "about.md"))
    .toContain("---\nTop \n# About us\n");
});

test("Escape in the preview leaves point mode, and messages from anything but the preview's own frame are ignored", async () => {
  const { window } = await openAboutWithPreview();
  const frame = previewFrame(window);

  await pointToggle(window).click();
  await expect(pointToggle(window)).toHaveAttribute("aria-pressed", "true");
  await frame.locator("main").press("Escape");
  await expect(pointToggle(window)).toHaveAttribute("aria-pressed", "false");

  await window.evaluate(() => {
    globalThis.postMessage(
      {
        type: "nefantaris:selected",
        protocol: 1,
        route: "/secret",
        file: "content/pages/secret.md",
        line: 4,
      },
      "*",
    );
  });
  await frame.getByRole("button", { name: "Send foreign messages" }).click();
  await window.waitForTimeout(750);
  await expect(editorLine(window, "First paragraph.")).toBeVisible();
  await expect(
    window.locator(".cm-line", { hasText: "Secret body." }),
  ).toHaveCount(0);
  await expect(
    window.getByRole("button", { name: "Edit this page" }),
  ).toBeHidden();

  await pointToggle(window).click();
  await frame.getByText("First paragraph.").click();
  await expect(
    window.locator(".nef-revealed-line", { hasText: "First paragraph." }),
  ).toBeVisible();
});

test("pointing at a gallery image opens the gallery block's line", async () => {
  const sitePath = await createEditorSite(
    {
      "index.md": "---\ntitle: Home\n---\n\nWelcome home.\n",
      "photos.md":
        "---\ntitle: Photos\n---\n\nBefore the gallery.\n\n:::gallery\n" +
        "![Teal](/assets/teal.webp)\n![Amber](/assets/amber.webp)\n:::\n\n" +
        "After the gallery.\n",
    },
    ["teal.webp", "amber.webp"],
  );
  const { window } = await openSiteWithFakeCore(sitePath, {
    FAKE_CORE_DIRECTIVE_SCHEMAS: JSON.stringify({
      gallery: {
        label: "Gallery",
        description: null,
        body: "images",
        placeholder: null,
        text: null,
        attributes: {},
      },
    }),
  });
  await openPage(window, "Photos");
  await window.getByRole("button", { name: "Preview", exact: true }).click();
  const frame = previewFrame(window);
  await expect(frame.locator("#request-path")).toHaveText("/photos", {
    timeout: 20_000,
  });
  await editorLine(window, "After the gallery.").click();

  await pointToggle(window).click();
  await frame.getByRole("img", { name: "Amber" }).click();
  const revealed = window.locator(".nef-revealed-line");
  await expect(revealed).toHaveCount(1);
  await expect(revealed).toHaveText(":::gallery");
  await expect(pointToggle(window)).toHaveAttribute("aria-pressed", "false");
});
