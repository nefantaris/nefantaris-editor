import {
  deriveFrontmatterFields,
  frontmatterYamlFromText,
} from "./frontmatterEditing.ts";

export type PreviewTarget =
  { kind: "route"; route: string } | { kind: "draft" };

const PAGES_PREFIX = "content/pages/";
const POSTS_PREFIX = "content/posts/";

function trimSlashes(value: string): string {
  return value.replaceAll(/^\/+|\/+$/g, "");
}

function pageRouteFromPath(relativePath: string): string {
  const segments = relativePath.slice(PAGES_PREFIX.length, -3).split("/");
  if (segments.at(-1) === "index") {
    segments.pop();
  }
  return `/${segments.join("/")}`;
}

export function previewTargetForFile(
  relativePath: string,
  text: string,
): PreviewTarget {
  const isPost = relativePath.startsWith(POSTS_PREFIX);
  const fields = deriveFrontmatterFields(
    frontmatterYamlFromText(text),
    isPost ? "post" : "page",
  );
  if (fields.isDraft) {
    return { kind: "draft" };
  }
  const slug = trimSlashes(fields.slug);
  if (isPost) {
    const stem = relativePath.slice(POSTS_PREFIX.length, -3);
    return { kind: "route", route: `/blog/${slug === "" ? stem : slug}` };
  }
  return {
    kind: "route",
    route: slug === "" ? pageRouteFromPath(relativePath) : `/${slug}`,
  };
}
