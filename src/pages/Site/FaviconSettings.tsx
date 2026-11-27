import { useEffect, useRef, useState } from "react";
import type { SiteFavicon } from "../../../electron/ipcContract.cts";
import { siteAssetUrl } from "./livePreview/assetUrl.ts";
import { secondaryButtonClasses } from "./settingsStyles.ts";

type FaviconSettingsProps = {
  sitePath: string;
};

const FAVICON_TYPES =
  "image/svg+xml,image/png,image/webp,image/x-icon,image/vnd.microsoft.icon";

const FaviconSettings = ({ sitePath }: FaviconSettingsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [favicon, setFavicon] = useState<SiteFavicon | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  const replaceFavicon = async (file: File | undefined) => {
    if (file === undefined) {
      return;
    }
    const result = await globalThis.nefantaris.invoke(
      "siteFiles:setFavicon",
      sitePath,
      file.name,
      file.type,
      new Uint8Array(await file.arrayBuffer()),
    );
    if (result.status === "failed") {
      setError("Use an SVG, PNG, WebP, or ICO picture for the icon.");
      return;
    }
    setError(null);
    setFavicon(result.favicon);
  };

  useEffect(() => {
    const loadFavicon = async () => {
      setFavicon(
        await globalThis.nefantaris.invoke("siteFiles:getFavicon", sitePath),
      );
    };
    void loadFavicon();
    return globalThis.nefantaris.on("siteFiles:changed", (payload) => {
      if (payload.sitePath === sitePath) {
        void loadFavicon();
      }
    });
  }, [sitePath]);

  return (
    <div className="flex flex-col gap-3">
      {favicon === null && (
        <p className="text-ink-muted text-sm">
          Your site uses your theme&rsquo;s standard icon.
        </p>
      )}
      {favicon && (
        <div className="flex items-center gap-3">
          <img
            src={`${siteAssetUrl(sitePath, `/${favicon.fileName}`)}&v=${favicon.modifiedAtMs}`}
            alt="Current site icon"
            className="bg-sunken border-line h-12 w-12 rounded-md border object-contain p-1"
          />
          <span className="text-ink-secondary text-sm">{favicon.fileName}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={secondaryButtonClasses}
        >
          {favicon ? "Replace icon" : "Choose an icon"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={FAVICON_TYPES}
          tabIndex={-1}
          aria-hidden="true"
          data-testid="favicon-file"
          onChange={(event) => {
            void replaceFavicon(event.target.files?.[0]);
            event.target.value = "";
          }}
          className="hidden"
        />
      </div>
      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
};

export default FaviconSettings;
