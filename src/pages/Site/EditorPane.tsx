import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { SiteInspection } from "../../../electron/ipcContract.cts";
import type { EditorPaneControl } from "./contentTypes.ts";
import { insertDirectiveBlock } from "./directiveInsert.ts";
import {
  createEditorExtensions,
  detectLineSeparator,
} from "./editorExtensions.ts";
import type { ContentFileKind, FrontmatterEdit } from "./frontmatterEditing.ts";
import {
  applyFrontmatterEdit,
  frontmatterYamlFromState,
  frontmatterYamlFromText,
  isFrontmatterEditable,
} from "./frontmatterEditing.ts";
import {
  frontmatterBodyStart,
  frontmatterHiding,
  trustedDocChange,
} from "./frontmatterHiding.ts";
import FrontmatterPanel from "./FrontmatterPanel.tsx";
import InsertDirectiveModal from "./InsertDirectiveModal.tsx";
import { computeFrontmatter } from "./livePreview/documentRegions.ts";

const AUTOSAVE_DELAY_MS = 500;

type EditorPaneProps = {
  sitePath: string;
  relativePath: string;
  diskText: string;
  inspection: SiteInspection | null;
  isFrontmatterFormOpen: boolean;
  onFrontmatterFormOpenChanged: (isOpen: boolean) => void;
  controlRef: RefObject<EditorPaneControl | null>;
  onDirtyChanged: (isDirty: boolean) => void;
};

function baseNameForImage(file: File): string {
  const stem = file.name.replace(/\.[^.]*$/, "");
  return stem === "" || stem.toLowerCase() === "image" ? "pasted-image" : stem;
}

const EditorPane = ({
  sitePath,
  relativePath,
  diskText,
  inspection,
  isFrontmatterFormOpen,
  onFrontmatterFormOpenChanged,
  controlRef,
  onDirtyChanged,
}: EditorPaneProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const savedTextRef = useRef(diskText);
  const saveTimerRef = useRef<number | null>(null);
  const isCancelledRef = useRef(false);
  const hidingCompartmentRef = useRef(new Compartment());
  const [frontmatterYaml, setFrontmatterYaml] = useState<string | null>(() =>
    frontmatterYamlFromText(diskText),
  );
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const fileKind: ContentFileKind = relativePath.startsWith("content/posts/")
    ? "post"
    : "page";
  const isHidingActive =
    isFrontmatterFormOpen && isFrontmatterEditable(frontmatterYaml);
  const directives = inspection?.directives ?? [];

  const handleFieldEdit = (edit: FrontmatterEdit) => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const nextYaml = applyFrontmatterEdit(
      frontmatterYamlFromState(view.state),
      edit,
    );
    if (nextYaml === null) {
      return;
    }
    const separator = view.state.lineBreak;
    const yamlLines =
      nextYaml === "" ? [] : nextYaml.replace(/\n$/, "").split("\n");
    const block = ["---", ...yamlLines, "---"].join(separator);
    const region = computeFrontmatter(view.state.doc);
    view.dispatch({
      changes: region
        ? { from: region.from, to: region.to, insert: block }
        : { from: 0, insert: block + separator },
      annotations: trustedDocChange.of(true),
    });
  };

  const focusEditorAfterPaletteCloses = () => {
    globalThis.setTimeout(() => viewRef.current?.focus(), 0);
  };

  const handleDirectivePicked = (name: string) => {
    setIsPaletteOpen(false);
    const view = viewRef.current;
    if (!view) {
      return;
    }
    insertDirectiveBlock(view, name);
    focusEditorAfterPaletteCloses();
  };

  const closePalette = () => {
    setIsPaletteOpen(false);
    focusEditorAfterPaletteCloses();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const currentText = () =>
      viewRef.current?.state.sliceDoc() ?? savedTextRef.current;

    const reportDirty = () => {
      onDirtyChanged(currentText() !== savedTextRef.current);
    };

    const clearSaveTimer = () => {
      if (saveTimerRef.current === null) {
        return;
      }
      globalThis.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };

    const flush = async () => {
      clearSaveTimer();
      if (isCancelledRef.current) {
        return;
      }
      const text = currentText();
      if (text === savedTextRef.current) {
        return;
      }
      savedTextRef.current = text;
      await globalThis.nefantaris.invoke(
        "content:writeFile",
        sitePath,
        relativePath,
        text,
      );
      reportDirty();
    };

    const scheduleSave = () => {
      clearSaveTimer();
      saveTimerRef.current = globalThis.setTimeout(() => {
        saveTimerRef.current = null;
        void flush();
      }, AUTOSAVE_DELAY_MS);
    };

    const refreshFrontmatter = () => {
      const state = viewRef.current?.state;
      if (state) {
        setFrontmatterYaml(frontmatterYamlFromState(state));
      }
    };

    const insertImage = async (view: EditorView, file: File, pos: number) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await globalThis.nefantaris.invoke(
        "content:saveAsset",
        sitePath,
        file.type,
        baseNameForImage(file),
        bytes,
      );
      if (result.status !== "saved") {
        return;
      }
      const insertAt = Math.min(pos, view.state.doc.length);
      const reference = `![](${result.markdownPath})`;
      view.dispatch({
        changes: { from: insertAt, insert: reference },
        selection: { anchor: insertAt + reference.length },
      });
      view.focus();
    };

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: diskText,
        extensions: [
          createEditorExtensions({
            sitePath,
            lineSeparator: detectLineSeparator(diskText),
            onDocChanged: () => {
              reportDirty();
              scheduleSave();
              refreshFrontmatter();
            },
            onImageFile: (imageView, file, pos) => {
              void insertImage(imageView, file, pos);
            },
            onInsertDirectiveRequested: () => setIsPaletteOpen(true),
          }),
          hidingCompartmentRef.current.of(
            isHidingActive ? frontmatterHiding : [],
          ),
        ],
      }),
    });
    viewRef.current = view;
    view.focus();
    if (isHidingActive) {
      const bodyStart = frontmatterBodyStart(view.state);
      if (bodyStart > 0) {
        view.dispatch({ selection: { anchor: bodyStart } });
      }
    }

    const flushOnWindowEvent = () => {
      void flush();
    };
    globalThis.addEventListener("blur", flushOnWindowEvent);
    globalThis.addEventListener("beforeunload", flushOnWindowEvent);

    controlRef.current = {
      flush,
      cancelPendingSave: () => {
        isCancelledRef.current = true;
        clearSaveTimer();
      },
    };

    return () => {
      globalThis.removeEventListener("blur", flushOnWindowEvent);
      globalThis.removeEventListener("beforeunload", flushOnWindowEvent);
      controlRef.current = null;
      void flush();
      viewRef.current = null;
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: hidingCompartmentRef.current.reconfigure(
        isHidingActive ? frontmatterHiding : [],
      ),
    });
    if (isHidingActive) {
      const bodyStart = frontmatterBodyStart(view.state);
      if (view.state.selection.main.from < bodyStart) {
        view.dispatch({ selection: { anchor: bodyStart } });
      }
    }
  }, [isHidingActive]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || diskText === savedTextRef.current) {
      return;
    }
    if (view.state.sliceDoc() !== savedTextRef.current) {
      return;
    }
    savedTextRef.current = diskText;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: diskText },
      annotations: trustedDocChange.of(true),
    });
    onDirtyChanged(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diskText]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FrontmatterPanel
        fileKind={fileKind}
        frontmatterYaml={frontmatterYaml}
        templates={inspection ? inspection.templates : null}
        isOpen={isFrontmatterFormOpen}
        onOpenChanged={onFrontmatterFormOpenChanged}
        onEdit={handleFieldEdit}
        onInsertRequested={() => setIsPaletteOpen(true)}
        hasInsertableBlocks={directives.length > 0}
      />
      <div ref={hostRef} className="min-h-0 grow" />
      {isPaletteOpen && (
        <InsertDirectiveModal
          directives={directives}
          onPicked={handleDirectivePicked}
          onClose={closePalette}
        />
      )}
    </div>
  );
};

export default EditorPane;
