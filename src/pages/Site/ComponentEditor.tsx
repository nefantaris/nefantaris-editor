import { useEffect, useState, type RefObject } from "react";
import type { ComponentOverrideState } from "../../../electron/ipcContract.cts";
import { ArrowLeftIcon } from "../../components/Icons.tsx";
import StatusDot from "../../components/StatusDot.tsx";
import CodeFileEditor from "./CodeFileEditor.tsx";
import { codeLanguageOf } from "./codeEditor/codeLanguages.ts";
import type { EditorPaneControl } from "./contentTypes.ts";
import {
  backButtonClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./settingsStyles.ts";

type ComponentEditorProps = {
  sitePath: string;
  filePath: string;
  label: string;
  overrideState: ComponentOverrideState | null;
  controlRef: RefObject<EditorPaneControl | null>;
  onDirtyChanged: (isDirty: boolean) => void;
  onBackRequested: () => void;
  onResetRequested: () => void;
  onCompareRequested: () => void;
  onKeepMineRequested: () => void;
  onUseThemeRequested: () => void;
};

type LoadedFile =
  | { status: "loading" }
  | { status: "missing" }
  | {
      status: "ok";
      text: string;
    };

const ComponentEditor = ({
  sitePath,
  filePath,
  label,
  overrideState,
  controlRef,
  onDirtyChanged,
  onBackRequested,
  onResetRequested,
  onCompareRequested,
  onKeepMineRequested,
  onUseThemeRequested,
}: ComponentEditorProps) => {
  const [file, setFile] = useState<LoadedFile>({ status: "loading" });

  const language = codeLanguageOf(filePath);

  const save = async (text: string) => {
    await globalThis.nefantaris.invoke(
      "components:write",
      sitePath,
      filePath,
      text,
    );
  };

  useEffect(() => {
    const readFile = async () => {
      setFile(
        await globalThis.nefantaris.invoke(
          "components:read",
          sitePath,
          filePath,
        ),
      );
    };
    void readFile();
    return globalThis.nefantaris.on("components:changed", (payload) => {
      if (payload.sitePath === sitePath) {
        void readFile();
      }
    });
  }, [sitePath, filePath]);

  return (
    <div className="flex min-h-0 grow flex-col gap-3 px-6 pt-4 pb-6">
      <button
        type="button"
        onClick={onBackRequested}
        className={backButtonClasses}
      >
        <ArrowLeftIcon />
        All components
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-ink text-lg font-medium">{label}</h2>
            <span className="text-ink-secondary flex items-center gap-1.5 text-xs">
              <StatusDot tone="progress" />
              Customized
            </span>
          </div>
          <p className="text-ink-muted truncate font-mono text-xs">
            child-theme/{filePath}
          </p>
        </div>
        <button
          type="button"
          onClick={onResetRequested}
          className={secondaryButtonClasses}
        >
          Reset to theme
        </button>
      </div>
      {overrideState === "theme-changed" && (
        <div
          role="status"
          className="border-line bg-sunken flex flex-col gap-3 rounded-md border p-4 text-sm"
        >
          <p className="text-ink font-medium">
            The theme changed this file since you customized it.
          </p>
          <p className="text-ink-secondary">
            Compare the two to see what&rsquo;s new. Keep yours, switch to the
            theme&rsquo;s new version, or bring its changes into yours by hand.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCompareRequested}
              className={primaryButtonClasses}
            >
              Compare
            </button>
            <button
              type="button"
              onClick={onKeepMineRequested}
              className={secondaryButtonClasses}
            >
              Keep mine
            </button>
            <button
              type="button"
              onClick={onUseThemeRequested}
              className={secondaryButtonClasses}
            >
              Use the theme&rsquo;s new version
            </button>
          </div>
        </div>
      )}
      <div className="border-line focus-within:ring-primary min-h-0 grow overflow-hidden rounded-md border focus-within:ring-2">
        {file.status === "loading" && (
          <p className="text-ink-muted p-4 text-sm">Opening the file…</p>
        )}
        {file.status === "missing" && (
          <p role="status" className="text-ink-secondary p-4 text-sm">
            This file isn&rsquo;t customized any more, so your site uses the
            theme&rsquo;s version.
          </p>
        )}
        {file.status === "ok" && language !== null && (
          <CodeFileEditor
            key={filePath}
            label={label}
            language={language}
            diskText={file.text}
            controlRef={controlRef}
            onSave={save}
            onDirtyChanged={onDirtyChanged}
          />
        )}
      </div>
    </div>
  );
};

export default ComponentEditor;
