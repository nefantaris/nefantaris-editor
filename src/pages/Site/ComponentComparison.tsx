import { MergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import type { ComponentComparison as Comparison } from "../../../electron/ipcContract.cts";
import { ArrowLeftIcon } from "../../components/Icons.tsx";
import { codeEditing, readOnlyCode } from "./codeEditor/codeEditing.ts";
import type { CodeLanguage } from "./codeEditor/codeLanguages.ts";
import { codeLanguageOf } from "./codeEditor/codeLanguages.ts";
import { useDocumentAutosave } from "./codeEditor/useDocumentAutosave.ts";
import type { EditorPaneControl } from "./contentTypes.ts";
import {
  backButtonClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from "./settingsStyles.ts";

type ComparisonMode = "theme-and-mine" | "theme-changes" | "my-changes";

type ComponentComparisonProps = {
  sitePath: string;
  filePath: string;
  label: string;
  controlRef: RefObject<EditorPaneControl | null>;
  onDirtyChanged: (isDirty: boolean) => void;
  onBackRequested: () => void;
  onKeepMineRequested: () => void;
  onUseThemeRequested: () => void;
};

type LoadedComparison = Extract<Comparison, { status: "ok" }>;

type ComparisonSides = {
  left: { title: string; text: string };
  right: { title: string; text: string };
  isEditable: boolean;
};

const modeChoices: { mode: ComparisonMode; label: string }[] = [
  { mode: "theme-and-mine", label: "The theme’s new version and yours" },
  { mode: "theme-changes", label: "What the theme changed" },
  { mode: "my-changes", label: "What you changed" },
];

const REVERT_PHRASE = "Use the theme’s version of this part";

function versionNote(version: string | null): string {
  return version === null || version === "local" ? "" : ` (${version})`;
}

function sidesFor(
  comparison: LoadedComparison,
  mode: ComparisonMode,
): ComparisonSides | null {
  const original = comparison.original;
  const themeTitle = `The theme’s new version${versionNote(comparison.themeVersion)}`;
  const originalTitle = `When you customized it${versionNote(comparison.customizedFromVersion)}`;
  if (mode === "theme-and-mine") {
    return comparison.theme === null
      ? null
      : {
          left: { title: themeTitle, text: comparison.theme },
          right: { title: "Yours", text: comparison.mine },
          isEditable: true,
        };
  }
  if (original === null) {
    return null;
  }
  if (mode === "theme-changes") {
    return comparison.theme === null
      ? null
      : {
          left: { title: originalTitle, text: original },
          right: { title: themeTitle, text: comparison.theme },
          isEditable: false,
        };
  }
  return {
    left: { title: originalTitle, text: original },
    right: { title: "Yours", text: comparison.mine },
    isEditable: false,
  };
}

const ComponentComparison = ({
  sitePath,
  filePath,
  label,
  controlRef,
  onDirtyChanged,
  onBackRequested,
  onKeepMineRequested,
  onUseThemeRequested,
}: ComponentComparisonProps) => {
  const modeLabelId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [mode, setMode] = useState<ComparisonMode>("theme-and-mine");

  const save = async (text: string) => {
    await globalThis.nefantaris.invoke(
      "components:write",
      sitePath,
      filePath,
      text,
    );
  };

  const autosave = useDocumentAutosave("", save, onDirtyChanged);
  const language: CodeLanguage = codeLanguageOf(filePath) ?? "tsx";
  const loaded = comparison?.status === "ok" ? comparison : null;
  const sides = loaded === null ? null : sidesFor(loaded, mode);
  const hasOriginal = loaded !== null && loaded.original !== null;

  const loadComparison = async () => {
    setComparison(
      await globalThis.nefantaris.invoke(
        "components:compare",
        sitePath,
        filePath,
      ),
    );
  };

  const changeMode = async (next: ComparisonMode) => {
    await autosave.flush();
    await loadComparison();
    setMode(next);
  };

  useEffect(() => {
    const loadFirstComparison = async () => {
      setComparison(
        await globalThis.nefantaris.invoke(
          "components:compare",
          sitePath,
          filePath,
        ),
      );
    };
    void loadFirstComparison();
  }, [sitePath, filePath]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || sides === null) {
      return;
    }
    autosave.markSaved(sides.right.text);
    const view = new MergeView({
      a: {
        doc: sides.left.text,
        extensions: [
          readOnlyCode(language, sides.left.title),
          EditorView.lineWrapping,
          EditorState.phrases.of({ "Revert this chunk": REVERT_PHRASE }),
        ],
      },
      b: {
        doc: sides.right.text,
        extensions: [
          EditorView.lineWrapping,
          sides.isEditable
            ? [
                codeEditing(language, sides.right.title),
                autosave.createListener(),
              ]
            : readOnlyCode(language, sides.right.title),
        ],
      },
      parent: host,
      revertControls: sides.isEditable ? "a-to-b" : undefined,
      collapseUnchanged: { margin: 3, minSize: 6 },
    });
    if (sides.isEditable) {
      autosave.attach(view.b);
      controlRef.current = {
        flush: autosave.flush,
        cancelPendingSave: autosave.cancel,
      };
    }
    return () => {
      void autosave.flush();
      autosave.attach(null);
      controlRef.current = null;
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparison, mode]);

  return (
    <div className="flex min-h-0 grow flex-col gap-3 px-6 pt-4 pb-6">
      <button
        type="button"
        onClick={onBackRequested}
        className={backButtonClasses}
      >
        <ArrowLeftIcon />
        Back to {label}
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-ink text-lg font-medium">
            What changed in {label}
          </h2>
          <p className="text-ink-muted text-sm">
            Your version is on the right and saves as you type. Use the arrows
            to bring one of the theme&rsquo;s changes into yours.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onKeepMineRequested}
            className={primaryButtonClasses}
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
      <div className="flex flex-wrap items-center gap-2">
        <span id={modeLabelId} className="text-ink-secondary text-sm">
          Show
        </span>
        <div
          role="group"
          aria-labelledby={modeLabelId}
          className="flex flex-wrap gap-1"
        >
          {modeChoices.map((choice) => (
            <button
              key={choice.mode}
              type="button"
              aria-pressed={mode === choice.mode}
              disabled={choice.mode !== "theme-and-mine" && !hasOriginal}
              onClick={() => void changeMode(choice.mode)}
              className={
                mode === choice.mode
                  ? "bg-primary text-on-primary rounded-md px-3 py-1.5 text-sm font-medium"
                  : secondaryButtonClasses
              }
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
      {comparison?.status === "missing" && (
        <p role="status" className="text-ink-secondary text-sm">
          This file isn&rsquo;t customized any more.
        </p>
      )}
      {loaded !== null && sides === null && (
        <p role="status" className="text-ink-secondary text-sm">
          {loaded.theme === null
            ? "Your theme no longer has this file, so there’s nothing to compare."
            : "The copy from when you customized this file is missing, so only the theme’s new version and yours can be compared."}
        </p>
      )}
      {sides !== null && (
        <div className="grid grid-cols-2 gap-3 text-sm font-medium">
          <p className="text-ink-secondary">{sides.left.title}</p>
          <p className="text-ink-secondary">{sides.right.title}</p>
        </div>
      )}
      <div
        ref={hostRef}
        className="border-line min-h-0 grow overflow-auto rounded-md border"
      />
    </div>
  );
};

export default ComponentComparison;
