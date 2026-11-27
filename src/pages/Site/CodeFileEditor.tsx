import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef, type RefObject } from "react";
import { codeEditing } from "./codeEditor/codeEditing.ts";
import type { CodeLanguage } from "./codeEditor/codeLanguages.ts";
import type { LineNote } from "./codeEditor/codeLint.ts";
import { setLineNotes } from "./codeEditor/codeLint.ts";
import type { StyleVocabulary } from "./codeEditor/cssCompletions.ts";
import { styleVocabularyExtension } from "./codeEditor/cssCompletions.ts";
import type { SaveGuard } from "./codeEditor/useDocumentAutosave.ts";
import { useDocumentAutosave } from "./codeEditor/useDocumentAutosave.ts";
import type { EditorPaneControl } from "./contentTypes.ts";

type CodeFileEditorProps = {
  label: string;
  language: CodeLanguage;
  diskText: string;
  initialDraft?: string | null;
  saveGuard?: SaveGuard | null;
  styleVocabulary?: StyleVocabulary | null;
  notes?: LineNote[];
  controlRef: RefObject<EditorPaneControl | null>;
  onSave: (text: string) => Promise<void>;
  onDirtyChanged: (isDirty: boolean) => void;
};

const CodeFileEditor = ({
  label,
  language,
  diskText,
  initialDraft = null,
  saveGuard = null,
  styleVocabulary = null,
  notes,
  controlRef,
  onSave,
  onDirtyChanged,
}: CodeFileEditorProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const vocabularyCompartmentRef = useRef(new Compartment());
  const autosave = useDocumentAutosave(
    diskText,
    onSave,
    onDirtyChanged,
    saveGuard,
  );

  const vocabularyTokens = styleVocabulary?.tokens;
  const vocabularyParts = styleVocabulary?.parts;
  const vocabularySettings = styleVocabulary?.settings;

  const vocabularyFor = (vocabulary: StyleVocabulary | null) =>
    language === "css" ? styleVocabularyExtension(vocabulary) : [];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialDraft ?? diskText,
        extensions: [
          codeEditing(language, label),
          vocabularyCompartmentRef.current.of(vocabularyFor(styleVocabulary)),
          autosave.createListener(),
        ],
      }),
    });
    viewRef.current = view;
    autosave.attach(view);
    controlRef.current = {
      flush: autosave.flush,
      cancelPendingSave: autosave.cancel,
    };
    if (initialDraft !== null && initialDraft !== diskText) {
      onDirtyChanged(true);
      void autosave.flush();
    }
    const flushOnWindowEvent = () => {
      void autosave.flush();
    };
    globalThis.addEventListener("blur", flushOnWindowEvent);
    globalThis.addEventListener("beforeunload", flushOnWindowEvent);
    return () => {
      globalThis.removeEventListener("blur", flushOnWindowEvent);
      globalThis.removeEventListener("beforeunload", flushOnWindowEvent);
      controlRef.current = null;
      void autosave.flush();
      autosave.attach(null);
      viewRef.current = null;
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: vocabularyCompartmentRef.current.reconfigure(
        vocabularyFor(styleVocabulary),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocabularyTokens, vocabularyParts, vocabularySettings]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || notes === undefined) {
      return;
    }
    view.dispatch({ effects: setLineNotes.of(notes) });
  }, [notes]);

  useEffect(() => {
    const view = viewRef.current;
    const savedText = autosave.savedText();
    if (
      !view ||
      diskText === savedText ||
      view.state.sliceDoc() !== savedText
    ) {
      return;
    }
    autosave.markSaved(diskText);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: diskText },
    });
    onDirtyChanged(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diskText]);

  return <div ref={hostRef} className="h-full min-h-0" />;
};

export default CodeFileEditor;
