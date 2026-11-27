import type { Extension } from "@codemirror/state";
import { StateEffect, StateField } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { Decoration, EditorView } from "@codemirror/view";

const REVEAL_HIGHLIGHT_MS = 1600;

const revealEffect = StateEffect.define<number | null>();

const revealedLineDeco = Decoration.line({ class: "nef-revealed-line" });

const revealedLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (value, transaction) => {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(revealEffect)) {
        next =
          effect.value === null
            ? Decoration.none
            : Decoration.set([revealedLineDeco.range(effect.value)]);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const revealTheme = EditorView.theme({
  ".nef-revealed-line": {
    backgroundColor:
      "color-mix(in srgb, var(--color-primary) 14%, transparent)",
    borderRadius: "0.375rem",
  },
});

export const revealLineExtension: Extension = [revealedLineField, revealTheme];

export function revealLine(view: EditorView, lineNumber: number | null): void {
  const doc = view.state.doc;
  const target =
    lineNumber === null
      ? 0
      : doc.line(Math.min(Math.max(lineNumber, 1), doc.lines)).from;
  view.dispatch({ selection: { anchor: target } });
  const lineStart = view.state.doc.lineAt(view.state.selection.main.head).from;
  view.dispatch({
    effects: [
      revealEffect.of(lineNumber === null ? null : lineStart),
      EditorView.scrollIntoView(lineStart, {
        y: lineNumber === null ? "start" : "center",
      }),
    ],
  });
  view.focus();
  if (lineNumber === null) {
    return;
  }
  globalThis.setTimeout(() => {
    if (view.dom.isConnected) {
      view.dispatch({ effects: revealEffect.of(null) });
    }
  }, REVEAL_HIGHLIGHT_MS);
}
