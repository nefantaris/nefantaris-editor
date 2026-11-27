import path from "node:path";

export function resolveInside(
  basePath: string,
  relativePath: string,
  allowedRoot: string,
): string {
  const absolute = path.resolve(basePath, relativePath);
  const root = path.resolve(basePath, allowedRoot);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new Error(`Path escapes ${allowedRoot}: ${relativePath}`);
  }
  return absolute;
}
