import { useEffect, useState } from "react";
import type { SiteVersion } from "../../../electron/ipcContract.cts";
import ModalDialog from "../../components/ModalDialog.tsx";
import { relativeTimeFrom } from "../../utils/relativeTime.ts";

type VersionsModalProps = {
  sitePath: string;
  onClose: () => void;
};

const VersionsModal = ({ sitePath, onClose }: VersionsModalProps) => {
  const [versions, setVersions] = useState<SiteVersion[] | null>(null);

  useEffect(() => {
    const loadVersions = async () => {
      setVersions(
        await globalThis.nefantaris.invoke("versions:list", sitePath),
      );
    };
    void loadVersions();
  }, [sitePath]);

  return (
    <ModalDialog title="Versions" onClose={onClose}>
      {versions === null ? (
        <p className="text-ink-muted text-sm">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="text-ink-muted text-sm">
          No versions yet. Publish your site to create the first one.
        </p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {versions.map((version) => {
            const absoluteDate = new Date(version.timestampMs).toLocaleString();
            return (
              <li
                key={version.oid}
                className="bg-sunken flex flex-col gap-1 rounded-md p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink text-sm font-medium">
                    {version.isUpdateMerge
                      ? "Update from online"
                      : version.summary}
                  </span>
                  <span
                    title={absoluteDate}
                    className="text-ink-muted shrink-0 text-xs tabular-nums"
                  >
                    {relativeTimeFrom(version.timestampMs)}
                  </span>
                </div>
                {version.note && (
                  <p className="text-ink-secondary text-sm">{version.note}</p>
                )}
                <p className="text-ink-muted text-xs tabular-nums">
                  {version.authorName} · {absoluteDate}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <button
        onClick={onClose}
        className="bg-raised text-ink-secondary hover:bg-raised-strong justify-center self-end rounded-md px-4 py-2 font-medium transition-colors duration-100"
      >
        Close
      </button>
    </ModalDialog>
  );
};

export default VersionsModal;
