const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function protocolOf(value: string): string | null {
  try {
    return new URL(value).protocol;
  } catch {
    return null;
  }
}

function isSitePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

export function isSitePathOrHttpsUrl(value: string): boolean {
  return isSitePath(value) || protocolOf(value) === "https:";
}

export function isRouteOrUrl(value: string): boolean {
  return isSitePath(value) || LINK_PROTOCOLS.has(protocolOf(value) ?? "");
}
