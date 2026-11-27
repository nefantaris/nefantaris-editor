import type { EditorState, TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export type ReplacedText = { from: number; to: number };

export type EditBuilder = (state: EditorState) => TransactionSpec | null;

function isTriggerStillThere(state: EditorState, trigger: ReplacedText) {
  return (
    trigger.from < trigger.to &&
    trigger.to <= state.doc.length &&
    state.sliceDoc(trigger.from, trigger.from + 1) === "/"
  );
}

export function dispatchEdit(
  view: EditorView,
  build: EditBuilder,
  trigger: ReplacedText | null = null,
): boolean {
  const state = view.state;
  if (trigger === null || !isTriggerStillThere(state, trigger)) {
    const spec = build(state);
    if (spec === null) {
      return false;
    }
    view.dispatch(spec);
    return true;
  }
  const cleared = state.update({
    changes: { from: trigger.from, to: trigger.to },
    selection: { anchor: trigger.from },
  });
  const spec = build(cleared.state);
  if (spec === null) {
    view.dispatch(cleared);
    return true;
  }
  const finished = cleared.state.update(spec);
  view.dispatch({
    changes: cleared.changes.compose(finished.changes),
    selection: finished.selection ?? finished.newSelection,
    effects: finished.effects,
    userEvent: "input",
    scrollIntoView: true,
  });
  return true;
}

export function removeTrigger(view: EditorView, trigger: ReplacedText): void {
  if (!isTriggerStillThere(view.state, trigger)) {
    return;
  }
  view.dispatch({
    changes: { from: trigger.from, to: trigger.to },
    selection: { anchor: trigger.from },
    userEvent: "delete",
  });
}
