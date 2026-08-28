import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import { PAGES_ROOT, POSTS_ROOT } from "./contentTree.cjs";
import type {
  CreateContentResult,
  DeleteContentResult,
  ReadContentFileResult,
  RenameContentResult,
  SaveAssetResult,
} from "./ipcContract.cjs";

const ASSET_EXTENSIONS_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

function resolveInside(
  sitePath: string,
  relativePath: string,
  allowedRoot: string,
): string {
  const absolute = path.resolve(sitePath, relativePath);
  const root = path.resolve(sitePath, allowedRoot);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new Error(`Path escapes ${allowedRoot}: ${relativePath}`);
  }
  return absolute;
}

export function kebabCase(input: string): string {
  return input
    .normalize("NFKD")
    .replaceAll(/[\u{0300}-\u{036F}]/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

export function readContentFile(
  sitePath: string,
  relativePath: string,
): ReadContentFileResult {
  const absolute = resolveInside(sitePath, relativePath, "content");
  try {
    return { status: "ok", text: fs.readFileSync(absolute, "utf8") };
  } catch {
    return { status: "missing" };
  }
}

export function writeContentFile(
  sitePath: string,
  relativePath: string,
  text: string,
): void {
  const absolute = resolveInside(sitePath, relativePath, "content");
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, text, "utf8");
}

function createContentFile(
  sitePath: string,
  relativePath: string,
  scaffold: string,
): CreateContentResult {
  const absolute = resolveInside(sitePath, relativePath, "content");
  if (fs.existsSync(absolute)) {
    return { status: "failed", reason: "already-exists" };
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, scaffold, "utf8");
  return { status: "created", relativePath };
}

export function createPage(
  sitePath: string,
  folderRelativePath: string,
  title: string,
): CreateContentResult {
  const trimmedTitle = title.trim();
  const stem = kebabCase(trimmedTitle);
  if (trimmedTitle === "" || stem === "") {
    return { status: "failed", reason: "invalid-name" };
  }
  const folder =
    folderRelativePath === ""
      ? PAGES_ROOT
      : `${PAGES_ROOT}/${folderRelativePath}`;
  resolveInside(sitePath, folder, PAGES_ROOT);
  const scaffold = `---\n${stringify({ title: trimmedTitle })}---\n`;
  return createContentFile(sitePath, `${folder}/${stem}.md`, scaffold);
}

function localIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function createPost(
  sitePath: string,
  title: string,
): CreateContentResult {
  const trimmedTitle = title.trim();
  const stem = kebabCase(trimmedTitle);
  if (trimmedTitle === "" || stem === "") {
    return { status: "failed", reason: "invalid-name" };
  }
  const scaffold = `---\n${stringify({ title: trimmedTitle })}date: ${localIsoDate()}\n---\n`;
  return createContentFile(sitePath, `${POSTS_ROOT}/${stem}.md`, scaffold);
}

export function renameContentFile(
  sitePath: string,
  relativePath: string,
  newName: string,
): RenameContentResult {
  const absolute = resolveInside(sitePath, relativePath, "content");
  if (!fs.existsSync(absolute)) {
    return { status: "failed", reason: "not-found" };
  }
  const stem = kebabCase(newName);
  if (stem === "") {
    return { status: "failed", reason: "invalid-name" };
  }
  const parent = relativePath.slice(0, relativePath.lastIndexOf("/"));
  const newRelativePath = `${parent}/${stem}.md`;
  if (newRelativePath === relativePath) {
    return { status: "renamed", relativePath };
  }
  const newAbsolute = resolveInside(sitePath, newRelativePath, "content");
  if (fs.existsSync(newAbsolute)) {
    return { status: "failed", reason: "already-exists" };
  }
  fs.renameSync(absolute, newAbsolute);
  return { status: "renamed", relativePath: newRelativePath };
}

export function deleteContentFile(
  sitePath: string,
  relativePath: string,
): DeleteContentResult {
  const absolute = resolveInside(sitePath, relativePath, "content");
  if (!fs.existsSync(absolute)) {
    return { status: "failed", reason: "not-found" };
  }
  fs.rmSync(absolute);
  return { status: "deleted" };
}

function timestampStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${date}-${time}`;
}

export function saveAsset(
  sitePath: string,
  mimeType: string,
  baseName: string,
  bytes: Uint8Array,
): SaveAssetResult {
  const extension = ASSET_EXTENSIONS_BY_MIME[mimeType];
  if (!extension) {
    return { status: "failed", reason: "unsupported-type" };
  }
  const assetsDir = path.join(sitePath, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  const base = kebabCase(baseName) || "pasted-image";
  const stamp = timestampStamp();
  let fileName = `${base}-${stamp}.${extension}`;
  let counter = 2;
  while (fs.existsSync(path.join(assetsDir, fileName))) {
    fileName = `${base}-${stamp}-${counter}.${extension}`;
    counter += 1;
  }
  fs.writeFileSync(path.join(assetsDir, fileName), Buffer.from(bytes));
  return { status: "saved", markdownPath: `/assets/${fileName}` };
}
