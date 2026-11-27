import fs from "node:fs";
import path from "node:path";
import type {
  SetFaviconResult,
  SiteFavicon,
  SiteImage,
} from "./ipcContract.cjs";

const FAVICON_EXTENSIONS = new Set(["svg", "png", "webp", "ico"]);

const FAVICON_EXTENSIONS_BY_MIME: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "avif",
]);

export const FAVICON_FILE_PATTERN = /^\/favicon\.(?:svg|png|webp|ico)$/;

function extensionOf(fileName: string): string {
  return path.extname(fileName).slice(1).toLowerCase();
}

function publicDir(sitePath: string): string {
  return path.join(sitePath, "public");
}

function modifiedAtMs(filePath: string): number | null {
  try {
    const stats = fs.statSync(filePath);
    return stats.isFile() ? stats.mtimeMs : null;
  } catch {
    return null;
  }
}

export function findFavicon(sitePath: string): SiteFavicon | null {
  for (const extension of FAVICON_EXTENSIONS) {
    const fileName = `favicon.${extension}`;
    const modified = modifiedAtMs(path.join(publicDir(sitePath), fileName));
    if (modified !== null) {
      return { fileName, modifiedAtMs: modified };
    }
  }
  return null;
}

function faviconExtensionFor(
  fileName: string,
  mimeType: string,
): string | null {
  const fromName = extensionOf(fileName);
  if (FAVICON_EXTENSIONS.has(fromName)) {
    return fromName;
  }
  return FAVICON_EXTENSIONS_BY_MIME[mimeType] ?? null;
}

export function replaceFavicon(
  sitePath: string,
  fileName: string,
  mimeType: string,
  bytes: Uint8Array,
): SetFaviconResult {
  const extension = faviconExtensionFor(fileName, mimeType);
  if (extension === null) {
    return { status: "failed", reason: "unsupported-type" };
  }
  const directory = publicDir(sitePath);
  fs.mkdirSync(directory, { recursive: true });
  const faviconName = `favicon.${extension}`;
  const faviconPath = path.join(directory, faviconName);
  fs.writeFileSync(faviconPath, Buffer.from(bytes));
  for (const other of FAVICON_EXTENSIONS) {
    if (other !== extension) {
      fs.rmSync(path.join(directory, `favicon.${other}`), { force: true });
    }
  }
  return {
    status: "saved",
    favicon: {
      fileName: faviconName,
      modifiedAtMs: fs.statSync(faviconPath).mtimeMs,
    },
  };
}

function collectImages(directory: string, servedPrefix: string): SiteImage[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => !entry.name.startsWith("."))
    .flatMap((entry) => {
      const servedPath = `${servedPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        return collectImages(path.join(directory, entry.name), servedPath);
      }
      if (entry.isFile() && IMAGE_EXTENSIONS.has(extensionOf(entry.name))) {
        return [{ assetPath: servedPath, fileName: entry.name }];
      }
      return [];
    });
}

export function listSiteImages(sitePath: string): SiteImage[] {
  return collectImages(path.join(sitePath, "assets"), "/assets").toSorted(
    (first, second) => first.assetPath.localeCompare(second.assetPath),
  );
}
