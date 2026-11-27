import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTempDir } from "./helpers.ts";

export const tinyWebpBase64 =
  "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

export async function createEditorSite(
  pages: Record<string, string>,
  imageNames: string[] = [],
): Promise<string> {
  const dir = await createTempDir("nefantaris-editing-");
  await writeFile(
    path.join(dir, "nefantaris.json"),
    JSON.stringify({ name: "Editing Site" }),
  );
  await mkdir(path.join(dir, "content", "pages"), { recursive: true });
  await mkdir(path.join(dir, "content", "posts"), { recursive: true });
  for (const [fileName, text] of Object.entries(pages)) {
    await writeFile(path.join(dir, "content", "pages", fileName), text);
  }
  await mkdir(path.join(dir, "assets"));
  for (const imageName of imageNames) {
    await writeFile(
      path.join(dir, "assets", imageName),
      Buffer.from(tinyWebpBase64, "base64"),
    );
  }
  return dir;
}

export function pageText(sitePath: string, fileName: string): Promise<string> {
  return readFile(path.join(sitePath, "content", "pages", fileName), "utf8");
}

export async function openPage(window: Page, title: string): Promise<void> {
  await window.getByRole("button", { name: title, exact: true }).click();
  await expect(window.locator(".cm-content")).toBeVisible();
}

export function editorLine(window: Page, text: string): Locator {
  return window.locator(".cm-line", { hasText: text }).first();
}

export async function cursorAt(
  window: Page,
  lineText: string,
  offset: number,
): Promise<void> {
  await editorLine(window, lineText).click();
  await window.keyboard.press("Home");
  for (let step = 0; step < offset; step++) {
    await window.keyboard.press("ArrowRight");
  }
}

export async function selectInLine(
  window: Page,
  lineText: string,
  offset: number,
  length: number,
): Promise<void> {
  await cursorAt(window, lineText, offset);
  for (let step = 0; step < length; step++) {
    await window.keyboard.press("Shift+ArrowRight");
  }
}

export function formattingToolbar(window: Page): Locator {
  return window.getByRole("toolbar", { name: "Formatting" });
}

export function toolbarButton(window: Page, name: string): Locator {
  return formattingToolbar(window).getByRole("button", { name, exact: true });
}

export async function pasteIntoEditor(
  window: Page,
  content: { text: string; html?: string },
): Promise<void> {
  await window.locator(".cm-content").evaluate((element, data) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", data.text);
    if (data.html !== undefined) {
      transfer.setData("text/html", data.html);
    }
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, content);
}
