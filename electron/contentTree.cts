import fs from "node:fs";
import path from "node:path";
import {
  frontmatterDate,
  frontmatterDraft,
  frontmatterSlug,
  frontmatterTitle,
  parseFrontmatter,
} from "./frontmatter.cjs";
import type {
  ContentTree,
  PageTreeFile,
  PageTreeFolder,
  PageTreeNode,
  PostListEntry,
} from "./ipcContract.cjs";

export const PAGES_ROOT = "content/pages";
export const POSTS_ROOT = "content/posts";

function fileStem(fileName: string): string {
  return fileName.replace(/\.md$/, "");
}

function pageRoute(
  relativePath: string,
  frontmatter: ReturnType<typeof parseFrontmatter>,
): string | null {
  if (frontmatterDraft(frontmatter)) {
    return null;
  }
  const slug = frontmatterSlug(frontmatter);
  if (slug !== null) {
    return `/${slug}`;
  }
  const segments = fileStem(relativePath.slice(PAGES_ROOT.length + 1)).split(
    "/",
  );
  return `/${(segments.at(-1) === "index" ? segments.slice(0, -1) : segments).join("/")}`;
}

function postRoute(
  fileName: string,
  frontmatter: ReturnType<typeof parseFrontmatter>,
): string | null {
  if (frontmatterDraft(frontmatter)) {
    return null;
  }
  return `/blog/${frontmatterSlug(frontmatter) ?? fileStem(fileName)}`;
}

function readDirectoryEntries(absoluteDir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function readFileFrontmatter(
  absolutePath: string,
): ReturnType<typeof parseFrontmatter> {
  let text: string;
  try {
    text = fs.readFileSync(absolutePath, "utf8");
  } catch {
    return {};
  }
  return parseFrontmatter(text);
}

function readPagesDirectory(
  sitePath: string,
  relativeDir: string,
): PageTreeNode[] {
  const absoluteDir = path.join(sitePath, relativeDir);
  const entries = readDirectoryEntries(absoluteDir);

  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry): PageTreeFolder => {
      const relativePath = `${relativeDir}/${entry.name}`;
      return {
        kind: "folder",
        name: entry.name,
        relativePath,
        children: readPagesDirectory(sitePath, relativePath),
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry): PageTreeFile => {
      const relativePath = `${relativeDir}/${entry.name}`;
      const frontmatter = readFileFrontmatter(
        path.join(sitePath, relativePath),
      );
      return {
        kind: "page",
        title: frontmatterTitle(frontmatter, fileStem(entry.name)),
        fileName: entry.name,
        relativePath,
        route: pageRoute(relativePath, frontmatter),
      };
    })
    .toSorted((a, b) => a.title.localeCompare(b.title));

  return [...folders, ...files];
}

function readPostsDirectory(sitePath: string): PostListEntry[] {
  const absoluteDir = path.join(sitePath, POSTS_ROOT);
  return readDirectoryEntries(absoluteDir)
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const relativePath = `${POSTS_ROOT}/${entry.name}`;
      const frontmatter = readFileFrontmatter(
        path.join(sitePath, relativePath),
      );
      return {
        title: frontmatterTitle(frontmatter, fileStem(entry.name)),
        fileName: entry.name,
        relativePath,
        route: postRoute(entry.name, frontmatter),
        date: frontmatterDate(frontmatter),
        isDraft: frontmatterDraft(frontmatter),
      };
    })
    .toSorted(
      (a, b) =>
        (b.date ?? "").localeCompare(a.date ?? "") ||
        a.title.localeCompare(b.title),
    );
}

export function buildContentTree(sitePath: string): ContentTree {
  return {
    pages: readPagesDirectory(sitePath, PAGES_ROOT),
    posts: readPostsDirectory(sitePath),
  };
}
