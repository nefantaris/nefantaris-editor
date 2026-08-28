import type { Extension } from "@codemirror/state";
import {
  Annotation,
  EditorSelection,
  EditorState,
  StateField,
} from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { Decoration, EditorView } from "@codemirror/view";
import { computeFrontmatter } from "./livePreview/documentRegions.ts";

export const trustedDocChange = Annotation.define<boolean>();

export function frontmatterBodyStart(state: EditorState): number {
  const region = computeFrontmatter(state.doc);
  if (!region) {
    return 0;
  }
  return Math.min(region.to + 1, state.doc.length);
}

function buildHiddenDecorations(state: EditorState): DecorationSet {
  const region = computeFrontmatter(state.doc);
  if (!region) {
    return Decoration.none;
  }
  return Decoration.set([
    Decoration.replace({ block: true }).range(region.from, region.to),
  ]);
}

const hiddenFrontmatterField = StateField.define<DecorationSet>({
  create: buildHiddenDecorations,
  update: (value, transaction) =>
    transaction.docChanged ? buildHiddenDecorations(transaction.state) : value,
  provide: (field) => EditorView.decorations.from(field),
});

const skipHiddenRegionWhenMoving = EditorView.atomicRanges.of((view) =>
  view.state.field(hiddenFrontmatterField),
);

const clampSelectionToBody = EditorState.transactionFilter.of((transaction) => {
  if (!transaction.selection) {
    return transaction;
  }
  const bodyStart = frontmatterBodyStart(transaction.state);
  if (bodyStart === 0) {
    return transaction;
  }
  const isInsideHiddenRegion = transaction.newSelection.ranges.some(
    (range) => range.from < bodyStart,
  );
  if (!isInsideHiddenRegion) {
    return transaction;
  }
  const clamped = EditorSelection.create(
    transaction.newSelection.ranges.map((range) =>
      EditorSelection.range(
        Math.max(range.anchor, bodyStart),
        Math.max(range.head, bodyStart),
      ),
    ),
    transaction.newSelection.mainIndex,
  );
  return [transaction, { selection: clamped }];
});

const blockEditsInsideHiddenRegion = EditorState.changeFilter.of(
  (transaction) => {
    if (
      transaction.annotation(trustedDocChange) ||
      transaction.isUserEvent("undo") ||
      transaction.isUserEvent("redo")
    ) {
      return true;
    }
    const bodyStart = frontmatterBodyStart(transaction.startState);
    if (bodyStart === 0) {
      return true;
    }
    let touchesHiddenRegion = false;
    transaction.changes.iterChangedRanges((fromA) => {
      if (fromA < bodyStart) {
        touchesHiddenRegion = true;
      }
    });
    return !touchesHiddenRegion;
  },
);

export const frontmatterHiding: Extension = [
  hiddenFrontmatterField,
  skipHiddenRegionWhenMoving,
  clampSelectionToBody,
  blockEditsInsideHiddenRegion,
];
