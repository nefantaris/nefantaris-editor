import { parse } from "yaml";

export type Frontmatter = Record<string, unknown>;

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function parseFrontmatter(text: string): Frontmatter {
  const withoutBom = text.startsWith("\u{FEFF}") ? text.slice(1) : text;
  const match = FRONTMATTER_PATTERN.exec(withoutBom);
  if (!match) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = parse(match[1]);
  } catch {
    return {};
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  return { ...parsed };
}

export function frontmatterTitle(
  frontmatter: Frontmatter,
  fallback: string,
): string {
  const title = frontmatter.title;
  if (typeof title === "string" && title.trim() !== "") {
    return title.trim();
  }
  return fallback;
}

export function frontmatterDate(frontmatter: Frontmatter): string | null {
  const date = frontmatter.date;
  if (typeof date === "string" && date.trim() !== "") {
    return date.trim();
  }
  if (date instanceof Date) {
    return date.toISOString().slice(0, 10);
  }
  return null;
}

export function frontmatterDraft(frontmatter: Frontmatter): boolean {
  return frontmatter.draft === true;
}
