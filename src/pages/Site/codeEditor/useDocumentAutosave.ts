import type { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { useDebouncedCallback } from "../../../utils/useDebouncedCallback.ts";

const AUTOSAVE_DELAY_MS = 500;

export type HeldDraft = {
  text: string;
  line: number;
};

export type SaveGuard = {
  unfinishedLine: (state: EditorState) => number | null;
  onHeldChanged: (held: HeldDraft | null) => void;
};

export type DocumentAutosave = {
  createListener: () => Extension;
  attach: (view: EditorView | null) => void;
  flush: () => Promise<void>;
  cancel: () => void;
  savedText: () => string;
  markSaved: (text: string) => void;
};

export function useDocumentAutosave(
  initialText: string,
  save: (text: string) => Promise<void>,
  onDirtyChanged: (isDirty: boolean) => void,
  guard: SaveGuard | null = null,
): DocumentAutosave {
  const viewRef = useRef<EditorView | null>(null);
  const savedTextRef = useRef(initialText);
  const isCancelledRef = useRef(false);
  const saveRef = useRef(save);
  const onDirtyChangedRef = useRef(onDirtyChanged);
  const guardRef = useRef(guard);

  const currentText = () =>
    viewRef.current?.state.sliceDoc() ?? savedTextRef.current;

  const reportDirty = () => {
    onDirtyChangedRef.current(currentText() !== savedTextRef.current);
  };

  const unfinishedLineNow = (): number | null => {
    const view = viewRef.current;
    const currentGuard = guardRef.current;
    return view === null || currentGuard === null
      ? null
      : currentGuard.unfinishedLine(view.state);
  };

  const saveNow = async () => {
    if (isCancelledRef.current) {
      return;
    }
    const text = currentText();
    const unfinishedLine =
      text === savedTextRef.current ? null : unfinishedLineNow();
    guardRef.current?.onHeldChanged(
      unfinishedLine === null ? null : { text, line: unfinishedLine },
    );
    if (unfinishedLine !== null || text === savedTextRef.current) {
      return;
    }
    savedTextRef.current = text;
    await saveRef.current(text);
    reportDirty();
  };

  const scheduled = useDebouncedCallback(() => {
    void saveNow();
  }, AUTOSAVE_DELAY_MS);

  useEffect(() => {
    saveRef.current = save;
    onDirtyChangedRef.current = onDirtyChanged;
    guardRef.current = guard;
  });

  return {
    createListener: () =>
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          return;
        }
        reportDirty();
        scheduled.schedule();
      }),
    attach: (view) => {
      viewRef.current = view;
    },
    flush: async () => {
      scheduled.cancel();
      await saveNow();
    },
    cancel: () => {
      isCancelledRef.current = true;
      scheduled.cancel();
    },
    savedText: () => savedTextRef.current,
    markSaved: (text) => {
      savedTextRef.current = text;
    },
  };
}
