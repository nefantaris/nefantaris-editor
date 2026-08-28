import { net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { hasOpenSite } from "./windows.cjs";

export const ASSET_SCHEME = "nefsite";

export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        supportFetchAPI: true,
      },
    },
  ]);
}

function resolveRequestedAsset(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const sitePath = url.searchParams.get("site");
  const assetPath = url.searchParams.get("file");
  if (!sitePath || !assetPath || !assetPath.startsWith("/assets/")) {
    return null;
  }
  if (!hasOpenSite(sitePath)) {
    return null;
  }
  const assetsRoot = path.join(path.resolve(sitePath), "assets");
  const resolved = path.resolve(assetsRoot, assetPath.slice("/assets/".length));
  if (!resolved.startsWith(assetsRoot + path.sep)) {
    return null;
  }
  return resolved;
}

export function registerAssetProtocolHandler(): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    const filePath = resolveRequestedAsset(request.url);
    if (!filePath) {
      return new Response(null, { status: 403 });
    }
    try {
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
