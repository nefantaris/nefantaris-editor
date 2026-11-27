import { useEffect, useState, type RefObject } from "react";
import type {
  ComponentListing,
  CustomizeComponentResult,
  SiteInspection,
} from "../../../electron/ipcContract.cts";
import ComponentComparison from "./ComponentComparison.tsx";
import ComponentEditor from "./ComponentEditor.tsx";
import ComponentRow from "./ComponentRow.tsx";
import { componentGroupsFrom, componentLabelFor } from "./componentsModel.ts";
import type { EditorPaneControl } from "./contentTypes.ts";
import ResetComponentModal, { type ResetKind } from "./ResetComponentModal.tsx";
import SettingsSection from "./SettingsSection.tsx";
import { secondaryButtonClasses } from "./settingsStyles.ts";

type ComponentsTabProps = {
  sitePath: string;
  inspection: SiteInspection | null;
  controlRef: RefObject<EditorPaneControl | null>;
  onDirtyChanged: (isDirty: boolean) => void;
};

type ComponentsView =
  | { kind: "list" }
  | { kind: "edit"; path: string }
  | { kind: "compare"; path: string };

type PendingReset = { path: string; kind: ResetKind };

function customizeFailureMessage(
  result: Extract<CustomizeComponentResult, { status: "failed" }>,
): string {
  switch (result.reason) {
    case "theme-unavailable": {
      return "Your theme couldn’t be read right now, so this file can’t be customized. Check that the preview starts, then try again.";
    }
    case "not-a-theme-file": {
      return "This file isn’t one your theme has any more, so it can’t be customized.";
    }
    case "already-customized": {
      return "This file is already customized.";
    }
  }
}

const ComponentsTab = ({
  sitePath,
  inspection,
  controlRef,
  onDirtyChanged,
}: ComponentsTabProps) => {
  const [listing, setListing] = useState<ComponentListing | null>(null);
  const [view, setView] = useState<ComponentsView>({ kind: "list" });
  const [customizingPath, setCustomizingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingReset, setPendingReset] = useState<PendingReset | null>(null);

  const groups =
    listing?.status === "ok" ? componentGroupsFrom(listing, inspection) : [];
  const overrideStateOf = (filePath: string) =>
    listing?.status === "ok"
      ? (listing.overrides.find((override) => override.path === filePath)
          ?.state ?? null)
      : null;
  const labelOf = (filePath: string) => componentLabelFor(filePath, inspection);

  const loadListing = async () => {
    setListing(await globalThis.nefantaris.invoke("components:list", sitePath));
  };

  const customize = async (filePath: string) => {
    setCustomizingPath(filePath);
    setError(null);
    const result = await globalThis.nefantaris.invoke(
      "components:customize",
      sitePath,
      filePath,
    );
    setCustomizingPath(null);
    if (result.status === "failed") {
      setError(customizeFailureMessage(result));
      return;
    }
    await loadListing();
    setView({ kind: "edit", path: filePath });
  };

  const confirmReset = async () => {
    if (pendingReset === null) {
      return;
    }
    controlRef.current?.cancelPendingSave();
    await globalThis.nefantaris.invoke(
      "components:reset",
      sitePath,
      pendingReset.path,
    );
    setPendingReset(null);
    onDirtyChanged(false);
    setView({ kind: "list" });
    await loadListing();
  };

  const keepMine = async (filePath: string) => {
    await controlRef.current?.flush();
    await globalThis.nefantaris.invoke(
      "components:keepMine",
      sitePath,
      filePath,
    );
    await loadListing();
    setView({ kind: "edit", path: filePath });
  };

  const showList = async () => {
    await controlRef.current?.flush();
    setView({ kind: "list" });
  };

  useEffect(() => {
    const reloadListing = async () => {
      setListing(
        await globalThis.nefantaris.invoke("components:list", sitePath),
      );
    };
    void reloadListing();
    const stopWatching = globalThis.nefantaris.on(
      "components:changed",
      (payload) => {
        if (payload.sitePath === sitePath) {
          void reloadListing();
        }
      },
    );
    const reloadOnFocus = () => {
      void reloadListing();
    };
    globalThis.addEventListener("focus", reloadOnFocus);
    return () => {
      stopWatching();
      globalThis.removeEventListener("focus", reloadOnFocus);
    };
  }, [sitePath]);

  return (
    <>
      {view.kind === "edit" && (
        <ComponentEditor
          key={view.path}
          sitePath={sitePath}
          filePath={view.path}
          label={labelOf(view.path)}
          overrideState={overrideStateOf(view.path)}
          controlRef={controlRef}
          onDirtyChanged={onDirtyChanged}
          onBackRequested={() => void showList()}
          onResetRequested={() =>
            setPendingReset({ path: view.path, kind: "reset" })
          }
          onCompareRequested={() =>
            setView({ kind: "compare", path: view.path })
          }
          onKeepMineRequested={() => void keepMine(view.path)}
          onUseThemeRequested={() =>
            setPendingReset({ path: view.path, kind: "useTheme" })
          }
        />
      )}
      {view.kind === "compare" && (
        <ComponentComparison
          key={view.path}
          sitePath={sitePath}
          filePath={view.path}
          label={labelOf(view.path)}
          controlRef={controlRef}
          onDirtyChanged={onDirtyChanged}
          onBackRequested={() => setView({ kind: "edit", path: view.path })}
          onKeepMineRequested={() => void keepMine(view.path)}
          onUseThemeRequested={() =>
            setPendingReset({ path: view.path, kind: "useTheme" })
          }
        />
      )}
      {view.kind === "list" && (
        <div className="min-h-0 grow overflow-y-auto">
          <div className="flex flex-col gap-6 px-6 pt-4 pb-6">
            <div
              role="note"
              className="border-line bg-sunken flex flex-col gap-1 rounded-md border p-4 text-sm"
            >
              <p className="text-ink font-medium">
                This is code, and a mistake here can break your site.
              </p>
              <p className="text-ink-secondary">
                Customize makes your own copy of one of your theme&rsquo;s
                files. Your copy is used instead of the theme&rsquo;s, and Reset
                to theme always brings back the theme&rsquo;s version.
              </p>
            </div>
            {error !== null && (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            )}
            {listing === null && (
              <p className="text-ink-muted text-sm">
                Looking at your theme&rsquo;s files…
              </p>
            )}
            {listing?.status === "unavailable" && (
              <div className="flex flex-col items-start gap-3">
                <p role="status" className="text-ink-secondary text-sm">
                  Your theme couldn&rsquo;t be read right now, so its files
                  can&rsquo;t be shown. Check that the preview starts, then try
                  again.
                </p>
                <button
                  type="button"
                  onClick={() => void loadListing()}
                  className={secondaryButtonClasses}
                >
                  Check again
                </button>
              </div>
            )}
            {groups.map((group) => (
              <SettingsSection
                key={group.id}
                title={group.title}
                description={group.description}
              >
                <ul className="flex flex-col gap-2">
                  {group.entries.map((entry) => (
                    <ComponentRow
                      key={entry.path}
                      entry={entry}
                      isBusy={customizingPath !== null}
                      onCustomizeRequested={() => void customize(entry.path)}
                      onEditRequested={() =>
                        setView({ kind: "edit", path: entry.path })
                      }
                    />
                  ))}
                </ul>
              </SettingsSection>
            ))}
          </div>
        </div>
      )}
      {pendingReset !== null && (
        <ResetComponentModal
          kind={pendingReset.kind}
          label={labelOf(pendingReset.path)}
          onConfirm={() => void confirmReset()}
          onClose={() => setPendingReset(null)}
        />
      )}
    </>
  );
};

export default ComponentsTab;
