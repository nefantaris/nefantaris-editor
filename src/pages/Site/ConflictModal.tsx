import { MergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type {
  ConflictChoice,
  ConflictFileView,
  SyncPurpose,
} from "../../../electron/ipcContract.cts";
import ModalDialog from "../../components/ModalDialog.tsx";
import { classNames } from "../../utils/classNames.ts";

type ConflictModalProps = {
  purpose: SyncPurpose;
  files: ConflictFileView[];
  onFinish: (choices: ConflictChoice[]) => Promise<string | null>;
  onCancel: () => void;
};

type MergeDiffViewProps = {
  yoursText: string;
  onlineText: string;
};

function readOnlyExtensions() {
  return [
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
    EditorView.lineWrapping,
  ];
}

const MergeDiffView = ({ yoursText, onlineText }: MergeDiffViewProps) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const view = new MergeView({
      a: { doc: yoursText, extensions: readOnlyExtensions() },
      b: { doc: onlineText, extensions: readOnlyExtensions() },
      parent: host,
      gutter: false,
    });
    return () => view.destroy();
  }, [yoursText, onlineText]);

  return (
    <div
      ref={hostRef}
      className="border-brand-border max-h-72 overflow-y-auto rounded-md border text-sm"
    />
  );
};

function displayPath(relativePath: string): string {
  return relativePath.replace(/^content\//, "");
}

function fileDescription(file: ConflictFileView): string {
  if (!file.yours.exists) {
    return "You deleted this page here, but a newer version is online. Pick what to keep.";
  }
  if (!file.online.exists) {
    return "This page was deleted online, but you changed it here. Pick what to keep.";
  }
  if (file.yours.text === null || file.online.text === null) {
    return "This file changed both here and online. Pick the one to keep.";
  }
  return "You changed this page here, and a newer version is online. Pick the one to keep.";
}

const ConflictModal = ({
  purpose,
  files,
  onFinish,
  onCancel,
}: ConflictModalProps) => {
  const [choices, setChoices] = useState<Map<string, "yours" | "online">>(
    new Map(),
  );
  const [selectedPath, setSelectedPath] = useState(
    files[0]?.relativePath ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const selectedFile =
    files.find((file) => file.relativePath === selectedPath) ?? files[0];
  const isAllResolved = files.every((file) => choices.has(file.relativePath));
  const finishLabel =
    purpose === "publish" ? "Finish publishing" : "Finish update";

  const pickChoice = (relativePath: string, choice: "yours" | "online") => {
    setChoices((previous) => new Map(previous).set(relativePath, choice));
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    const payload: ConflictChoice[] = files.map((file) => ({
      relativePath: file.relativePath,
      choice: choices.get(file.relativePath) ?? "yours",
    }));
    setError(await onFinish(payload));
    setIsFinishing(false);
  };

  const choiceButton = (
    file: ConflictFileView,
    choice: "yours" | "online",
    label: string,
  ) => {
    const isPicked = choices.get(file.relativePath) === choice;
    return (
      <button
        aria-pressed={isPicked}
        onClick={() => pickChoice(file.relativePath, choice)}
        className={classNames(
          "rounded-md px-3 py-1 text-sm font-medium transition-colors duration-100",
          isPicked
            ? "bg-brand-primary text-brand-white"
            : "bg-brand-grayLight text-brand-grayDark hover:bg-brand-border",
        )}
      >
        {label}
      </button>
    );
  };

  const sidePanel = (side: ConflictFileView["yours"], deletedCopy: string) => {
    if (!side.exists) {
      return (
        <p className="border-brand-border text-brand-gray rounded-md border p-4 text-sm">
          {deletedCopy}
        </p>
      );
    }
    if (side.text === null) {
      return (
        <p className="border-brand-border text-brand-gray rounded-md border p-4 text-sm">
          This file can't be shown here.
        </p>
      );
    }
    return (
      <pre className="border-brand-border text-brand-black max-h-72 overflow-y-auto rounded-md border p-4 text-sm whitespace-pre-wrap">
        {side.text}
      </pre>
    );
  };

  return (
    <ModalDialog title="Choose what to keep" onClose={onCancel} size="wide">
      <p className="text-brand-grayDark text-sm">
        Some pages changed both here and online. For each one, pick the version
        to keep. Nothing changes until you finish.
      </p>
      <div className="flex min-h-0 gap-6">
        <ul
          aria-label="Pages to resolve"
          className="flex w-56 shrink-0 flex-col gap-1 self-start"
        >
          {files.map((file) => {
            const isSelected = file.relativePath === selectedFile?.relativePath;
            const isResolved = choices.has(file.relativePath);
            return (
              <li key={file.relativePath}>
                <button
                  onClick={() => setSelectedPath(file.relativePath)}
                  aria-current={isSelected ? "true" : undefined}
                  className={classNames(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-100",
                    isSelected
                      ? "bg-brand-grayLight text-brand-black font-medium"
                      : "text-brand-grayDark hover:bg-brand-grayLight",
                  )}
                >
                  <span className="truncate">
                    {displayPath(file.relativePath)}
                  </span>
                  {isResolved && (
                    <span aria-label="Resolved" className="text-brand-success">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {selectedFile && (
          <div className="flex min-w-0 grow flex-col gap-3">
            <p className="text-brand-grayDark text-sm">
              {fileDescription(selectedFile)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-brand-gray text-xs font-semibold tracking-wide uppercase">
                  Your version
                </span>
                {choiceButton(selectedFile, "yours", "Keep yours")}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-brand-gray text-xs font-semibold tracking-wide uppercase">
                  Online version
                </span>
                {choiceButton(selectedFile, "online", "Keep online version")}
              </div>
            </div>
            {selectedFile.yours.text !== null &&
            selectedFile.online.text !== null ? (
              <MergeDiffView
                key={selectedFile.relativePath}
                yoursText={selectedFile.yours.text}
                onlineText={selectedFile.online.text}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sidePanel(selectedFile.yours, "You deleted this page here.")}
                {sidePanel(
                  selectedFile.online,
                  "This page was deleted online.",
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-brand-danger text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => void handleFinish()}
          disabled={!isAllResolved || isFinishing}
          className="bg-brand-primary text-brand-white hover:bg-brand-primaryHover disabled:bg-brand-disabled grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:order-2 sm:w-0"
        >
          {isFinishing ? "Finishing…" : finishLabel}
        </button>
        <button
          onClick={onCancel}
          className="bg-brand-grayLight text-brand-grayDark hover:bg-brand-border grow justify-center rounded-md py-3 font-medium transition-colors duration-100 sm:w-0"
        >
          Cancel
        </button>
      </div>
    </ModalDialog>
  );
};

export default ConflictModal;
