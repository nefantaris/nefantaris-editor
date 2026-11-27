import type {
  ChangeSpec,
  EditorState,
  TransactionSpec,
} from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { BlockBody } from "../../../electron/ipcContract.cts";
import {
  attributeValuesFrom,
  blockSourceLines,
  containerFenceLength,
  directiveHeadSpan,
  labelTextOf,
  parseDirectiveLine,
  rewriteDirectiveLine,
  type DirectiveLine,
  type DirectiveLineEdit,
} from "./blockSyntax.ts";
import { blockInsertion } from "./formatting/blockInsertion.ts";
import { directiveRegionsField } from "./livePreview/documentRegions.ts";

export type BlockInsertion = {
  name: string;
  body: BlockBody;
  attributes: string;
  content: string | null;
  label?: string | null;
};

export type BlockAtLine = {
  lineFrom: number;
  name: string;
  label: string | null;
  attributes: Record<string, string>;
};

function enclosingFenceChanges(
  state: EditorState,
  position: number,
  insertedFenceLength: number,
): ChangeSpec[] {
  const enclosing = state
    .field(directiveRegionsField)
    .filter(
      (region) =>
        region.kind === "container" &&
        region.open.lineTo <= position &&
        (region.close === null
          ? position <= region.to
          : position < region.close.lineFrom),
    )
    .toSorted((a, b) => b.open.lineFrom - a.open.lineFrom);
  const changes: ChangeSpec[] = [];
  let innerLength = insertedFenceLength;
  for (const region of enclosing) {
    if (region.fenceLength > innerLength) {
      innerLength = region.fenceLength;
      continue;
    }
    innerLength += 1;
    const colons = ":".repeat(innerLength);
    for (const fence of [region.open, region.close]) {
      if (fence !== null) {
        changes.push({
          from: fence.colonsFrom,
          to: fence.colonsTo,
          insert: colons,
        });
      }
    }
  }
  return changes;
}

export function blockInsertionSpec(
  state: EditorState,
  insertion: BlockInsertion,
): TransactionSpec {
  const source = blockSourceLines(
    insertion.name,
    insertion.body,
    insertion.attributes,
    insertion.content,
    insertion.label ?? null,
  );
  const cursorLineText = source.lines[source.cursorLine] ?? "";
  const insertedFenceLength =
    insertion.body === "none"
      ? 0
      : containerFenceLength(insertion.content?.trimEnd() ?? "");
  return blockInsertion(
    state,
    source.lines,
    {
      line: source.cursorLine,
      from: source.isCursorAtLineEnd ? cursorLineText.length : 0,
    },
    (insertAt) => enclosingFenceChanges(state, insertAt, insertedFenceLength),
  );
}

function directiveLineAt(
  state: EditorState,
  lineFrom: number,
): { text: string; from: number; parsed: DirectiveLine } | null {
  if (lineFrom < 0 || lineFrom > state.doc.length) {
    return null;
  }
  const line = state.doc.lineAt(lineFrom);
  const parsed = parseDirectiveLine(line.text);
  return parsed === null ? null : { text: line.text, from: line.from, parsed };
}

export function blockAtLine(
  state: EditorState,
  lineFrom: number,
): BlockAtLine | null {
  const found = directiveLineAt(state, lineFrom);
  if (found === null) {
    return null;
  }
  return {
    lineFrom: found.from,
    name: found.parsed.name,
    label: labelTextOf(found.text, found.parsed),
    attributes: attributeValuesFrom(found.parsed.attributes?.tokens ?? []),
  };
}

export function rewriteBlock(
  view: EditorView,
  block: BlockAtLine,
  edit: DirectiveLineEdit,
): boolean {
  const found = directiveLineAt(view.state, block.lineFrom);
  if (found === null || found.parsed.name !== block.name) {
    return false;
  }
  const rewritten = rewriteDirectiveLine(found.text, found.parsed, edit);
  if (rewritten === found.text) {
    return true;
  }
  const { from: spanFrom, to: spanTo } = directiveHeadSpan(found.parsed);
  const keptAfter = found.text.length - spanTo;
  view.dispatch({
    changes: {
      from: found.from + spanFrom,
      to: found.from + spanTo,
      insert: rewritten.slice(spanFrom, rewritten.length - keptAfter),
    },
    userEvent: "input",
  });
  return true;
}
